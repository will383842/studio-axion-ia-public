/**
 * IMPORT D'UN FICHIER TEXTE (correcteur 3, B6 de l'audit B) : le texte d'un .docx (mammoth) ou d'un .pdf (unpdf) est
 * lu SUR LE SERVEUR, sans aucun appel extérieur ; .txt et .md sont acceptés aussi (lus tels quels). 5 Mo au plus.
 * Le texte est ensuite découpé comme un texte collé : aucun mot n'est réécrit.
 *
 * Relecture paquet 4 (sécurité D1, bombe zip / PDF) : les 5 Mo ne bornent que le fichier COMPRESSÉ. Désormais :
 *  - le contenu doit avoir la signature de son type (« PK » pour un .docx, « %PDF- » pour un .pdf), sinon illisible ;
 *  - seconde relecture (veto .pdf) : l'extraction tourne dans un PROCESSUS ENFANT (`node --max-old-space-size=256`),
 *    sans aucune variable d'environnement du studio (aucun secret). Sa mémoire RÉELLE (RSS, pic relevé dans
 *    /proc/<pid>/status toutes les 50 ms) est surveillée : au-delà de 250 Mo ou de 15 s, il est tué (SIGKILL) et le
 *    fichier refusé. Les tampons de pdf.js sont hors du tas V8 : seul ce relevé les voit. Au pire, le noyau tue l'enfant,
 *    jamais le studio. Un seul fichier est lu à la fois (3 en attente au plus) ;
 *  - .docx : AVANT mammoth, nombre d'entrées et taille annoncée (répertoire central) contrôlés, puis chaque entrée
 *    décompressée EN FLUX avec un compteur (le répertoire central peut mentir) : 20 Mo au plus une fois ouvert ;
 *  - .pdf : AVANT pdf.js, un contrôle qui ne dépend PAS du dictionnaire des flux : tout `/Filter` (noms échappés `#xx`
 *    compris) doit être un nom direct parmi Flate, DCT et JPX (filtre indirect, LZW, RunLength, ASCII85… : refus), et
 *    CHAQUE flux qui commence par un en-tête zlib est décompressé, sortie bornée (50 Mo au total, Flate dans Flate
 *    compris), jusqu'à la fin réelle de ses données (un faux « endstream » ne l'arrête pas) ; un PDF chiffré n'est pas lu ;
 *  - le texte rendu fait 200 000 caractères au plus (refus clair, jamais une coupe en silence), comme .txt et .md.
 */
import "server-only";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as zlib from "node:zlib";
import {
  decoderTexteFichier,
  MESSAGE_FICHIER_TROP_COMPLEXE,
  MESSAGE_FICHIER_VIDE,
  MESSAGE_PDF_SCANNE,
  MESSAGE_ILLISIBLE,
  MESSAGE_TEXTE_TROP_LONG,
  TEXTE_MAX_CARACTERES,
  texteDuMarkdown,
  verifierFichierImport,
} from "@/assistant/express/texte-colle";
import { ErreurStudio } from "./_commun";

/** Bornes de l'extraction (exportées pour les essais). */
export const LIMITES_IMPORT = {
  /** Tas V8 du processus de lecture (Mo). */
  memoireMo: 256,
  /** Mémoire réelle (RSS, tas et tampons compris) du processus de lecture, au-delà de laquelle il est tué (Mo). */
  rssMaxMo: 250,
  /** Intervalle du relevé de la mémoire réelle. */
  releveMs: 50,
  /** Durée maximale de la lecture d'un fichier. */
  delaiMs: 15_000,
  /** .docx : taille totale une fois décompressé. */
  docxDecompresseOctets: 20 * 1024 * 1024,
  /** .docx : nombre d'entrées du zip. */
  docxEntrees: 500,
  /** .pdf : flux zlib (tous, quel que soit leur dictionnaire) une fois décompressés. */
  pdfDecompresseOctets: 50 * 1024 * 1024,
  /** .pdf : contrôle préalable (coupé seulement par les essais de la borne de mémoire). */
  controlePrealable: true,
};

/** Signature du contenu (P2) : un faux .docx ou .pdf ne charge jamais la bibliothèque. */
export function signatureValide(extension: ".docx" | ".pdf", octets: Uint8Array): boolean {
  if (extension === ".docx") return octets.length >= 4 && octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04;
  // La norme tolère quelques octets avant l'en-tête : il doit se trouver dans le premier Ko.
  return Buffer.from(octets.subarray(0, 1024)).includes("%PDF-");
}

/**
 * Contrôle préalable d'un .pdf (seconde relecture, § 2.1 point 2), en JavaScript simple : il tourne DANS le processus
 * enfant (sa mémoire y est surveillée) et, pour les essais, dans le studio (`controlerPdf`). Renvoie « complexe »,
 * « illisible » ou null (rien à redire). Ne lit jamais le dictionnaire d'un flux pour décider de le décompresser.
 */
const CODE_CONTROLE_PDF = String.raw`
function controlerPdf(octets, L, zlib) {
  const b = Buffer.from(octets.buffer, octets.byteOffset, octets.byteLength);
  // Noms échappés (« /Fl#61teDecode ») ramenés à leur forme lue par pdf.js.
  const texte = b.toString("latin1").replace(/\/[^\s\/\[\]<>(){}%]*/g, (n) => (n.indexOf("#") < 0 ? n : n.replace(/#([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))));
  if (texte.indexOf("/Encrypt") >= 0) return "illisible";
  // 1. Filtres : un nom direct, ou un tableau de noms directs, parmi Flate, DCT et JPX. Rien d'autre (filtre indirect
  //    « 6 0 R », LZW, RunLength, ASCII85, CCITT, JBIG2…).
  const permis = new Set(["FlateDecode", "Fl", "DCTDecode", "DCT", "JPXDecode"]);
  const blanc = /[\s]/;
  const filtre = /\/Filter(?=[\s\/\[<(%]|$)/g;
  let m;
  while ((m = filtre.exec(texte))) {
    let i = m.index + 7;
    const sauter = () => {
      for (;;) {
        while (i < texte.length && blanc.test(texte[i])) i++;
        if (texte[i] !== "%") return;
        while (i < texte.length && texte[i] !== "\n" && texte[i] !== "\r") i++;
      }
    };
    const nom = () => {
      if (texte[i] !== "/") return null;
      const n = /^\/([^\s\/\[\]<>(){}%]*)/.exec(texte.slice(i, i + 64));
      i += n[0].length;
      return n[1];
    };
    sauter();
    if (texte[i] === "[") {
      i++;
      let compte = 0;
      for (;;) {
        sauter();
        if (texte[i] === "]") break;
        const n = nom();
        if (n === null || !permis.has(n) || ++compte > 4) return "complexe";
      }
    } else {
      const n = nom();
      if (n === null || !permis.has(n)) return "complexe";
    }
  }
  // 2. Chaque flux qui commence par un en-tête zlib est décompressé (sortie bornée), QUEL QUE SOIT son dictionnaire,
  //    jusqu'à la fin réelle de ses données (zlib s'arrête de lui-même ; un faux « endstream » ne coupe rien).
  let total = 0;
  const enteteZlib = (x, j) => j + 1 < x.length && (x[j] & 0x0f) === 8 && (x[j] >> 4) <= 7 && ((x[j] << 8) | x[j + 1]) % 31 === 0 && (x[j + 1] & 0x20) === 0;
  const decompresser = (x, j, profondeur) => {
    if (profondeur > 3) return "complexe";
    let sortie;
    try {
      // Brut, après l'en-tête : la somme de contrôle finale (que pdf.js ne vérifie pas) n'arrête rien.
      sortie = zlib.inflateRawSync(x.subarray(j + 2), { maxOutputLength: Math.max(1, L.pdfDecompresseOctets - total + 1), finishFlush: zlib.constants.Z_SYNC_FLUSH });
    } catch (e) {
      // Trop grand, ou données invalides dont on ne sait plus ce qu'elles donneraient : refus (prudent).
      return "complexe";
    }
    total += sortie.length;
    if (total > L.pdfDecompresseOctets) return "complexe";
    // Flate dans Flate (« [/FlateDecode /FlateDecode] ») : le second étage compte aussi.
    if (enteteZlib(sortie, 0)) return decompresser(sortie, 0, profondeur + 1);
    return null;
  };
  let i = 0;
  for (;;) {
    const debut = b.indexOf("stream", i, "latin1");
    if (debut < 0) break;
    i = debut + 6;
    // « endstream » contient « stream » : on ne garde que les mots-clés « stream » qui ouvrent un flux.
    if (debut >= 3 && b[debut - 3] === 0x65 && b[debut - 2] === 0x6e && b[debut - 1] === 0x64) continue;
    // Début des données : juste après le mot-clé (blancs sautés), ou après la fin de ligne comme pdf.js.
    const departs = new Set();
    let d = i;
    while (d < b.length && d < i + 16 && (b[d] === 0x20 || b[d] === 0x09 || b[d] === 0x0d || b[d] === 0x0a || b[d] === 0x0c || b[d] === 0x00)) d++;
    departs.add(d);
    let e = i;
    while (e < b.length && e < i + 1024 && b[e] !== 0x0a && b[e] !== 0x0d) e++;
    if (b[e] === 0x0d) e++;
    if (b[e] === 0x0a) e++;
    departs.add(e);
    for (const j of departs) {
      if (!enteteZlib(b, j)) continue;
      const r = decompresser(b, j, 0);
      if (r) return r;
    }
  }
  return null;
}
`;

/**
 * Code du processus enfant (CommonJS, lancé par `node -e`) : il lit le fichier sur son entrée standard, charge mammoth,
 * jszip et unpdf depuis le dossier du studio, et écrit `{ ok, texte }` ou `{ ok: false, motif }` (« complexe »,
 * « long », « illisible ») en JSON sur sa sortie standard. Les avertissements des bibliothèques vont sur sa sortie
 * d'erreur (jamais mêlés à la réponse).
 */
const CODE_ENFANT = String.raw`
"use strict";
const { createRequire } = require("node:module");
const zlib = require("node:zlib");
const P = JSON.parse(process.argv[1]);
const L = P.limites;
const r = createRequire(P.base);
for (const k of ["log", "info", "warn", "error", "debug"]) console[k] = (...a) => process.stderr.write(a.map(String).join(" ").slice(0, 500) + "\n");
class Refus extends Error { constructor(motif) { super(motif); this.motif = motif; } }
${CODE_CONTROLE_PDF}

async function lireDocx(octets) {
  const cheminMammoth = r.resolve("mammoth");
  const JSZip = createRequire(cheminMammoth)("jszip");
  const zip = await JSZip.loadAsync(octets);
  const entrees = Object.values(zip.files).filter((f) => !f.dir);
  if (entrees.length > L.docxEntrees) throw new Refus("complexe");
  let annonce = 0;
  for (const f of entrees) annonce += (f._data && f._data.uncompressedSize) || 0;
  if (annonce > L.docxDecompresseOctets) throw new Refus("complexe");
  // Le répertoire central peut mentir : chaque entrée est décompressée en flux, octets comptés.
  let total = 0;
  for (const f of entrees) {
    await new Promise((ok, ko) => {
      const flux = f.internalStream("uint8array");
      let fini = false;
      flux
        .on("data", (morceau) => {
          if (fini) return;
          total += morceau.length;
          if (total > L.docxDecompresseOctets) {
            fini = true;
            flux.pause();
            ko(new Refus("complexe"));
          }
        })
        .on("error", (e) => { if (!fini) { fini = true; ko(e); } })
        .on("end", () => { if (!fini) { fini = true; ok(); } })
        .resume();
    });
  }
  const mammoth = r("mammoth");
  // VERIF-E2E-1 (B) : mammoth ne rend rien pour un retour à la ligne manuel de Word (Maj + Entrée, <w:br/>) ni pour un
  // saut de page dans une ligne : les mots de part et d'autre étaient SOUDÉS (« mailsIl »). Le zip déjà ouvert est
  // passé à mammoth (option « file » de mammoth), et chaque <w:br/> ou <w:cr/> du texte devient un vrai saut de ligne.
  const sautsDeLigne = (xml) => xml.replace(/<w:(?:br|cr)(?=[\s\/>])[^>]*?\/>/g, '<w:t xml:space="preserve">\n</w:t>');
  const fichier = {
    exists: (n) => zip.file(n) !== null,
    read: (n, codage) =>
      zip.file(n).async("uint8array").then((a) => {
        if (codage === "base64") return Buffer.from(a).toString("base64");
        if (!codage) return a;
        const t = new TextDecoder(codage).decode(a);
        return /^word\/[^/]+\.xml$/.test(n) ? sautsDeLigne(t) : t;
      }),
    write: (n, contenu) => zip.file(n, contenu),
    toArrayBuffer: () => zip.generateAsync({ type: "arraybuffer" }),
  };
  return (await mammoth.extractRawText({ file: fichier })).value;
}

/**
 * unpdf, par son nom quand il est en tête de node_modules (dépôt, construction webpack) ; sinon (image autonome
 * construite par Turbopack, correcteur final B) là où la sortie autonome le range : alias haché
 * .next/node_modules/unpdf-<empreinte> ou dossier pnpm node_modules/.pnpm/unpdf@<version>/node_modules/unpdf.
 */
async function chargerUnpdf() {
  const fs = require("node:fs");
  const path = require("node:path");
  try {
    return await import("unpdf");
  } catch (e) {
    if (!e || e.code !== "ERR_MODULE_NOT_FOUND") throw e;
  }
  const dossier = path.dirname(P.base);
  const lister = (d) => { try { return fs.readdirSync(d); } catch { return []; } };
  const candidats = [];
  for (const n of lister(dossier)) {
    if (!n.startsWith(".next")) continue;
    for (const m of lister(path.join(dossier, n, "node_modules"))) if (/^unpdf-[0-9a-f]+$/.test(m)) candidats.push(path.join(dossier, n, "node_modules", m));
  }
  for (const n of lister(path.join(dossier, "node_modules", ".pnpm"))) if (/^unpdf@/.test(n)) candidats.push(path.join(dossier, "node_modules", ".pnpm", n, "node_modules", "unpdf"));
  for (const c of candidats) {
    let paquet;
    try {
      paquet = JSON.parse(fs.readFileSync(path.join(c, "package.json"), "utf8"));
    } catch {
      continue;
    }
    // Entrée ESM (la sortie autonome ne garde que ce qui est importé) : exports["."].import, sinon module.
    const e = paquet.exports && paquet.exports["."] && paquet.exports["."].import;
    const entree = (e && (typeof e === "string" ? e : e.default)) || paquet.module;
    if (entree && fs.existsSync(path.join(c, entree))) return import(require("node:url").pathToFileURL(path.join(c, entree)).href);
  }
  throw new Error("Cannot find package 'unpdf'");
}

/**
 * VERIF-E2E-1 (B) : le .pdf contient-il une image (page scannée) ? Cherché dans le fichier brut puis dans ses flux
 * compressés (objets regroupés), sortie bornée. Sert seulement à choisir la phrase montrée quand aucun texte n'est lu.
 */
function contientImage(octets) {
  const b = Buffer.from(octets.buffer, octets.byteOffset, octets.byteLength);
  const motif = /\/Subtype\s*\/Image(?![A-Za-z])/;
  if (motif.test(b.toString("latin1"))) return true;
  let i = 0;
  let total = 0;
  for (;;) {
    const debut = b.indexOf("stream", i, "latin1");
    if (debut < 0) return false;
    i = debut + 6;
    if (debut >= 3 && b[debut - 3] === 0x65 && b[debut - 2] === 0x6e && b[debut - 1] === 0x64) continue;
    let j = i;
    if (b[j] === 0x0d) j++;
    if (b[j] === 0x0a) j++;
    let sortie;
    try {
      sortie = zlib.inflateSync(b.subarray(j), { maxOutputLength: 8 * 1024 * 1024, finishFlush: zlib.constants.Z_SYNC_FLUSH });
    } catch (e) {
      continue;
    }
    total += sortie.length;
    if (motif.test(sortie.toString("latin1"))) return true;
    if (total > L.pdfDecompresseOctets) return false;
  }
}

async function lirePdf(octets) {
  if (L.controlePrealable) {
    const motif = controlerPdf(octets, L, zlib);
    if (motif) throw new Refus(motif);
  }
  const { extractText } = await chargerUnpdf();
  const { text } = await extractText(new Uint8Array(octets), { mergePages: false });
  let longueur = 0;
  for (const page of text) {
    longueur += page.length;
    if (longueur > P.maxCaracteres * 2) throw new Refus("long");
  }
  // Aucun texte, mais une image : c'est un scan (phrase dédiée, pas « ne contient pas de texte »).
  if (!text.some((page) => page.trim()) && contientImage(octets)) throw new Refus("scan");
  return text.join("\n\n");
}

function repondre(r) {
  process.stdout.write(JSON.stringify(r), () => process.exit(0));
}

const morceaux = [];
let recus = 0;
process.stdin.on("data", (c) => {
  recus += c.length;
  if (recus > P.octetsMax) process.exit(3);
  morceaux.push(c);
});
process.stdin.on("end", async () => {
  try {
    const octets = new Uint8Array(Buffer.concat(morceaux));
    const texte = P.extension === ".docx" ? await lireDocx(octets) : await lirePdf(octets);
    // Le texte est nettoyé plus loin : on garde une marge pour les espaces, sans jamais renvoyer un texte démesuré.
    if (texte.length > P.maxCaracteres * 2) throw new Refus("long");
    repondre({ ok: true, texte });
  } catch (e) {
    repondre({ ok: false, motif: e && e.motif ? e.motif : "illisible", detail: e && e.message ? String(e.message).slice(0, 200) : "" });
  }
});
`;

type Limites = typeof LIMITES_IMPORT;

/** Contrôle préalable d'un .pdf, exécuté dans ce processus (essais) : « complexe », « illisible » ou null. */
export function controlerPdf(octets: Uint8Array, limites: Partial<Limites> = {}): "complexe" | "illisible" | null {
  const f = new Function(`${CODE_CONTROLE_PDF}\nreturn controlerPdf;`)() as (o: Uint8Array, l: Limites, z: typeof zlib) => "complexe" | "illisible" | null;
  return f(octets, { ...LIMITES_IMPORT, ...limites }, zlib);
}

/**
 * Lancement du processus enfant : tas V8 borné, AUCUNE variable d'environnement du studio (ni secret, ni NODE_OPTIONS
 * qui relèverait le tas), code fixe (aucune donnée de l'utilisateur dans la ligne de commande : le fichier passe par
 * l'entrée standard).
 */
export function lancementEnfant(memoireMo: number): { args: string[]; env: Record<string, string> } {
  return { args: [`--max-old-space-size=${memoireMo}`, "--max-semi-space-size=16", "--stack-size=2048", "-e", CODE_ENFANT], env: {} };
}

/** Pic de mémoire réelle (Mo) d'un processus, d'après /proc (Linux) ; null si illisible. */
function picMemoireMo(pid: number): number | null {
  try {
    const statut = readFileSync(`/proc/${pid}/status`, "latin1");
    const m = /VmHWM:\s+(\d+)\s+kB/.exec(statut) ?? /VmRSS:\s+(\d+)\s+kB/.exec(statut);
    return m ? Number(m[1]) / 1024 : null;
  } catch {
    return null;
  }
}

export interface MesureImport {
  issue: "lu" | "refus" | "memoire" | "delai" | "arret";
  dureeMs: number;
  /** Pic de mémoire réelle de l'enfant relevé (Mo). */
  rssMaxMo: number;
}
let mesure: MesureImport | null = null;
/** Dernière lecture : issue, durée, pic de mémoire de l'enfant (essais, mesures de la documentation). */
export function derniereMesureImport(): MesureImport | null {
  return mesure;
}

/**
 * Les bibliothèques sont chargées une fois ici aussi : c'est ce qui les garde dans l'image Docker autonome (l'enfant les
 * charge depuis le dossier du studio, par leur nom). Rien n'est lu avec elles dans ce processus.
 */
let modules: Promise<unknown> | null = null;
function verifierModules(): Promise<unknown> {
  modules ??= Promise.all([import("mammoth"), import("unpdf")]);
  return modules;
}

/** Un seul fichier lu à la fois (plusieurs lecteurs de 250 Mo feraient tomber le conteneur). */
let file: Promise<unknown> = Promise.resolve();
let enAttente = 0;
const ATTENTE_MAX = 3;

function unALaFois<T>(f: () => Promise<T>): Promise<T> {
  if (enAttente >= ATTENTE_MAX) return Promise.reject(new ErreurStudio("IMPORT_OCCUPE", "Un autre fichier est en cours de lecture. Réessayez dans un instant."));
  enAttente++;
  const suite = file.then(f, f).finally(() => enAttente--);
  file = suite.catch(() => undefined);
  return suite;
}

/** Réponse de l'enfant au-delà de laquelle il est arrêté (le texte est borné à 2 × 200 000 caractères). */
const SORTIE_MAX_OCTETS = 8 * 1024 * 1024;

/**
 * Lit un .docx ou un .pdf dans un processus enfant borné (mémoire réelle, temps). Refus : `IMPORT_TROP_COMPLEXE`,
 * `IMPORT_ILLISIBLE`, `IMPORT_TROP_LONG`.
 */
export function extraireDansUnProcessus(extension: ".docx" | ".pdf", octets: Uint8Array, limites: Partial<Limites> = {}, dossier = process.cwd()): Promise<string> {
  const l = { ...LIMITES_IMPORT, ...limites };
  return unALaFois(
    () =>
      new Promise<string>((resoudre, rejeter) => {
        const debut = Date.now();
        let fini = false;
        let issue: MesureImport["issue"] | null = null;
        let rssMaxMo = 0;
        const sortie: Buffer[] = [];
        let tailleSortie = 0;
        let erreurs = "";
        const { args, env } = lancementEnfant(l.memoireMo);
        const params = { base: join(dossier, "index.js"), extension, limites: l, maxCaracteres: TEXTE_MAX_CARACTERES, octetsMax: octets.byteLength };
        const enfant: ChildProcessWithoutNullStreams = spawn(process.execPath, [...args, JSON.stringify(params)], { cwd: dossier, env: env as NodeJS.ProcessEnv, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
        const tropComplexe = () => new ErreurStudio("IMPORT_TROP_COMPLEXE", MESSAGE_FICHIER_TROP_COMPLEXE);
        const tuer = (raison: "memoire" | "delai" | "arret") => {
          if (issue === null) issue = raison;
          try {
            enfant.kill("SIGKILL");
          } catch {
            // Déjà sorti.
          }
        };
        const terminer = (r: { ok: true; texte: string } | { ok: false; erreur: ErreurStudio }) => {
          if (fini) return;
          fini = true;
          clearTimeout(minuterie);
          clearInterval(releve);
          if (enfant.exitCode === null && enfant.signalCode === null) tuer("arret");
          mesure = { issue: issue ?? (r.ok ? "lu" : "refus"), dureeMs: Date.now() - debut, rssMaxMo };
          if (r.ok) resoudre(r.texte);
          else rejeter(r.erreur);
        };
        const minuterie = setTimeout(() => {
          console.warn(`[import-texte] lecture arrêtée après ${l.delaiMs} ms (${extension})`);
          tuer("delai");
        }, l.delaiMs);
        // Mémoire RÉELLE de l'enfant (tas V8 ET tampons hors du tas), relevée toutes les 50 ms.
        let releveIllisible = false;
        const releve = setInterval(() => {
          if (!enfant.pid) return;
          const pic = picMemoireMo(enfant.pid);
          if (pic === null) {
            if (!releveIllisible && enfant.exitCode === null) {
              releveIllisible = true;
              console.warn("[import-texte] mémoire du processus de lecture illisible (/proc absent) : seuls le tas et le délai le bornent");
            }
            return;
          }
          rssMaxMo = Math.max(rssMaxMo, pic);
          if (pic > l.rssMaxMo) {
            console.warn(`[import-texte] lecture arrêtée : ${Math.round(pic)} Mo de mémoire (${extension})`);
            tuer("memoire");
          }
        }, l.releveMs);
        enfant.stdout.on("data", (c: Buffer) => {
          tailleSortie += c.length;
          if (tailleSortie > SORTIE_MAX_OCTETS) return tuer("arret");
          sortie.push(c);
        });
        enfant.stderr.on("data", (c: Buffer) => {
          erreurs = (erreurs + c.toString("utf8")).slice(-2000);
        });
        // Entrée fermée tôt (enfant tué) : sans conséquence, la fin est jugée à la sortie de l'enfant.
        enfant.stdin.on("error", () => undefined);
        enfant.stdin.end(Buffer.from(octets.buffer, octets.byteOffset, octets.byteLength));
        enfant.on("error", (e) => {
          console.warn(`[import-texte] processus de lecture impossible à lancer (${extension}) : ${e.message}`);
          terminer({ ok: false, erreur: tropComplexe() });
        });
        enfant.on("close", (code, signal) => {
          let m: { ok: true; texte: string } | { ok: false; motif: string; detail?: string } | null = null;
          if (issue === null && code === 0) {
            try {
              m = JSON.parse(Buffer.concat(sortie).toString("utf8"));
            } catch {
              m = null;
            }
          }
          if (!m) {
            // Tué (mémoire, délai), tas dépassé, ou réponse illisible : le fichier est refusé, le studio continue.
            if (issue === null) console.warn(`[import-texte] processus de lecture arrêté (${extension}) : code ${code ?? "-"}, signal ${signal ?? "-"} ${erreurs.slice(-200)}`);
            return terminer({ ok: false, erreur: tropComplexe() });
          }
          if (m.ok) return terminer({ ok: true, texte: m.texte });
          if (m.motif !== "complexe" && m.motif !== "scan") console.warn(`[import-texte] lecture impossible (${extension}) : ${m.detail ?? m.motif}`);
          terminer({
            ok: false,
            erreur:
              m.motif === "complexe"
                ? tropComplexe()
                : m.motif === "long"
                  ? new ErreurStudio("IMPORT_TROP_LONG", MESSAGE_TEXTE_TROP_LONG)
                  : m.motif === "scan"
                    ? new ErreurStudio("IMPORT_SCAN", MESSAGE_PDF_SCANNE)
                    : new ErreurStudio("IMPORT_ILLISIBLE", MESSAGE_ILLISIBLE),
          });
        });
      }),
  );
}

/**
 * VERIF-E2E-1 (B) : dans un .pdf, chaque ligne VISUELLE de la page devient une ligne du texte : la mise en page coupe les
 * phrases, et le découpage du script (qui garde les retours à la ligne de Will) en faisait plusieurs morceaux. Une
 * ligne est recollée à la suivante quand elle ne finit PAS une phrase (. ? ! … : ; éventuellement suivis d'un
 * guillemet ou d'une parenthèse fermante) ET que la suivante commence par une minuscule : c'est la même phrase. Un titre
 * suivi d'une phrase (majuscule) ou une ligne qui finit une phrase restent séparés. Un mot coupé en fin de ligne
 * (« licencie-» / « ment ») est recollé sans espace. Les pages (lignes vides) ne sont jamais réunies. Aucun mot n'est
 * réécrit : seuls des retours à la ligne deviennent des espaces.
 */
export function recollerLignesPdf(texte: string): string {
  // RELECTURE FINALE S1 : temps LINÉAIRE. Avant, la ligne déjà recollée (qui grossit sans cesse) était relue à chaque
  // ligne (`trimEnd`, deux expressions ancrées en fin) : 100 000 lignes d'une lettre figeaient le studio 8 s. Ici, seule
  // la FIN de la ligne en cours décide (le dernier morceau ajouté : il commence par une minuscule, donc rien d'avant lui
  // ne peut finir une phrase), et les morceaux ne sont joints qu'une fois, à la fin.
  const sortie: string[] = [];
  let morceaux: string[] | null = null;
  /** Fin de la ligne en cours, sans les espaces de fin : le dernier morceau ajouté. */
  let fin = "";
  for (const ligne of texte.replace(/\r\n?/g, "\n").split("\n")) {
    const suite = ligne.trimStart();
    if (morceaux && fin && suite && !/[.?!…:;][»"”’)\]\s\u00a0\u202f]*$/.test(fin) && /^\p{Ll}/u.test(suite)) {
      morceaux[morceaux.length - 1] = morceaux[morceaux.length - 1].trimEnd();
      morceaux.push(/\p{L}-$/u.test(fin) ? suite : ` ${suite}`);
      fin = suite.trimEnd();
    } else {
      if (morceaux) sortie.push(morceaux.join(""));
      morceaux = [ligne];
      fin = ligne.trimEnd();
    }
  }
  if (morceaux) sortie.push(morceaux.join(""));
  return sortie.join("\n");
}

/** Relecture finale S1 : au-delà, le texte brut d'un fichier est refusé « trop long » avant tout traitement. */
export const TEXTE_BRUT_MAX_CARACTERES = 2 * TEXTE_MAX_CARACTERES;

/** Lit le texte d'un fichier importé. Refus clairs : type, taille, fichier illisible, trop complexe, trop long ou vide. */
export async function extraireTexteFichier(nom: string, octets: Uint8Array): Promise<string> {
  const v = verifierFichierImport({ nom, taille: octets.byteLength });
  if (!v.ok) throw new ErreurStudio("IMPORT_REFUSE", v.message);
  let texte: string;
  if (v.extension === ".docx" || v.extension === ".pdf") {
    if (!signatureValide(v.extension, octets)) {
      console.warn("[import-texte] signature du fichier inattendue", v.extension);
      throw new ErreurStudio("IMPORT_ILLISIBLE", MESSAGE_ILLISIBLE);
    }
    try {
      await verifierModules();
    } catch (e) {
      console.warn("[import-texte] bibliothèques de lecture absentes", e instanceof Error ? e.message : "erreur");
      throw new ErreurStudio("IMPORT_ILLISIBLE", MESSAGE_ILLISIBLE);
    }
    texte = await extraireDansUnProcessus(v.extension, octets);
  } else {
    try {
      // VERIF-E2E-1 (B) : UTF-8, sinon Windows-1252 (jamais de « � » à la place des accents).
      texte = decoderTexteFichier(octets);
    } catch (e) {
      console.warn("[import-texte] lecture impossible", nom, e);
      throw new ErreurStudio("IMPORT_ILLISIBLE", MESSAGE_ILLISIBLE);
    }
  }
  // Relecture finale S1 : borne avant tout traitement (un texte brut démesuré ne passe jamais dans les boucles).
  if (texte.length > TEXTE_BRUT_MAX_CARACTERES) throw new ErreurStudio("IMPORT_TROP_LONG", MESSAGE_TEXTE_TROP_LONG);
  if (v.extension === ".md") texte = texteDuMarkdown(texte);
  if (v.extension === ".pdf") texte = recollerLignesPdf(texte);
  texte = texte.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (texte.length > TEXTE_MAX_CARACTERES) throw new ErreurStudio("IMPORT_TROP_LONG", MESSAGE_TEXTE_TROP_LONG);
  if (!texte) throw new ErreurStudio("IMPORT_VIDE", MESSAGE_FICHIER_VIDE);
  return texte;
}
