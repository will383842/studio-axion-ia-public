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
 * Lecture à la manière du navigateur : nom jusqu'à un blanc, « / » ou « > » ; puis attributs. Un guillemet n'ouvre une valeur
 * QUE juste après « = » (blancs permis) ; partout ailleurs (nom d'attribut, valeur sans guillemets, nom de balise), c'est un
 * caractère ordinaire. Les valeurs entre guillemets sont sautées d'un bloc ; fin au « > ». Une balise sans fin n'en est pas une.
 * Un budget borne le total : un dépassement donne `null` (refus « maquette illisible »), jamais un blocage.
 */
const NOM = 0; // nom de balise
const AVANT_ATTR = 1;
const ATTR = 2; // dans un nom d'attribut
const APRES_ATTR = 3; // blancs après un nom d'attribut
const AVANT_VALEUR = 4; // après « = »
const SANS_GUILLEMETS = 5; // dans une valeur sans guillemets

function estBlanc(c: string): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
}

function balisesDe(texte: string): { index: number; texte: string }[] | null {
  const balises: { index: number; texte: string }[] = [];
  const n = texte.length;
  const budget = 16 * n + 1_000_000;
  let depense = 0;
  // Dernière position de chaque guillemet : au-delà, aucun fermant n'existe (pas de parcours répété jusqu'à la fin).
  const dernier: Record<string, number> = { '"': texte.lastIndexOf('"'), "'": texte.lastIndexOf("'") };
  let debut = texte.indexOf("<");
  while (debut !== -1 && debut < n - 1) {
    const c = texte.charCodeAt(debut + 1) | 32;
    if (c < 97 || c > 122) {
      debut = texte.indexOf("<", debut + 1);
      continue;
    }
    let i = debut + 2;
    let etat = NOM;
    let valeurOuverte = false; // un guillemet d'ouverture de valeur a été rencontré dans cette balise
    let fin = -1;
    while (i < n) {
      const ch = texte[i]!;
      if (ch === ">") {
        fin = i;
        break;
      }
      const blanc = estBlanc(ch);
      if (etat === NOM) {
        if (blanc || ch === "/") etat = AVANT_ATTR;
      } else if (etat === AVANT_ATTR) {
        if (!blanc && ch !== "/") etat = ATTR;
      } else if (etat === ATTR) {
        if (blanc) etat = APRES_ATTR;
        else if (ch === "/") etat = AVANT_ATTR;
        else if (ch === "=") etat = AVANT_VALEUR;
      } else if (etat === APRES_ATTR) {
        if (ch === "=") etat = AVANT_VALEUR;
        else if (ch === "/") etat = AVANT_ATTR;
        else if (!blanc) etat = ATTR;
      } else if (etat === AVANT_VALEUR) {
        if (ch === '"' || ch === "'") {
          valeurOuverte = true;
          if (i >= dernier[ch]!) {
            i = n; // guillemet sans fermant : la balise ne se termine pas
            break;
          }
          i = texte.indexOf(ch, i + 1) + 1;
          etat = AVANT_ATTR;
          continue;
        }
        if (!blanc) etat = SANS_GUILLEMETS;
      } else if (blanc) {
        etat = AVANT_ATTR; // SANS_GUILLEMETS
      }
      i++;
    }
    depense += i - debut;
    if (depense > budget) return null;
    if (fin !== -1) {
      balises.push({ index: debut, texte: texte.slice(debut, fin + 1) });
      debut = texte.indexOf("<", fin + 1);
    } else if (!valeurOuverte && i >= n) {
      break; // aucun « > » après `debut`, et aucune valeur sautée : aucune balise suivante ne peut aboutir
    } else {
      debut = texte.indexOf("<", debut + 1);
    }
  }
  return balises;
}

/**
 * Attributs d'UNE balise (texte de `<` à `>`), lus à la main en un seul passage (aucune expression régulière : temps linéaire),
 * avec les mêmes règles que `balisesDe`. Seuls les attributs avec valeur sont rendus.
 */
function attributsDe(balise: string): { nom: string; valeur: string; index: number }[] {
  const sortie: { nom: string; valeur: string; index: number }[] = [];
  const n = balise.length;
  let i = 1;
  while (i < n && !estBlanc(balise[i]!) && balise[i] !== "/" && balise[i] !== ">") i++;
  while (i < n) {
    while (i < n && (estBlanc(balise[i]!) || balise[i] === "/")) i++;
    if (i >= n || balise[i] === ">") break;
    const debutNom = i;
    i++; // le premier caractère fait toujours partie du nom (même « = » ou un guillemet)
    while (i < n && !estBlanc(balise[i]!) && balise[i] !== "=" && balise[i] !== "/" && balise[i] !== ">") i++;
    const nom = balise.slice(debutNom, i);
    while (i < n && estBlanc(balise[i]!)) i++;
    if (balise[i] !== "=") continue;
    i++;
    while (i < n && estBlanc(balise[i]!)) i++;
    let valeur = "";
    const q = balise[i];
    if (q === '"' || q === "'") {
      const f = balise.indexOf(q, i + 1);
      const fin = f === -1 ? n : f;
      valeur = balise.slice(i + 1, fin);
      i = fin + 1;
    } else {
      const d = i;
      while (i < n && !estBlanc(balise[i]!) && balise[i] !== ">") i++;
      valeur = balise.slice(d, i);
    }
    sortie.push({ nom, valeur, index: debutNom });
  }
  return sortie;
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
  let p = texte.indexOf("\\");
  if (p === -1) return texte;
  // Lecture à la main, un seul passage (la version à expression régulière appelait une fonction par échappement : 1 million
  // d'appels sur 2 Mo de `\`) ; mêmes règles : `\u{…}`, `\uXXXX`, `\xNN`, octal, continuation de ligne, `\<caractère>`.
  const n = texte.length;
  const sortie: string[] = [];
  let debut = 0;
  while (p !== -1 && p + 1 < n) {
    const q = p + 1;
    const c = texte[q]!;
    const cb = c === "U" ? "u" : c === "X" ? "x" : c;
    let fin = q + 1;
    let par: string | undefined;
    if (cb === "u" && texte[q + 1] === "{") {
      let j = q + 2;
      while (j < n && j - (q + 2) < 6 && estHex(texte.charCodeAt(j))) j++;
      if (j > q + 2 && texte[j] === "}") {
        const v = parseInt(texte.slice(q + 2, j), 16);
        fin = j + 1;
        par = v <= 0x10ffff ? String.fromCodePoint(v) : texte.slice(p, fin);
      }
    }
    if (par === undefined && cb === "u" && q + 4 < n && estHex(texte.charCodeAt(q + 1)) && estHex(texte.charCodeAt(q + 2)) && estHex(texte.charCodeAt(q + 3)) && estHex(texte.charCodeAt(q + 4))) {
      par = String.fromCodePoint(parseInt(texte.slice(q + 1, q + 5), 16));
      fin = q + 5;
    }
    if (par === undefined && cb === "x" && q + 2 < n && estHex(texte.charCodeAt(q + 1)) && estHex(texte.charCodeAt(q + 2))) {
      par = String.fromCodePoint(parseInt(texte.slice(q + 1, q + 3), 16));
      fin = q + 3;
    }
    if (par === undefined) {
      if (c >= "0" && c <= "7") {
        let j = q + 1;
        while (j < n && j - q < 3 && texte[j]! >= "0" && texte[j]! <= "7") j++;
        par = String.fromCodePoint(parseInt(texte.slice(q, j), 8));
        fin = j;
      } else if (c === "\r" && texte[q + 1] === "\n") {
        par = "";
        fin = q + 2;
      } else if (c === "\n" || c === "\r" || c === " " || c === " ") {
        par = "";
      } else {
        par = ECHAPPEMENTS_SIMPLES[c.toLowerCase()] ?? c;
      }
    }
    sortie.push(texte.slice(debut, p), par);
    debut = fin;
    p = texte.indexOf("\\", fin);
  }
  sortie.push(texte.slice(debut));
  return sortie.join("");
}

function estHex(c: number): boolean {
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
}

/** Décode les échappements CSS (`\72 `, `\000072`, `\<caractère>`) comme le fait le navigateur ; supprime la continuation de ligne. Un seul passage, à la main. */
export function decoderEchappementsCss(texte: string): string {
  let p = texte.indexOf("\\");
  if (p === -1) return texte;
  const n = texte.length;
  const sortie: string[] = [];
  let debut = 0;
  while (p !== -1 && p + 1 < n) {
    const q = p + 1;
    let fin = q + 1;
    let par: string;
    if (estHex(texte.charCodeAt(q))) {
      let j = q + 1;
      while (j < n && j - q < 6 && estHex(texte.charCodeAt(j))) j++;
      const v = parseInt(texte.slice(q, j), 16);
      par = v > 0 && v <= 0x10ffff ? String.fromCodePoint(v) : "�";
      if (texte[j] === "\r" && texte[j + 1] === "\n") j += 2;
      else if (j < n && (texte[j] === " " || texte[j] === "\t" || texte[j] === "\n" || texte[j] === "\r" || texte[j] === "\f")) j++;
      fin = j;
    } else if (texte[q] === "\r" && texte[q + 1] === "\n") {
      par = "";
      fin = q + 2;
    } else if (texte[q] === "\n" || texte[q] === "\r" || texte[q] === "\f") {
      par = "";
    } else {
      par = texte[q]!;
    }
    sortie.push(texte.slice(debut, p), par);
    debut = fin;
    p = texte.indexOf("\\", fin);
  }
  sortie.push(texte.slice(debut));
  return sortie.join("");
}

/** Minuscules ASCII seulement : la longueur ne change jamais (les index restent ceux du texte d'origine). */
function minusculesAscii(texte: string): string {
  return texte.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

/**
 * Les `url(…)` d'un texte CSS : `url(` + blancs + (valeur entre guillemets | valeur sans blanc ni « ) ») + blancs + « ) ».
 * Lecture à la main, temps linéaire : une recherche qui échoue jusqu'à la fin du texte n'est jamais refaite.
 */
function urlsDe(texte: string): { index: number; valeur: string }[] {
  const bas = minusculesAscii(texte);
  const n = texte.length;
  const sortie: { index: number; valeur: string }[] = [];
  const sansFermant: Record<string, boolean> = {};
  let finSansGuillemets = -1; // un « url( » sans guillemets qui s'arrête ici (blanc ou « ) ») a échoué : les suivants avant cette position aussi
  const blancs = (j: number) => {
    while (j < n && /\s/.test(texte[j]!)) j++;
    return j;
  };
  for (let p = bas.indexOf("url("); p !== -1; p = bas.indexOf("url(", p + 1)) {
    const i = blancs(p + 4);
    const q = texte[i];
    if ((q === '"' || q === "'") && !sansFermant[q]) {
      const f = texte.indexOf(q, i + 1);
      if (f === -1) sansFermant[q] = true;
      else {
        const j = blancs(f + 1);
        if (texte[j] === ")") {
          sortie.push({ index: p, valeur: texte.slice(i + 1, f) });
          p = j; // la recherche reprend après la parenthèse
          continue;
        }
      }
    }
    if (i <= finSansGuillemets) continue;
    let j = i;
    while (j < n && texte[j] !== ")" && !/\s/.test(texte[j]!)) j++;
    const k = blancs(j);
    if (texte[k] === ")") {
      sortie.push({ index: p, valeur: texte.slice(i, j) });
      p = k;
    } else finSansGuillemets = j;
  }
  return sortie;
}

/** Première position ≥ `depuis` de `motif`, avec mémoire : une recherche déjà faite n'est jamais refaite (temps linéaire). */
function rechercheMemo(texte: string, motif: RegExp): (depuis: number) => number {
  let derniere = -2;
  let origine = 0;
  return (depuis) => {
    if (derniere === -1 && origine <= depuis) return -1;
    if (derniere >= depuis && origine <= depuis) return derniere;
    motif.lastIndex = depuis;
    const m = motif.exec(texte);
    origine = depuis;
    derniere = m ? m.index : -1;
    return derniere;
  };
}

/**
 * `import(` dynamique (commentaires permis entre `import` et la parenthèse) et `import … from "https://…"` : lus à la main,
 * temps linéaire (les anciennes expressions à `[\s\S]*?` relisaient le texte jusqu'à la fin depuis chaque `import`).
 */
function verifierImports(chemin: string, texte: string, base: number, source: string, refus: RefusMaquette[]): void {
  const prochainFinCom = rechercheMemo(texte, /\*\//g);
  const prochainRetour = rechercheMemo(texte, /\n/g);
  const prochainTerme = rechercheMemo(texte, /[;'"`]/g);
  const verdictFrom = new Map<number, number>(); // par terminateur : position de « from » si suivi d'un guillemet + adresse externe, sinon -1
  const blancs = (j: number) => {
    while (j < texte.length && /\s/.test(texte[j]!)) j++;
    return j;
  };
  for (let p = texte.indexOf("import"); p !== -1; p = texte.indexOf("import", p + 1)) {
    if (p > 0 && /\w/.test(texte[p - 1]!)) continue;
    const e = p + 6;
    let j = blancs(e);
    for (;;) {
      if (texte.startsWith("/*", j)) {
        const k = prochainFinCom(j + 2);
        if (k === -1) break;
        j = blancs(k + 2);
      } else if (texte.startsWith("//", j)) {
        const k = prochainRetour(j + 2);
        if (k === -1) break;
        j = blancs(k + 1);
      } else break;
    }
    if (texte[j] === "(") refus.push({ chemin, ligne: ligneDe(source, base + p), motif: "import dynamique « import( »" });
    const q = prochainTerme(e);
    if (q === -1 || texte[q] === ";") continue;
    let debutFrom = verdictFrom.get(q);
    if (debutFrom === undefined) {
      let r = q;
      while (r > 0 && /\s/.test(texte[r - 1]!)) r--;
      debutFrom = r - 4;
      const ok = debutFrom >= 0 && texte.startsWith("from", debutFrom) && (debutFrom === 0 || !/\w/.test(texte[debutFrom - 1]!));
      const suite = blancs(q + 1);
      debutFrom = ok && /^(?:https?:|wss?:|\/\/)/.test(texte.slice(suite, suite + 8)) ? debutFrom : -1;
      verdictFrom.set(q, debutFrom);
    }
    if (debutFrom >= e) refus.push({ chemin, ligne: ligneDe(source, base + p), motif: "import depuis une adresse externe" });
  }
}

function verifierJs(chemin: string, brut: string, base: number, source: string, refus: RefusMaquette[]): void {
  const texte = decoderEchappementsJs(brut);
  verifierImports(chemin, texte, base, source, refus);
  for (const { re, motif } of MOTIFS_JS) {
    re.lastIndex = 0;
    for (let m = re.exec(texte); m; m = re.exec(texte)) {
      if (m[0] === "") re.lastIndex++;
      if (motif.startsWith("adresse externe") && NAMESPACES_PERMIS.test(m[0].replace(/^["'`]\s*/, "").replace(/["'`]$/, ""))) continue;
      refus.push({ chemin, ligne: ligneDe(source, base + m.index), motif });
    }
  }
}

/** Encodage déclaré : seul « utf-8 » (ou son alias « utf8 ») est permis. Blancs ASCII retirés à la main (temps linéaire). */
function estUtf8(valeur: string): boolean {
  let d = 0;
  let f = valeur.length;
  while (d < f && estBlanc(valeur[d]!)) d++;
  while (f > d && estBlanc(valeur[f - 1]!)) f--;
  const v = minusculesAscii(valeur.slice(d, f));
  return v === "utf-8" || v === "utf8";
}

/** Valeurs `charset=…` d'un `content` de meta (« text/html; charset=iso-2022-jp »), lues à la main en un passage. */
function charsetsDeContent(contenu: string): string[] {
  const bas = minusculesAscii(contenu);
  const sortie: string[] = [];
  // La recherche suivante repart APRÈS la valeur lue (jamais depuis un « charset » déjà inclus dans une valeur : temps linéaire).
  for (let p = bas.indexOf("charset"); p !== -1; ) {
    let j = p + 7;
    while (j < contenu.length && estBlanc(contenu[j]!)) j++;
    if (contenu[j] !== "=") {
      p = bas.indexOf("charset", Math.max(j, p + 7));
      continue;
    }
    j++;
    while (j < contenu.length && estBlanc(contenu[j]!)) j++;
    if (contenu[j] === '"' || contenu[j] === "'") j++;
    while (j < contenu.length && estBlanc(contenu[j]!)) j++;
    const d = j;
    while (j < contenu.length && !estBlanc(contenu[j]!) && contenu[j] !== '"' && contenu[j] !== "'" && contenu[j] !== ";") j++;
    sortie.push(contenu.slice(d, j));
    p = bas.indexOf("charset", Math.max(j, p + 7));
  }
  return sortie;
}

/** `@charset` d'une feuille de style : tout autre encodage que utf-8 (ou une valeur illisible) est refusé. Lecture à la main, un passage. */
function charsetCssNonUtf8(texte: string): number {
  const bas = minusculesAscii(texte);
  for (let p = bas.indexOf("@charset"); p !== -1; p = bas.indexOf("@charset", p + 8)) {
    let j = p + 8;
    while (j < texte.length && /\s/.test(texte[j]!)) j++;
    const q = texte[j];
    let valeur: string | null = null;
    if (q === '"' || q === "'") {
      const f = texte.indexOf(q, j + 1);
      if (f !== -1) valeur = texte.slice(j + 1, f);
    }
    if (valeur === null || !estUtf8(valeur)) return p;
  }
  return -1;
}

/**
 * Déclaration XML (`<?xml version="1.0" encoding="iso-2022-jp"?>`) d'un .html : tout encodage autre que utf-8 (ou une valeur
 * illisible) est refusé. Lecture à la main : chaque recherche repart APRÈS la déclaration lue (temps linéaire).
 */
function declarationXmlNonUtf8(texte: string): number {
  const bas = minusculesAscii(texte);
  for (let p = bas.indexOf("<?xml"); p !== -1; ) {
    let fin = bas.indexOf(">", p + 5);
    if (fin === -1) fin = texte.length;
    const e = bas.indexOf("encoding", p + 5);
    if (e !== -1 && e < fin) {
      let j = e + 8;
      while (j < fin && estBlanc(texte[j]!)) j++;
      let valeur: string | null = null;
      if (texte[j] === "=") {
        j++;
        while (j < fin && estBlanc(texte[j]!)) j++;
        const q = texte[j];
        if (q === '"' || q === "'") {
          const f = texte.indexOf(q, j + 1);
          if (f !== -1 && f < fin) valeur = texte.slice(j + 1, f);
        }
      }
      if (valeur === null || !estUtf8(valeur)) return p;
    }
    p = bas.indexOf("<?xml", Math.max(fin, p + 5));
  }
  return -1;
}

function verifierCss(chemin: string, brut: string, base: number, source: string, refus: RefusMaquette[]): void {
  const pc = charsetCssNonUtf8(brut);
  const pd = pc !== -1 ? pc : charsetCssNonUtf8(decoderEchappementsCss(brut));
  if (pd !== -1) refus.push({ chemin, ligne: ligneDe(source, base + Math.min(pd, brut.length)), motif: "encodage déclaré autre que utf-8 (« @charset »)" });
  // Barres obliques inverses dans url() / @import : refusées sur le texte brut (adresse masquée).
  const basBrut = minusculesAscii(brut);
  for (let p = basBrut.indexOf("url("); p !== -1; ) {
    const f = brut.indexOf(")", p + 4);
    if (f === -1) break; // aucun « ) » plus loin : plus aucun url( ne peut aboutir
    if (brut.slice(p + 4, f).includes("\\")) refus.push({ chemin, ligne: ligneDe(source, base + p), motif: "url( ) : barre oblique inverse (adresse masquée)" });
    p = basBrut.indexOf("url(", f + 1);
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
  for (const u of urlsDe(texte)) {
    const motif = referenceInterdite(u.valeur);
    if (motif) refus.push({ chemin, ligne: ligneDe(source, base + u.index), motif: `url( ) : ${motif}` });
  }
  for (const m of texte.matchAll(/@import\s+(?:url\(\s*)?(?:"([^"]*)"|'([^']*)'|([^)\s;]+))/gi)) {
    const motif = referenceInterdite(m[1] ?? m[2] ?? m[3] ?? "");
    if (motif) refus.push({ chemin, ligne: ligneDe(source, base + (m.index ?? 0)), motif: `@import : ${motif}` });
  }
}

/** Un caractère de contrôle C0 permis seulement : tabulation (9), \n (10), saut de page (12), \r (13). */
const CONTROLE_C0 = /[\u0000-\u0008\u000b\u000e-\u001f]/;

/** Vérifie les fichiers html, css et js de la maquette. Les autres types ne sont pas lus ici. */
export function verifierMaquette(fichiers: readonly { chemin: string; texte: string }[]): { ok: boolean; refus: RefusMaquette[] } {
  const refus: RefusMaquette[] = [];
  try {
    for (const { chemin, texte } of fichiers) {
      const ext = extensionDe(chemin);
      if (ext === "js" || ext === "css" || ext === "html" || ext === "htm") {
        // Caractères de contrôle C0 (sauf tabulation, \n, \r, saut de page) : le navigateur peut en tenir compte (ISO-2022-JP :
        // « ␛(B » est retiré au décodage, `fe␛(Btch` devient `fetch`), alors que les contrôles ci-dessous lisent le texte brut.
        const c = CONTROLE_C0.exec(texte);
        if (c) refus.push({ chemin, ligne: ligneDe(texte, c.index), motif: "caractère de contrôle" });
      }
      if (ext === "js") verifierJs(chemin, texte, 0, texte, refus);
      else if (ext === "css") verifierCss(chemin, texte, 0, texte, refus);
      else if (ext === "html" || ext === "htm") {
        verifierCss(chemin, texte, 0, texte, refus); // <style> et attributs style
        const px = declarationXmlNonUtf8(texte);
        if (px !== -1) refus.push({ chemin, ligne: ligneDe(texte, px), motif: "encodage déclaré autre que utf-8 (déclaration XML)" });
        // Balises lues une fois, en un passage (aucune expression régulière à retour en arrière : temps linéaire).
        const balises = balisesDe(texte);
        if (!balises) refus.push({ chemin, ligne: 1, motif: "balises trop imbriquées ou sans fin : maquette illisible" });
        const bas = minusculesAscii(texte);
        const plages: { debut: number; fin: number }[] = []; // plages <script>…</script> (contenu à vérifier comme du JS)
        let finScript = 0;
        let plusDeFermant = false;
        for (const t of balises ?? []) {
          if (t.index < finScript || !/^<script(?![a-z0-9_])/i.test(t.texte)) continue;
          const debutContenu = t.index + t.texte.length;
          let fermant = -1;
          for (let de = debutContenu; !plusDeFermant; ) {
            const k = bas.indexOf("</script", de);
            if (k === -1) {
              plusDeFermant = true;
              break;
            }
            let j = k + 8;
            while (j < texte.length && estBlanc(texte[j]!)) j++;
            if (texte[j] === ">") {
              fermant = k;
              finScript = j + 1;
              break;
            }
            de = k + 1;
          }
          if (fermant === -1) finScript = fermant = texte.length; // script sans fermant : le navigateur exécute tout le reste
          plages.push({ debut: debutContenu, fin: fermant });
          verifierJs(chemin, texte.slice(debutContenu, fermant), debutContenu, texte, refus);
        }
        for (const m of texte.matchAll(/<\s*(iframe|object|embed|base|frame|frameset|applet)\b/gi)) {
          refus.push({ chemin, ligne: ligneDe(texte, m.index ?? 0), motif: `balise interdite <${m[1]!.toLowerCase()}>` });
        }
        // Attributs on*= : cherchés dans tout le HTML hors <script> (séparés par espace, « / », ou collés à une valeur entre guillemets).
        let horsScripts = "";
        let depuis = 0;
        for (const pl of plages) {
          horsScripts += texte.slice(depuis, pl.debut) + " ".repeat(pl.fin - pl.debut);
          depuis = pl.fin;
        }
        horsScripts += texte.slice(depuis);
        for (const a of horsScripts.matchAll(/[\s/"']on[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/gi)) {
          const code = decoderEntites(a[1] ?? a[2] ?? a[3] ?? "");
          verifierJs(chemin, code, a.index ?? 0, texte, refus);
        }
        for (const t of balises ?? []) {
          const nomBalise = /^<([a-z][^\s/>]*)/i.exec(t.texte.slice(0, 64))?.[1]?.toLowerCase() ?? "";
          if (nomBalise !== "script" && nomBalise !== "meta" && nomBalise !== "form") continue;
          for (const a of attributsDe(t.texte)) {
            const nom = a.nom.toLowerCase();
            const ligne = ligneDe(texte, t.index);
            if (nomBalise === "script" && nom === "src") {
              const valeur = decoderEntites(a.valeur).trim().split(/[?#]/)[0] ?? "";
              if (!valeur.toLowerCase().endsWith(".js")) refus.push({ chemin, ligne, motif: "script src : le fichier doit finir par « .js »" });
            } else if (nomBalise === "meta" && nom === "http-equiv" && /^\s*refresh/i.test(decoderEntites(a.valeur))) {
              refus.push({ chemin, ligne, motif: "redirection automatique « refresh »" });
            } else if (nomBalise === "form" && nom === "action") {
              refus.push({ chemin, ligne, motif: "formulaire avec « action »" });
            }
          }
        }
        // Toutes les balises, toutes les valeurs d'attribut : entités décodées (le navigateur le fait avant tout le reste).
        for (const t of balises ?? []) {
          const nomB = /^<([a-z][^\s/>]*)/i.exec(t.texte.slice(0, 64))?.[1]?.toLowerCase() ?? "";
          for (const a of attributsDe(t.texte)) {
            const nom = a.nom.toLowerCase();
            const valeur = decoderEntites(a.valeur);
            const ligne = () => ligneDe(texte, t.index + a.index);
            // Encodage déclaré : seul utf-8 (attribut charset de meta, script, link…, et « charset= » du content d'une meta).
            if (nom === "charset" && !estUtf8(valeur)) refus.push({ chemin, ligne: ligne(), motif: "encodage déclaré autre que utf-8 (attribut charset)" });
            if (nomB === "meta" && nom === "content" && charsetsDeContent(valeur).some((c) => !estUtf8(c))) {
              refus.push({ chemin, ligne: ligne(), motif: "encodage déclaré autre que utf-8 (meta content-type)" });
            }
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

/** "detection-echouee" : la détection elle-même a échoué ; on ne sait pas, donc on refuse (jamais « aucune donnée »). */
export type TypeDonnee = "courriel" | "telephone" | "iban" | "carte" | "nir" | "colonne-personne" | "detection-echouee" | "guillemet-non-ferme";
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
const REMPLACEMENTS: Record<Exclude<TypeDonnee, "colonne-personne" | "detection-echouee" | "guillemet-non-ferme">, string> = {
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

const CELLULE_VIDE: { valeur: string; debut: number; fin: number } = { valeur: "", debut: 0, fin: 0 };

/** Espace séparateur Unicode (catégorie Zs : U+0020, U+00A0, U+1680, U+2000-U+200A, U+202F, U+205F, U+3000), sans expression régulière. */
function estEspaceZs(c: number): boolean {
  return c === 0x20 || c === 0xa0 || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x202f || c === 0x205f || c === 0x3000;
}

/** Caractère de format invisible (BOM, espaces de largeur nulle, marques de sens, césure conditionnelle…). */
function estInvisible(c: number): boolean {
  return c === 0xad || (c >= 0x200b && c <= 0x200f) || (c >= 0x202a && c <= 0x202e) || (c >= 0x2060 && c <= 0x2064) || c === 0xfeff;
}

/**
 * Lit tout le CSV en un seul passage (temps linéaire) : guillemets suivis à travers les retours à la ligne,
 * séparateur « , », « ; » ou tabulation. Chaque valeur garde sa position dans le texte entier.
 * Un guillemet jamais refermé absorbe le reste du texte dans UNE seule cellule : si cette colonne n'est pas une colonne de
 * personne, la suite resterait en clair. `etat.nonFerme` le signale : l'appelant refuse alors le fichier entier
 * (`guillemet-non-ferme`), jamais de rendu sans masquage.
 * Chaque cellule quotée dont la lecture est ambiguë (texte après le guillemet fermant, ou fin de ligne ET séparateur dedans)
 * porte `ambigu` : `detecterColonnes` refuse le fichier si elle n'est pas dans une colonne de personne.
 */
function lireCsv(
  texte: string,
  separateur: string,
  etat: { nonFerme: boolean; pos: number },
  garder = Infinity,
): { valeur: string; debut: number; fin: number; nu?: boolean; ambigu?: boolean }[][] {
  const lignes: { valeur: string; debut: number; fin: number; nu?: boolean; ambigu?: boolean }[][] = [];
  const vide: { valeur: string; debut: number; fin: number; nu?: boolean; ambigu?: boolean }[] = [];
  // `garder` : nombre de lignes dont on garde les cellules ; le reste est seulement parcouru (guillemets suivis, `etat` mis à jour)
  // sans rien allouer : lire tout un gros CSV trois fois (un séparateur à la fois) ne coûte alors qu'un parcours léger.
  let ligne: { valeur: string; debut: number; fin: number; nu?: boolean; ambigu?: boolean }[] = garder > 0 ? [] : vide;
  let toutVide = true; // la ligne en cours ne contient que des cellules vides non quotées
  const n = texte.length;
  let i = 0;
  for (;;) {
    let delimiteur: string | undefined;
    const garde = ligne !== vide;
    // Blancs avant un guillemet ouvrant (`1, "Dupont, Jean"`) : la valeur est lue comme entre guillemets.
    let k0 = i;
    // Les caractères invisibles (BOM U+FEFF, U+200B…) devant le guillemet sont sautés aussi : un lecteur qui les retire lit un guillemet ouvrant.
    while (k0 < n && (estEspaceZs(texte.charCodeAt(k0)) || estInvisible(texte.charCodeAt(k0)) || (texte[k0] === "\t" && separateur !== "\t"))) k0++;
    if (texte[k0] === '"') {
      i = k0;
      let j = i + 1;
      while (j < n && !(texte[j] === '"' && texte[j + 1] !== '"')) j += texte[j] === '"' ? 2 : 1;
      if (j >= n && !etat.nonFerme) {
        etat.nonFerme = true;
        etat.pos = k0;
      }
      const ouvrant = i;
      const fermant = Math.min(j, n);
      i = j + 1;
      while (i < n && texte[i] !== separateur && texte[i] !== "\n") i++;
      delimiteur = texte[i];
      const finReste = (delimiteur === "\n" || i >= n) && i > j + 1 && texte[i - 1] === "\r" ? i - 1 : i;
      if (finReste > j + 1 && texte.slice(j + 1, finReste).trim() !== "") {
        // Texte entre le guillemet fermant et le séparateur (« "Jean" Dupont ») : la plage va jusqu'au séparateur,
        // guillemets compris (remplacement entre guillemets), pour que ce reste ne reste jamais en clair.
        toutVide = false;
        if (garde) ligne.push({ valeur: texte.slice(ouvrant + 1, finReste), debut: ouvrant, fin: finReste, nu: true, ambigu: true });
      } else {
        toutVide = false;
        if (garde) {
          const valeur = texte.slice(ouvrant + 1, fermant);
          // Lecture ambiguë : une cellule quotée qui contient à la fois une fin de ligne ET le séparateur peut être un guillemet égaré
          // refermé par le guillemet d'une autre cellule (`1,"Paris,Jean⏎2,Lyon,"⏎`) : une autre lecture ferait sortir des lignes de leur colonne.
          const ambigu = valeur.includes("\n") && valeur.includes(separateur);
          ligne.push(ambigu ? { valeur, debut: ouvrant + 1, fin: fermant, ambigu: true } : { valeur, debut: ouvrant + 1, fin: fermant });
        }
      }
    } else {
      let j = i;
      while (j < n && texte[j] !== separateur && texte[j] !== "\n") j++;
      delimiteur = texte[j];
      const fin = (delimiteur === "\n" || j >= n) && j > i && texte[j - 1] === "\r" ? j - 1 : j;
      if (fin === i) {
        if (garde) ligne.push(CELLULE_VIDE); // cellule vide : jamais une donnée, aucune allocation
      } else {
        toutVide = false;
        if (garde) ligne.push({ valeur: texte.slice(i, fin), debut: i, fin });
      }
      i = j;
    }
    if (delimiteur === separateur) {
      i += 1;
      continue;
    }
    if (garde && toutVide && lignes.length >= LIGNES_ENTETE_MAX) {
      ligne.length = 0; // ligne entièrement vide après la zone d'en-tête : rien à masquer, le tableau est réutilisé
    } else {
      if (garde) lignes.push(ligne);
      ligne = lignes.length < garder ? [] : vide;
    }
    toutVide = true;
    if (i >= n) break;
    i += 1;
    if (i >= n) break;
  }
  return lignes;
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

/** Retire les caractères de format invisibles (U+200B, U+200D, U+2060, U+FEFF, U+00AD…) : « no​m » doit rester « nom ». */
function sansInvisibles(s: string): string {
  return s.replace(/\p{Cf}/gu, "");
}

/** Nom de colonne normalisé : invisibles retirés, trim, une paire de guillemets englobante retirée, trim, NFKC, minuscules. */
function nomColonne(valeur: string): string {
  let v = sansInvisibles(valeur).trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) v = sansInvisibles(v.slice(1, -1)).trim();
  return v.normalize("NFKC").toLowerCase();
}

/** Nombre de lignes du début d'un CSV où l'on cherche l'en-tête (ligne `sep=;`, titre d'export…). */
const LIGNES_ENTETE_MAX = 10;

function detecterColonnes(
  texteBrut: string,
  ext: string,
  neutres: ReadonlySet<string> | undefined,
  etat: { nonFerme: boolean; pos: number },
): { debut: number; fin: number; nu?: boolean }[] {
  const trouves: { debut: number; fin: number; nu?: boolean }[] = [];
  // « CSV (Macintosh) » : fin de ligne `\r` seule ; fins de ligne Unicode U+2028, U+2029 et U+0085 (NEL). Chacune est remplacée
  // par `\n` (un caractère pour un caractère, positions inchangées) pour la lecture ; `\r\n` reste une seule fin de ligne.
  const texte = ext === "json" ? texteBrut : texteBrut.replace(/\r(?!\n)|[\u2028\u2029\u0085]/g, "\n");
  if (ext === "json") {
    const ESPACE = /\s/;
    /**
     * Collecte les feuilles chaîne/nombre d'une valeur JSON à partir de `debut` ; retourne la fin.
     * SANS récursion (pile explicite) : une imbrication de 200 000 niveaux ne fait jamais déborder la pile.
     */
    const collecter = (debut: number): number => {
      const pile: string[] = [];
      let j = debut;
      let attendValeur = true;
      for (;;) {
        if (attendValeur) {
          while (j < texte.length && ESPACE.test(texte[j]!)) j++;
          const c = texte[j];
          if (c === '"') {
            let k = j + 1;
            while (k < texte.length && texte[k] !== '"') k += texte[k] === "\\" ? 2 : 1;
            if (!valeurNeutre(texte.slice(j + 1, k), neutres)) trouves.push({ debut: j + 1, fin: k });
            j = k + 1;
          } else if (c === "[" || c === "{") {
            pile.push(c === "[" ? "]" : "}");
            j++;
            attendValeur = false;
            continue;
          } else {
            const nombre = /^-?\d[\d.eE+-]*/.exec(texte.slice(j, j + 40));
            if (nombre) {
              // Un nombre n'est pas une chaîne : sa plage est remplacée par un texte entre guillemets (JSON valide).
              trouves.push({ debut: j, fin: j + nombre[0].length, nu: true });
              j += nombre[0].length;
            } else {
              j += 1; // true, false, null…
            }
          }
          if (pile.length === 0) return j;
          attendValeur = false;
          continue;
        }
        const fermant = pile[pile.length - 1]!;
        while (j < texte.length && (ESPACE.test(texte[j]!) || texte[j] === ",")) j++;
        let fini = texte[j] === fermant || j >= texte.length;
        if (!fini && fermant === "}") {
          // clé : on la saute, puis la valeur
          if (texte[j] !== '"') fini = true;
          else {
            j++;
            while (j < texte.length && texte[j] !== '"') j += texte[j] === "\\" ? 2 : 1;
            j++;
            while (j < texte.length && (ESPACE.test(texte[j]!) || texte[j] === ":")) j++;
          }
        }
        if (fini) {
          j++;
          pile.pop();
          if (pile.length === 0) return j;
          continue;
        }
        attendValeur = true;
      }
    };
    // Clés lues à la main, en UN SEUL passage (état dans / hors chaîne) : chaque chaîne est lue une fois, du guillemet ouvrant
    // au fermant, et la lecture suivante commence APRÈS ce fermant ; elle ne repart jamais d'un guillemet déjà lu pour relire
    // le même texte (une recherche par expression régulière, relancée depuis chaque guillemet, était quadratique sur `\"`
    // répété). Une chaîne qui suit un `:` après sa fermeture est une clé. Seule exception, JSON invalide : une chaîne refermée
    // et suivie d'autre chose que `:`, `,`, `}`, `]` (`"Paris, "nom":"Jean"`) laisse son fermant servir d'ouvrant à la suivante ;
    // le texte lu ne se recouvre jamais (chaque octet est lu une fois), donc le temps reste linéaire.
    // Une clé déjà couverte par une valeur collectée plus haut n'est pas reprise.
    let traite = 0;
    const n = texte.length;
    for (let i = texte.indexOf('"'); i !== -1 && i < n; ) {
      let k = i + 1;
      while (k < n && texte[k] !== '"') k += texte[k] === "\\" ? 2 : 1;
      if (k >= n) break; // chaîne jamais refermée : plus aucune clé après elle
      let j = k + 1;
      while (j < n && ESPACE.test(texte[j]!)) j++;
      if (texte[j] === ":") {
        j++;
        while (j < n && ESPACE.test(texte[j]!)) j++;
        if (j > traite && COLONNES_PERSONNE.has(nomColonne(texte.slice(i + 1, k)))) traite = collecter(j);
        i = texte.indexOf('"', k + 1);
      } else if (j < n && texte[j] !== "," && texte[j] !== "}" && texte[j] !== "]") {
        i = k; // JSON invalide : le fermant ouvre la chaîne suivante
      } else {
        i = texte.indexOf('"', k + 1);
      }
    }
    return trouves;
  }
  const finPremiere = texte.indexOf("\n");
  const premiere = (finPremiere === -1 ? texte : texte.slice(0, finPremiere)).replace(/\r$/, "");
  // Ligne `sep=X` d'Excel : X est le séparateur ; sinon séparateur le plus fréquent de la 1re ligne
  // (égalité : « , » puis « ; » puis tabulation), puis les deux autres en repli.
  const declare = /^\p{Cf}*sep=(.)\s*$/iu.exec(premiere)?.[1];
  let sep = ",";
  let meilleur = premiere.split(",").length;
  for (const candidat of [";", "\t"]) {
    const nombre = premiere.split(candidat).length;
    if (nombre > meilleur) {
      sep = candidat;
      meilleur = nombre;
    }
  }
  const candidats = declare ? [declare] : [sep, ...[",", ";", "\t"].filter((x) => x !== sep)];
  // L'en-tête n'est pas forcément la 1re ligne : on prend, parmi les premières lignes, la 1re qui porte un nom de colonne de personne.
  let lignes: ReturnType<typeof lireCsv> = [];
  let colonnes = new Set<number>();
  let indiceEntete = 0;
  // Position de la 1re cellule ambiguë vue dans les premières lignes (sous n'importe quel séparateur essayé) : si aucune colonne
  // de personne n'est trouvée, un guillemet égaré a pu avaler l'en-tête, donc le fichier entier est refusé.
  let ambigueEntete = -1;
  for (const candidat of candidats) {
    lignes = lireCsv(texte, candidat, etat, LIGNES_ENTETE_MAX); // seules les premières lignes sont gardées : l'en-tête est là
    if (ambigueEntete < 0) {
      for (const valeurs of lignes) {
        const a = valeurs.find((v) => v.ambigu);
        if (a) {
          ambigueEntete = a.debut;
          break;
        }
      }
    }
    for (let l = 0; l < Math.min(lignes.length, LIGNES_ENTETE_MAX); l++) {
      const trouvees = (lignes[l] ?? []).flatMap((c, i) => (COLONNES_PERSONNE.has(nomColonne(c.valeur)) ? [i] : []));
      if (trouvees.length > 0) {
        colonnes = new Set(trouvees);
        indiceEntete = l;
        break;
      }
    }
    if (colonnes.size > 0) {
      if (!etat.nonFerme) lignes = lireCsv(texte, candidat, etat); // en-tête trouvé : une seule lecture complète, avec ce séparateur
      break;
    }
  }
  // Guillemet ouvrant jamais refermé (sous l'un des séparateurs essayés) : l'appelant refuse le fichier entier.
  if (etat.nonFerme) return trouves;
  if (colonnes.size === 0) {
    if (ambigueEntete >= 0) {
      etat.nonFerme = true;
      etat.pos = ambigueEntete;
    }
    return trouves;
  }
  // Cellule ambiguë AVANT ou DANS la ligne d'en-tête (titre d'export, en-tête lui-même), quelle que soit sa colonne : le masquage
  // ne commence qu'après l'en-tête, et un guillemet égaré a pu avaler le vrai en-tête. Même refus.
  for (let l = 0; l <= indiceEntete && l < lignes.length; l++) {
    const a = lignes[l]!.find((v) => v.ambigu);
    if (a) {
      etat.nonFerme = true;
      etat.pos = a.debut;
      return trouves;
    }
  }
  // Lecture ambiguë dans une colonne qui n'est PAS de personne (guillemet égaré refermé par un autre guillemet) : les lignes
  // du milieu sortiraient de leur colonne et resteraient en clair. Même refus que le guillemet jamais refermé.
  for (const valeurs of lignes) {
    for (let c = 0; c < valeurs.length; c++) {
      if (valeurs[c]!.ambigu && !colonnes.has(c)) {
        etat.nonFerme = true;
        etat.pos = valeurs[c]!.debut;
        return trouves;
      }
    }
  }
  for (let l = indiceEntete + 1; l < lignes.length; l++) {
    const valeurs = lignes[l]!;
    for (const c of colonnes) {
      const v = valeurs[c];
      if (v && !valeurNeutre(v.valeur, neutres)) trouves.push(v.nu ? { debut: v.debut, fin: v.fin, nu: true } : { debut: v.debut, fin: v.fin });
    }
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
      const etat = { nonFerme: false, pos: 0 };
      const colonnes = detecterColonnes(texte, ext, options.nomsNeutres, etat);
      // Un guillemet jamais refermé fait de tout le reste du fichier une seule cellule : si ce n'est pas une colonne de
      // personne, rien ne serait masqué. On ne rend jamais le fichier : refus, sans recopier la valeur.
      if (etat.nonFerme) return [{ type: "guillemet-non-ferme", ligne: ligneDe(texte, etat.pos), debut: etat.pos, fin: texte.length }];
      for (const c of colonnes) bruts.push({ type: "colonne-personne", ...c });
    }
  } catch {
    // Échec de la détection : jamais « aucune donnée » (le fichier partirait non masqué) ; une détection spéciale force le refus.
    return [{ type: "detection-echouee", ligne: 1, debut: 0, fin: texte.length }];
  }
  // Priorité à l'ordre de découverte ci-dessus : une plage déjà prise n'est pas reprise.
  // Table d'occupation (une case par caractère) : temps linéaire, même priorité qu'avant (ordre de découverte).
  // Une colonne de personne passe en premier et absorbe les détections qu'elle contient (courriel, téléphone…) :
  // la valeur entière est masquée, jamais seulement un morceau (« Jean Dupont jean@orange.fr »).
  // Seule exception : un courriel (ou un autre type) qui forme TOUTE la valeur reste de son type.
  const exacts = new Set<string>();
  for (const b of bruts) if (b.type !== "colonne-personne") exacts.add(`${b.debut}:${b.fin}`);
  const colonnes = bruts.filter((b) => {
    if (b.type !== "colonne-personne") return false;
    if (exacts.size === 0) return true; // aucune autre détection : rien à comparer
    const dedans = texte.slice(b.debut, b.fin);
    const debut = b.debut + (dedans.length - dedans.trimStart().length);
    const fin = b.fin - (dedans.length - dedans.trimEnd().length);
    return !exacts.has(`${debut}:${fin}`);
  });
  const ordonnes = [...colonnes, ...bruts.filter((b) => b.type !== "colonne-personne")];
  const occupe = new Uint8Array(texte.length + 1);
  const gardes = ordonnes.filter((b) => {
    const fin = Math.min(b.fin, texte.length);
    let libre = true;
    for (let i = b.debut; i < fin; i++) {
      if (occupe[i]) {
        libre = false;
        break;
      }
    }
    if (!libre) return false;
    // Une plage vide (debut >= fin) n'occupe rien : elle est gardée comme avant (aucune plage prise ne la chevauche).
    occupe.fill(1, b.debut, fin);
    return true;
  });
  gardes.sort((a, b) => a.debut - b.debut);
  return gardes.map((b) => ({ ...b, ligne: ligneDe(texte, b.debut) }));
}

/** Remplace chaque donnée détectée par un texte d'exemple fixe (rendu déterministe). */
export function masquerDonneesPersonnelles(texte: string, options: OptionsDonnees = {}): { texte: string; remplacements: { type: TypeDonnee; nombre: number }[] } {
  const trouvees = detecterDonneesPersonnelles(texte, options);
  // Détection impossible : on ne rend jamais le texte d'origine comme s'il était propre.
  if (trouvees.some((d) => d.type === "detection-echouee")) return { texte: "", remplacements: [{ type: "detection-echouee", nombre: 1 }] };
  if (trouvees.some((d) => d.type === "guillemet-non-ferme")) return { texte: "", remplacements: [{ type: "guillemet-non-ferme", nombre: 1 }] };
  let numero = 0;
  const remplaces = trouvees.map((d) => ({ d, par: d.type === "colonne-personne" ? (d.nu ? `"Personne exemple ${++numero}"` : `Personne exemple ${++numero}`) : REMPLACEMENTS[d.type as Exclude<TypeDonnee, "colonne-personne" | "detection-echouee" | "guillemet-non-ferme">] }));
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
