/**
 * T-EXT-41 : sécurité des entrées du tutoriel d'outil (dossier zip, maquette, données de personnes). SENSIBLE SÉCURITÉ.
 *
 * PUR : aucun `node:*`, aucun disque, aucun réseau ; ne lève jamais. Tout est refusé en bloc : une seule entrée piégée
 * et l'archive entière est refusée (jamais extraite « à moitié »).
 *
 * `lireRepertoireZip` ne lit QUE les en-têtes (fin d'archive puis répertoire central) : aucune donnée n'est
 * décompressée ici. Les messages citent le nom d'une entrée (tronqué) et jamais son contenu ni une donnée trouvée.
 */

const MO = 1024 * 1024;
export const TAILLE_ZIP_MAX = 50 * MO;
export const TOTAL_DECOMPRESSE_MAX = 150 * MO;
export const FICHIER_MAX = 25 * MO;
export const ENTREES_MAX = 500;
export const RATIO_COMPRESSION_MAX = 100;
export const PROFONDEUR_MAX = 8;
export const NOM_MAX = 200;
export const EXTENSIONS_PERMISES: readonly string[] = ["html", "htm", "css", "js", "json", "csv", "txt", "md", "png", "jpg", "jpeg", "webp", "woff2"];
export const EXTENSIONS_IMAGES: readonly string[] = ["png", "jpg", "jpeg", "webp"];
export const IGNORES: readonly string[] = ["__MACOSX/", ".DS_Store", "Thumbs.db"];

const SIG_FIN = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCALISATEUR_ZIP64 = 0x07064b50;
const TAILLE_FIN = 22;
const FENETRE_FIN = 65535 + TAILLE_FIN;

export interface EntreeZip {
  nom: string;
  /** Octets du nom tels qu'écrits dans l'archive (comparés à l'en-tête local à l'extraction). */
  nomOctets: Uint8Array;
  methode: number;
  chiffre: boolean;
  tailleCompressee: number;
  tailleDecompressee: number;
  crc: number;
  decalageLocal: number;
  estLien: boolean;
  estDossier: boolean;
}

export type LectureRepertoire = { ok: true; entrees: EntreeZip[]; debutRepertoire: number } | { ok: false; refus: string[] };

export interface RapportZip {
  ok: boolean;
  refus: string[];
  ignores: string[];
}

function nomCourt(nom: string): string {
  const propre = nom.replace(/[\u0000-\u001f\u007f-\u009f]/g, "?");
  return propre.length > 60 ? `${propre.slice(0, 60)}…` : propre;
}

/** Lit la fin d'archive puis le répertoire central. Ne décompresse rien. */
export function lireRepertoireZip(octets: Uint8Array): LectureRepertoire {
  const refus = (m: string): LectureRepertoire => ({ ok: false, refus: [m] });
  try {
    if (!(octets instanceof Uint8Array)) return refus("Archive illisible.");
    if (octets.length > TAILLE_ZIP_MAX) return refus(`Le dossier dépasse ${TAILLE_ZIP_MAX / MO} Mo : réduisez-le puis renvoyez-le.`);
    if (octets.length < TAILLE_FIN) return refus("Ce fichier n'est pas une archive zip valide.");
    const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);
    const debutFenetre = Math.max(0, octets.length - FENETRE_FIN);
    const positions: number[] = [];
    for (let i = octets.length - TAILLE_FIN; i >= debutFenetre; i--) if (v.getUint32(i, true) === SIG_FIN) positions.push(i);
    if (positions.length === 0) return refus("Ce fichier n'est pas une archive zip valide (fin d'archive absente).");
    if (positions.length > 1) return refus("Archive ambiguë (plusieurs fins d'archive) : refusée.");
    const fin = positions[0]!;
    if (fin >= 20 && v.getUint32(fin - 20, true) === SIG_LOCALISATEUR_ZIP64) return refus("Archive ZIP64 non acceptée.");
    const disque = v.getUint16(fin + 4, true);
    const disqueRepertoire = v.getUint16(fin + 6, true);
    const surDisque = v.getUint16(fin + 8, true);
    const total = v.getUint16(fin + 10, true);
    const tailleRep = v.getUint32(fin + 12, true);
    const decalageRep = v.getUint32(fin + 16, true);
    const commentaire = v.getUint16(fin + 20, true);
    if (total === 0xffff || surDisque === 0xffff || tailleRep === 0xffffffff || decalageRep === 0xffffffff) return refus("Archive ZIP64 non acceptée.");
    if (disque !== 0 || disqueRepertoire !== 0 || surDisque !== total) return refus("Archive en plusieurs parties : refusée.");
    if (fin + TAILLE_FIN + commentaire !== octets.length) return refus("Archive avec des octets en trop après sa fin : refusée.");
    if (decalageRep + tailleRep > fin) return refus("Répertoire de l'archive hors du fichier : refusée.");
    const decodeur = new TextDecoder("utf-8", { fatal: true });
    const entrees: EntreeZip[] = [];
    let p = decalageRep;
    const limite = decalageRep + tailleRep;
    for (let k = 0; k < total; k++) {
      if (p + 46 > limite || v.getUint32(p, true) !== SIG_CENTRAL) return refus("Répertoire de l'archive corrompu : refusé.");
      const drapeaux = v.getUint16(p + 8, true);
      const methode = v.getUint16(p + 10, true);
      const crc = v.getUint32(p + 16, true);
      const tc = v.getUint32(p + 20, true);
      const td = v.getUint32(p + 24, true);
      const ln = v.getUint16(p + 28, true);
      const le = v.getUint16(p + 30, true);
      const lc = v.getUint16(p + 32, true);
      const attrExterne = v.getUint32(p + 38, true);
      const local = v.getUint32(p + 42, true);
      if (tc === 0xffffffff || td === 0xffffffff || local === 0xffffffff) return refus("Archive ZIP64 non acceptée.");
      if (p + 46 + ln + le + lc > limite) return refus("Répertoire de l'archive corrompu : refusé.");
      const nomOctets = octets.slice(p + 46, p + 46 + ln);
      let nom: string;
      try {
        nom = decodeur.decode(nomOctets);
      } catch {
        nom = String.fromCharCode(...nomOctets); // nom non UTF-8 : lu octet par octet, les contrôles seront refusés plus loin
      }
      entrees.push({
        nom,
        nomOctets,
        methode,
        chiffre: (drapeaux & 1) !== 0 || (drapeaux & 0x40) !== 0,
        tailleCompressee: tc,
        tailleDecompressee: td,
        crc,
        decalageLocal: local,
        estLien: ((attrExterne >>> 16) & 0o170000) === 0o120000, // quel que soit l'hôte (Unix 3, macOS 19…)
        estDossier: nom.endsWith("/"),
      });
      p += 46 + ln + le + lc;
    }
    if (p !== limite) return refus("Répertoire de l'archive incohérent (nombre d'entrées différent de celui annoncé) : refusé.");
    return { ok: true, entrees, debutRepertoire: decalageRep };
  } catch {
    return refus("Archive illisible.");
  }
}

function estIgnore(nom: string): boolean {
  if (nom.startsWith("__MACOSX/")) return true;
  const dernier = nom.split("/").pop() ?? "";
  return dernier === ".DS_Store" || dernier === "Thumbs.db";
}

export function extensionDe(chemin: string): string {
  const dernier = chemin.split("/").pop() ?? "";
  const i = dernier.lastIndexOf(".");
  return i <= 0 ? "" : dernier.slice(i + 1).toLowerCase();
}

/** Vérifie TOUTES les entrées : un seul refus suffit à refuser l'archive entière. */
export function verifierEntreesZip(entrees: readonly EntreeZip[]): RapportZip {
  const refus: string[] = [];
  const ignores: string[] = [];
  try {
    if (entrees.length > ENTREES_MAX) refus.push(`Trop de fichiers dans le dossier (${entrees.length}, maximum ${ENTREES_MAX}).`);
    const vus = new Map<string, string>();
    let total = 0;
    for (const e of entrees) {
      const n = nomCourt(e.nom);
      const r = (motif: string): void => void refus.push(`« ${n} » : ${motif}.`);
      const nom = e.nom;
      // Chemin : toujours vérifié, même pour une entrée ignorée.
      if (/[\u0000-\u001f\u007f-\u009f]/.test(nom)) r("caractère de contrôle dans le nom");
      if (nom.length > NOM_MAX) r(`nom trop long (maximum ${NOM_MAX} caractères)`);
      if (nom.includes("\\")) r("barre oblique inverse dans le nom");
      if (nom.startsWith("/") || /^[A-Za-z]:/.test(nom)) r("chemin absolu");
      const segments = (e.estDossier ? nom.slice(0, -1) : nom).split("/");
      if (segments.includes("..")) r("chemin qui sort du dossier (« .. »)");
      if (segments.some((s) => s === "" || s === ".")) r("chemin non normal (segment vide ou « . »)");
      if (segments.length > PROFONDEUR_MAX) r(`dossiers trop imbriqués (maximum ${PROFONDEUR_MAX})`);
      if (e.chiffre) r("entrée chiffrée");
      if (e.methode !== 0 && e.methode !== 8) r("méthode de compression non acceptée");
      if (e.estLien) r("lien symbolique");
      const cle = nom.normalize("NFC").toLowerCase().replace(/\/$/, "");
      const deja = vus.get(cle);
      if (deja !== undefined) r(`même nom qu'une autre entrée (« ${nomCourt(deja)} »), à la casse ou à l'accent près`);
      else vus.set(cle, nom);
      if (e.estDossier) {
        if (e.tailleDecompressee !== 0) r("dossier avec un contenu");
        continue;
      }
      if (estIgnore(nom)) {
        ignores.push(nom);
        continue;
      }
      if (!EXTENSIONS_PERMISES.includes(extensionDe(nom))) r("type de fichier non accepté");
      if (e.tailleDecompressee > FICHIER_MAX) r(`fichier trop gros (maximum ${FICHIER_MAX / MO} Mo)`);
      if (e.methode === 0 && e.tailleCompressee !== e.tailleDecompressee) r("tailles incohérentes");
      if (e.tailleDecompressee > 0 && (e.tailleCompressee === 0 || e.tailleDecompressee / e.tailleCompressee > RATIO_COMPRESSION_MAX)) {
        r("taux de compression anormal (archive piégée)");
      }
      total += e.tailleDecompressee;
    }
    if (total > TOTAL_DECOMPRESSE_MAX) refus.push(`Le dossier décompressé dépasse ${TOTAL_DECOMPRESSE_MAX / MO} Mo.`);
  } catch {
    refus.push("Archive illisible.");
  }
  return { ok: refus.length === 0, refus, ignores };
}

// ───────────────────────── Maquette : aucun JS ni ressource externe (défense en profondeur) ─────────────────────────

export interface RefusMaquette {
  chemin: string;
  ligne: number;
  motif: string;
}

const NAMESPACES_PERMIS = /^https?:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink|1999\/xhtml|2000\/xmlns\/?)$/i;

let debutsTexte = "";
let debutsLignes: number[] = [0];
/** Numéro de ligne (à partir de 1) d'un décalage : table des débuts de ligne calculée une fois par texte, recherche dichotomique. */
function ligneDe(texte: string, decalage: number): number {
  if (texte !== debutsTexte) {
    const d = [0];
    for (let i = texte.indexOf("\n"); i !== -1; i = texte.indexOf("\n", i + 1)) d.push(i + 1);
    debutsTexte = texte;
    debutsLignes = d;
  }
  const limite = Math.min(decalage, texte.length);
  let bas = 0;
  let haut = debutsLignes.length - 1;
  while (bas < haut) {
    const milieu = (bas + haut + 1) >> 1;
    if (debutsLignes[milieu]! <= limite) bas = milieu;
    else haut = milieu - 1;
  }
  return bas + 1;
}

/**
 * Balises HTML en UN SEUL passage (pas d'expression régulière : temps linéaire, jamais de retour en arrière).
 * Nom jusqu'à un blanc, « / » ou « > » ; attributs : les valeurs entre guillemets sont sautées d'un bloc ; fin au « > ».
 * Une balise qui n'a pas de fin n'en est pas une. Si la lecture atteint la fin du texte sans avoir vu un guillemet, aucune
 * balise suivante ne peut aboutir : on s'arrête. Un budget borne le reste (cas pathologique : refus, jamais un blocage).
 */
function balisesDe(texte: string): { index: number; texte: string }[] | null {
  const balises: { index: number; texte: string }[] = [];
  const n = texte.length;
  const budget = 40 * n + 1_000_000;
  let depense = 0;
  let debut = texte.indexOf("<");
  while (debut !== -1 && debut < n - 1) {
    const c = texte.charCodeAt(debut + 1) | 32;
    if (c < 97 || c > 122) {
      debut = texte.indexOf("<", debut + 1);
      continue;
    }
    let i = debut + 2;
    let guillemet = false;
    let fin = -1;
    while (i < n) {
      const ch = texte[i]!;
      if (ch === ">") {
        fin = i;
        break;
      }
      if (ch === '"' || ch === "'") {
        guillemet = true;
        const f = texte.indexOf(ch, i + 1);
        if (f === -1) break;
        i = f + 1;
        continue;
      }
      i++;
    }
    depense += i - debut;
    if (depense > budget) return null;
    if (fin !== -1) {
      balises.push({ index: debut, texte: texte.slice(debut, fin + 1) });
      debut = texte.indexOf("<", fin + 1);
    } else {
      if (!guillemet && i >= n) break;
      debut = texte.indexOf("<", debut + 1);
    }
  }
  return balises;
}

/** Une référence (src, href, url(), @import…) est-elle hors du dossier de la maquette ? Retourne le motif ou null. */
const ENTITES_NOMMEES: Record<string, string> = {
  colon: ":", sol: "/", bsol: "\\", tab: "\t", newline: "\n", amp: "&", quot: '"', apos: "'", lpar: "(", rpar: ")",
  period: ".", comma: ",", semi: ";", lt: "<", gt: ">", num: "#", quest: "?", equals: "=", percnt: "%", excl: "!",
};

/** Décode les entités HTML (`&#104;`, `&#x68;`, `&colon;`…) comme le fait le navigateur dans un attribut. */
export function decoderEntites(valeur: string): string {
  return valeur.replace(/&(?:#x0*([0-9a-f]{1,6})|#0*(\d{1,7})|([a-z]{2,8}));?/gi, (tout, hex?: string, dec?: string, nom?: string) => {
    if (hex !== undefined || dec !== undefined) {
      const n = hex !== undefined ? parseInt(hex, 16) : Number(dec);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    }
    return ENTITES_NOMMEES[(nom ?? "").toLowerCase()] ?? tout;
  });
}

function referenceInterdite(valeur: string): string | null {
  const v = decoderEntites(valeur).trim().replace(/[\u0000-\u0020]/g, "").toLowerCase();
  if (v === "" || v.startsWith("#")) return null;
  if (/^(https?|wss?|ftp):/.test(v) || v.startsWith("//")) return "adresse externe";
  if (v.startsWith("data:")) return v.startsWith("data:image/") ? null : "données « data: » hors image";
  if (v.startsWith("file:") || v.startsWith("javascript:") || v.startsWith("blob:")) return "adresse non permise";
  if (v.startsWith("/") || v.startsWith("\\")) return "chemin absolu";
  if (v.split(/[\\/]/).includes("..")) return "chemin qui sort du dossier";
  return null;
}

const MOTIFS_JS: readonly { re: RegExp; motif: string }[] = [
  { re: /\bfetch\b/g, motif: "appel réseau « fetch »" },
  { re: /\bXMLHttpRequest\b/g, motif: "appel réseau « XMLHttpRequest »" },
  { re: /\bWebSocket\b/g, motif: "appel réseau « WebSocket »" },
  { re: /\bEventSource\b/g, motif: "appel réseau « EventSource »" },
  { re: /\bsendBeacon\b/g, motif: "appel réseau « sendBeacon »" },
  { re: /\bimportScripts\b/g, motif: "chargement de script « importScripts »" },
  { re: /\beval\b/g, motif: "code évalué « eval »" },
  { re: /\bFunction\b/g, motif: "code évalué « Function »" },
  { re: /\bconstructor\b/g, motif: "code évalué « constructor »" },
  { re: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/g, motif: "code évalué (« setTimeout / setInterval » avec une chaîne)" },
  { re: /\bnew\s+Function\b/g, motif: "code évalué « new Function »" },
  { re: /\bserviceWorker\b/g, motif: "« serviceWorker »" },
  { re: /\bimport\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*\(/g, motif: "import dynamique « import( »" },
  { re: /\bimport\s*[^;'"`]*?\bfrom\s*["'`]\s*(?:https?:|wss?:|\/\/)/g, motif: "import depuis une adresse externe" },
  { re: /["'`]\s*(?:https?:|wss?:)\/\/[^"'`]*/gi, motif: "adresse externe dans une chaîne" },
  { re: /["'`]\s*\/\/[a-z0-9][^"'`]*/gi, motif: "adresse externe (protocole implicite) dans une chaîne" },
];

const ECHAPPEMENTS_SIMPLES: Record<string, string> = { n: "\n", t: "\t", r: "\r", v: "\v", f: "\f", b: " " };

/**
 * Décode les échappements de chaîne et d'identifiant JS : `\uXXXX`, `\u{…}`, `\xNN`, l'octal `\150`, `\/` et tout `\<caractère>`
 * simple, et supprime la continuation de ligne (`\` suivi d'un retour à la ligne), pour que `\u0066etch(` soit vu comme `fetch(`
 * et `"https:\/\/x"` comme `"https://x"`.
 */
export function decoderEchappementsJs(texte: string): string {
  return texte.replace(/\\(?:u\{([0-9a-f]{1,6})\}|u([0-9a-f]{4})|x([0-9a-f]{2})|([0-7]{1,3})|(\r\n|[\n\r\u2028\u2029])|([\s\S]))/gi, (tout, a?: string, b?: string, c?: string, o?: string, nl?: string, autre?: string) => {
    if (nl !== undefined) return "";
    if (o !== undefined) return String.fromCodePoint(parseInt(o, 8));
    if (autre !== undefined) return ECHAPPEMENTS_SIMPLES[autre.toLowerCase()] ?? autre;
    const n = parseInt(a ?? b ?? c ?? "", 16);
    return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : tout;
  });
}

/** Décode les échappements CSS (`\72 `, `\000072`, `\<caractère>`) comme le fait le navigateur ; supprime la continuation de ligne. */
export function decoderEchappementsCss(texte: string): string {
  return texte.replace(/\\(?:([0-9a-f]{1,6})(?:\r\n|[ \t\n\r\f])?|(\r\n|[\n\r\f])|([\s\S]))/gi, (_t, h?: string, nl?: string, autre?: string) => {
    if (nl !== undefined) return "";
    if (h !== undefined) {
      const n = parseInt(h, 16);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "\uFFFD";
    }
    return autre ?? "";
  });
}

function verifierJs(chemin: string, brut: string, base: number, source: string, refus: RefusMaquette[]): void {
  const texte = decoderEchappementsJs(brut);
  for (const { re, motif } of MOTIFS_JS) {
    re.lastIndex = 0;
    for (let m = re.exec(texte); m; m = re.exec(texte)) {
      if (m[0] === "") re.lastIndex++;
      if (motif.startsWith("adresse externe") && NAMESPACES_PERMIS.test(m[0].replace(/^["'`]\s*/, "").replace(/["'`]$/, ""))) continue;
      refus.push({ chemin, ligne: ligneDe(source, base + m.index), motif });
    }
  }
}

function verifierCss(chemin: string, brut: string, base: number, source: string, refus: RefusMaquette[]): void {
  // Barres obliques inverses dans url() / @import : refusées sur le texte brut (adresse masquée).
  for (const m of brut.matchAll(/url\(([^)]*)\)/gi)) {
    if ((m[1] ?? "").includes("\\")) refus.push({ chemin, ligne: ligneDe(source, base + (m.index ?? 0)), motif: "url( ) : barre oblique inverse (adresse masquée)" });
  }
  for (const m of brut.matchAll(/@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)\s;]+))/gi)) {
    if ((m[1] ?? m[2] ?? m[3] ?? "").includes("\\")) refus.push({ chemin, ligne: ligneDe(source, base + (m.index ?? 0)), motif: "@import : barre oblique inverse (adresse masquée)" });
  }
  // Le reste sur le texte décodé : `u\72l(`, `@\69mport`, `\75rl(` sont de vrais `url(` / `@import` pour le navigateur.
  const texte = decoderEchappementsCss(brut);
  for (const m of texte.matchAll(/(?:-webkit-)?image-set\(([^;{}]*)/gi)) {
    for (const c of (m[1] ?? "").matchAll(/"([^"]*)"|'([^']*)'|url\(\s*([^)\s"']*)/gi)) {
      const motif = referenceInterdite(c[1] ?? c[2] ?? c[3] ?? "");
      if (motif) refus.push({ chemin, ligne: ligneDe(source, base + (m.index ?? 0)), motif: `image-set( ) : ${motif}` });
    }
  }
  for (const m of texte.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi)) {
    const motif = referenceInterdite(m[1] ?? m[2] ?? m[3] ?? "");
    if (motif) refus.push({ chemin, ligne: ligneDe(source, base + (m.index ?? 0)), motif: `url( ) : ${motif}` });
  }
  for (const m of texte.matchAll(/@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)\s;]+))/gi)) {
    const motif = referenceInterdite(m[1] ?? m[2] ?? m[3] ?? "");
    if (motif) refus.push({ chemin, ligne: ligneDe(source, base + (m.index ?? 0)), motif: `@import : ${motif}` });
  }
}

/** Vérifie les fichiers html, css et js de la maquette. Les autres types ne sont pas lus ici. */
export function verifierMaquette(fichiers: readonly { chemin: string; texte: string }[]): { ok: boolean; refus: RefusMaquette[] } {
  const refus: RefusMaquette[] = [];
  try {
    for (const { chemin, texte } of fichiers) {
      const ext = extensionDe(chemin);
      if (ext === "js") verifierJs(chemin, texte, 0, texte, refus);
      else if (ext === "css") verifierCss(chemin, texte, 0, texte, refus);
      else if (ext === "html" || ext === "htm") {
        verifierCss(chemin, texte, 0, texte, refus); // <style> et attributs style
        for (const m of texte.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
          verifierJs(chemin, m[1] ?? "", (m.index ?? 0) + m[0].indexOf(m[1] ?? ""), texte, refus);
        }
        for (const m of texte.matchAll(/<\s*(iframe|object|embed|base|frame|frameset|applet)\b/gi)) {
          refus.push({ chemin, ligne: ligneDe(texte, m.index ?? 0), motif: `balise interdite <${m[1]!.toLowerCase()}>` });
        }
        // Attributs on*= : cherchés dans tout le HTML hors <script> (séparés par espace, « / », ou collés à une valeur entre guillemets).
        const horsScripts = texte.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, (x) => " ".repeat(x.length));
        for (const a of horsScripts.matchAll(/[\s/"']on[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi)) {
          const code = decoderEntites(a[1] ?? a[2] ?? a[3] ?? "");
          verifierJs(chemin, code, a.index ?? 0, texte, refus);
        }
        for (const m of texte.matchAll(/<script\b([^>]*)>/gi)) {
          const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i.exec(m[1] ?? "");
          if (!src) continue;
          const valeur = decoderEntites(src[1] ?? src[2] ?? src[3] ?? "").trim().split(/[?#]/)[0] ?? "";
          if (!valeur.toLowerCase().endsWith(".js")) refus.push({ chemin, ligne: ligneDe(texte, m.index ?? 0), motif: "script src : le fichier doit finir par « .js »" });
        }
        for (const m of texte.matchAll(/<meta\b[^>]*>/gi)) {
          if (!/http-equiv\s*=\s*["']?\s*refresh/i.test(decoderEntites(m[0]))) continue;
          refus.push({ chemin, ligne: ligneDe(texte, m.index ?? 0), motif: "redirection automatique « refresh »" });
        }
        for (const m of texte.matchAll(/<form\b[^>]*\baction\s*=/gi)) {
          refus.push({ chemin, ligne: ligneDe(texte, m.index ?? 0), motif: "formulaire avec « action »" });
        }
        // Toutes les balises, toutes les valeurs d'attribut : entités décodées (le navigateur le fait avant tout le reste).
        const balises = balisesDe(texte);
        if (!balises) refus.push({ chemin, ligne: 1, motif: "balises trop imbriquées ou sans fin : maquette illisible" });
        for (const t of balises ?? []) {
          for (const a of t.texte.matchAll(/([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
            const nom = a[1]!.toLowerCase();
            const valeur = decoderEntites(a[2] ?? a[3] ?? a[4] ?? "");
            const ligne = () => ligneDe(texte, t.index + (a.index ?? 0));
            if (nom === "style") {
              const dansStyle: RefusMaquette[] = [];
              verifierCss(chemin, valeur, 0, valeur, dansStyle);
              for (const r of dansStyle) refus.push({ ...r, ligne: ligne() });
            }
            if (nom.startsWith("xmlns") || NAMESPACES_PERMIS.test(valeur.trim())) continue;
            const elements = nom.endsWith("srcset") ? valeur.split(",").map((x) => x.trim().split(/\s+/)[0] ?? "") : [valeur];
            for (const el of elements) {
              const v = el.replace(/^[\u0000-\u0020]+/, "");
              if (/^(?:https?|wss?|ftp):/i.test(v) || v.startsWith("//") || v.startsWith("\\\\")) refus.push({ chemin, ligne: ligne(), motif: `${nom} : adresse externe` });
            }
          }
        }
        for (const m of texte.matchAll(/\b(src|href|action|formaction|poster|srcset|imagesrcset|data|xlink:href|ping|background|manifest|codebase)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi)) {
          const valeur = m[2] ?? m[3] ?? m[4] ?? "";
          const motif = (m[1]!.toLowerCase().endsWith("srcset") ? valeur.split(",").map((s) => s.trim().split(/\s+/)[0] ?? "") : [valeur])
            .map(referenceInterdite)
            .find((x) => x !== null);
          if (motif) refus.push({ chemin, ligne: ligneDe(texte, m.index ?? 0), motif: `${m[1]!.toLowerCase()} : ${motif}` });
        }
      }
    }
  } catch {
    refus.push({ chemin: "", ligne: 0, motif: "maquette illisible" });
  }
  return { ok: refus.length === 0, refus };
}

// ───────────────────────── Données de personnes ─────────────────────────

export type TypeDonnee = "courriel" | "telephone" | "iban" | "carte" | "nir" | "colonne-personne";
export interface Detection {
  type: TypeDonnee;
  ligne: number;
  /** Décalages dans le texte entier (début inclus, fin exclue). */
  debut: number;
  fin: number;
  /** Valeur JSON non chaîne (nombre) : le remplacement est mis entre guillemets pour garder un JSON valide. */
  nu?: boolean;
}
export interface OptionsDonnees {
  /** Chemin du fichier : `.csv` et `.json` déclenchent la détection par colonne. */
  chemin?: string;
  /** Noms d'exemple permis (`charte/noms-neutres.json`, transmis par l'appelant : `src/` n'importe pas `outils/`). */
  nomsNeutres?: ReadonlySet<string>;
}

const DOMAINES_EXEMPLE = new Set(["exemple.fr", "exemple.com", "example.com", "example.org"]);
const COLONNES_PERSONNE = new Set(["nom", "prenom", "prénom", "email", "courriel", "telephone", "téléphone", "adresse", "date_naissance", "iban"]);
const REMPLACEMENTS: Record<Exclude<TypeDonnee, "colonne-personne">, string> = {
  courriel: "contact@exemple.fr",
  telephone: "01 00 00 00 00",
  iban: "FR00 0000 0000 0000 0000 0000 000",
  carte: "0000 0000 0000 0000",
  nir: "0 00 00 00 000 000 00",
};

function luhn(chiffres: string): boolean {
  let somme = 0;
  let double = false;
  for (let i = chiffres.length - 1; i >= 0; i--) {
    let d = chiffres.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    somme += d;
    double = !double;
  }
  return somme % 10 === 0;
}

function iban97(iban: string): boolean {
  const r = iban.slice(4) + iban.slice(0, 4);
  let reste = 0;
  for (const c of r) {
    const v = /\d/.test(c) ? c : String(c.charCodeAt(0) - 55);
    for (const ch of v) reste = (reste * 10 + (ch.charCodeAt(0) - 48)) % 97;
  }
  return reste === 1;
}

function cleNir(brut: string): boolean {
  const n = brut.replace(/[ .]/g, "").toUpperCase();
  if (n.length !== 15) return false;
  let reste = 0;
  for (const c of n.slice(0, 13).replace("2A", "19").replace("2B", "18")) reste = (reste * 10 + (c.charCodeAt(0) - 48)) % 97;
  return 97 - reste === Number(n.slice(13));
}

function toutZero(chaine: string): boolean {
  return /^0+$/.test(chaine.replace(/\D/g, ""));
}

/** Découpe une ligne CSV simple (guillemets, séparateur « , » ou « ; ») en valeurs avec leur position intérieure. */
function decouperLigneCsv(ligne: string, separateur: string): { valeur: string; debut: number; fin: number }[] {
  const sortie: { valeur: string; debut: number; fin: number }[] = [];
  let i = 0;
  while (i <= ligne.length) {
    if (ligne[i] === '"') {
      let j = i + 1;
      while (j < ligne.length && !(ligne[j] === '"' && ligne[j + 1] !== '"')) j += ligne[j] === '"' ? 2 : 1;
      sortie.push({ valeur: ligne.slice(i + 1, j), debut: i + 1, fin: j });
      i = j + 2;
    } else {
      let j = ligne.indexOf(separateur, i);
      if (j === -1) j = ligne.length;
      sortie.push({ valeur: ligne.slice(i, j), debut: i, fin: j });
      i = j + 1;
    }
  }
  return sortie;
}

function valeurNeutre(valeur: string, neutres: ReadonlySet<string> | undefined): boolean {
  const v = valeur.trim();
  if (v === "" || /exemple|example/i.test(v)) return true;
  if (!neutres) return false;
  const minuscule = (s: string): string => s.toLowerCase();
  if (neutres.has(v) || [...neutres].some((x) => minuscule(x) === minuscule(v))) return true;
  const mots = v.split(/[\s,;]+/).filter(Boolean);
  const lower = new Set([...neutres].map(minuscule));
  return mots.length > 0 && mots.every((m) => lower.has(minuscule(m)));
}

function detecterColonnes(texte: string, ext: string, neutres: ReadonlySet<string> | undefined): { debut: number; fin: number; nu?: boolean }[] {
  const trouves: { debut: number; fin: number; nu?: boolean }[] = [];
  if (ext === "json") {
    const ESPACE = /\s/;
    /** Collecte les feuilles chaîne/nombre d'une valeur JSON à partir de `i` ; retourne la fin. */
    const collecter = (i: number): number => {
      while (i < texte.length && ESPACE.test(texte[i]!)) i++;
      const c = texte[i];
      if (c === '"') {
        let j = i + 1;
        while (j < texte.length && texte[j] !== '"') j += texte[j] === "\\" ? 2 : 1;
        if (!valeurNeutre(texte.slice(i + 1, j), neutres)) trouves.push({ debut: i + 1, fin: j });
        return j + 1;
      }
      if (c === "[" || c === "{") {
        const fermant = c === "[" ? "]" : "}";
        let j = i + 1;
        while (j < texte.length) {
          while (j < texte.length && (ESPACE.test(texte[j]!) || texte[j] === ",")) j++;
          if (texte[j] === fermant || j >= texte.length) return j + 1;
          if (c === "{") {
            // clé : on la saute, puis la valeur
            if (texte[j] !== '"') return j + 1;
            j++;
            while (j < texte.length && texte[j] !== '"') j += texte[j] === "\\" ? 2 : 1;
            j++;
            while (j < texte.length && (ESPACE.test(texte[j]!) || texte[j] === ":")) j++;
          }
          const suite = collecter(j);
          if (suite <= j) return j + 1;
          j = suite;
        }
        return j;
      }
      const nombre = /^-?\d[\d.eE+-]*/.exec(texte.slice(i, i + 40));
      if (nombre) {
        // Un nombre n'est pas une chaîne : sa plage est remplacée par un texte entre guillemets (JSON valide).
        trouves.push({ debut: i, fin: i + nombre[0].length, nu: true });
        return i + nombre[0].length;
      }
      return i + 1; // true, false, null…
    };
    for (const m of texte.matchAll(/"((?:[^"\\]|\\.)*)"\s*:\s*/g)) {
      if (!COLONNES_PERSONNE.has(m[1]!.toLowerCase())) continue;
      collecter((m.index ?? 0) + m[0].length);
    }
    return trouves;
  }
  const lignes = texte.split("\n");
  const entete = lignes[0]?.replace(/\r$/, "") ?? "";
  const sep = entete.split(";").length > entete.split(",").length ? ";" : ",";
  const cases = decouperLigneCsv(entete, sep);
  const colonnes = new Set(cases.flatMap((c, i) => (COLONNES_PERSONNE.has(c.valeur.trim().toLowerCase()) ? [i] : [])));
  if (colonnes.size === 0) return trouves;
  let decalage = (lignes[0]?.length ?? 0) + 1;
  for (let l = 1; l < lignes.length; l++) {
    const brute = lignes[l]!.replace(/\r$/, "");
    const valeurs = decouperLigneCsv(brute, sep);
    for (const c of colonnes) {
      const v = valeurs[c];
      if (v && !valeurNeutre(v.valeur, neutres)) trouves.push({ debut: decalage + v.debut, fin: decalage + v.fin });
    }
    decalage += lignes[l]!.length + 1;
  }
  return trouves;
}

/** Détecte les données de personnes. Ne retourne jamais la valeur trouvée, seulement sa place. */
export function detecterDonneesPersonnelles(texte: string, options: OptionsDonnees = {}): Detection[] {
  const bruts: { type: TypeDonnee; debut: number; fin: number; nu?: boolean }[] = [];
  try {
    for (const m of texte.matchAll(/(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]+@([\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,})/gu)) {
      if (!DOMAINES_EXEMPLE.has(m[1]!.toLowerCase())) bruts.push({ type: "courriel", debut: m.index ?? 0, fin: (m.index ?? 0) + m[0].length });
    }
    for (const m of texte.matchAll(/(?<![A-Za-z0-9])FR\d{2}(?:[ ]?[A-Za-z0-9]){23}(?![A-Za-z0-9])/gi)) {
      const compact = m[0].replace(/ /g, "").toUpperCase();
      if (compact.length === 27 && iban97(compact) && !toutZero(compact.slice(2)))
        bruts.push({ type: "iban", debut: m.index ?? 0, fin: (m.index ?? 0) + m[0].length });
    }
    for (const m of texte.matchAll(/(?<!\d)[12][ .]?\d{2}[ .]?(?:0[1-9]|1[0-2]|[2-9]\d)[ .]?(?:\d{2}|2[AB])[ .]?\d{3}[ .]?\d{3}[ .]?\d{2}(?!\d)/gi)) {
      if (cleNir(m[0])) bruts.push({ type: "nir", debut: m.index ?? 0, fin: (m.index ?? 0) + m[0].length });
    }
    for (const m of texte.matchAll(/(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g)) {
      const chiffres = m[0].replace(/\D/g, "");
      if (chiffres.length >= 13 && chiffres.length <= 19 && !toutZero(chiffres) && luhn(chiffres))
        bruts.push({ type: "carte", debut: m.index ?? 0, fin: (m.index ?? 0) + m[0].length });
    }
    for (const m of texte.matchAll(/(?<![\d+])(?:(?:\+|00)33[ .-]?|0)[1-9](?:[ .-]?\d{2}){4}(?!\d)/g)) {
      if (!/^0100000000$/.test(m[0].replace(/\D/g, ""))) bruts.push({ type: "telephone", debut: m.index ?? 0, fin: (m.index ?? 0) + m[0].length });
    }
    const ext = options.chemin ? extensionDe(options.chemin) : "";
    if (ext === "csv" || ext === "json") {
      for (const c of detecterColonnes(texte, ext, options.nomsNeutres)) bruts.push({ type: "colonne-personne", ...c });
    }
  } catch {
    return [];
  }
  // Priorité à l'ordre de découverte ci-dessus : une plage déjà prise n'est pas reprise.
  const pris: { debut: number; fin: number }[] = [];
  const gardes = bruts.filter((b) => {
    if (pris.some((p) => b.debut < p.fin && b.fin > p.debut)) return false;
    pris.push(b);
    return true;
  });
  gardes.sort((a, b) => a.debut - b.debut);
  return gardes.map((b) => ({ ...b, ligne: ligneDe(texte, b.debut) }));
}

/** Remplace chaque donnée détectée par un texte d'exemple fixe (rendu déterministe). */
export function masquerDonneesPersonnelles(texte: string, options: OptionsDonnees = {}): { texte: string; remplacements: { type: TypeDonnee; nombre: number }[] } {
  const trouvees = detecterDonneesPersonnelles(texte, options);
  let numero = 0;
  const remplaces = trouvees.map((d) => ({ d, par: d.type === "colonne-personne" ? (d.nu ? `"Personne exemple ${++numero}"` : `Personne exemple ${++numero}`) : REMPLACEMENTS[d.type] }));
  let sortie = "";
  let curseur = 0;
  for (const { d, par } of remplaces) {
    sortie += texte.slice(curseur, d.debut) + par;
    curseur = d.fin;
  }
  sortie += texte.slice(curseur);
  const nombres = new Map<TypeDonnee, number>();
  for (const d of trouvees) nombres.set(d.type, (nombres.get(d.type) ?? 0) + 1);
  return { texte: sortie, remplacements: [...nombres].map(([type, nombre]) => ({ type, nombre })) };
}

/** Le script de Williams (script*.txt, voix*.txt) n'est JAMAIS masqué ni réécrit. */
export function estFichierScript(chemin: string): boolean {
  const nom = (chemin.split("/").pop() ?? "").toLowerCase();
  return /^(script|voix)[^/]*\.txt$/.test(nom);
}

/** Refus du script qui contient une donnée de personne : type et ligne seulement, jamais la valeur. */
export function refuserScriptAvecDonnees(chemin: string, texte: string): string[] {
  return detecterDonneesPersonnelles(texte).map(
    (d) => `Votre script contient une donnée personnelle (${d.type}, ligne ${d.ligne}) dans « ${nomCourt(chemin)} » : corrigez-le puis renvoyez le dossier.`,
  );
}

export function estImage(chemin: string): boolean {
  return EXTENSIONS_IMAGES.includes(extensionDe(chemin));
}

/** Images (modèle « écran fourni ») : gardées seulement avec la case cochée ; sinon écartées, le reste continue. */
export function trierImages(chemins: readonly string[], attestationImages: boolean): { gardees: string[]; ecartees: string[] } {
  const images = chemins.filter(estImage);
  return attestationImages === true ? { gardees: images, ecartees: [] } : { gardees: [], ecartees: images };
}
