// T-EXT-51c : décompression SÛRE d'un .zip de maquette client. Lecteur ZIP minimal écrit à la main (aucune dépendance) :
// répertoire central + en-têtes locaux, méthodes 0 (stockée) et 8 (deflate). Tout ce qui sort de ce cadre est REFUSÉ.
//
// Découpage : la lecture de l'archive (`lireArchive`, `validerNom`, `extraireOctets`) est PURE (Buffer -> données) ;
// seules `lireArchiveSurDisque`, `creerParents`, `ecrireFichierSur` et `decompresserZip` touchent le disque (node:fs).
//
// Choix « zip imbriqué » : `.zip` n'est PAS dans la liste d'extensions, donc un zip dans le zip est REFUSÉ (jamais
// décompressé, jamais conservé) : une maquette n'a aucune raison d'en contenir un.
// Ce module ne tourne que dans le conteneur de capture (sans réseau, racine en lecture seule, /sortie bornée).
import { accessSync, closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { posix } from "node:path";
import { inflateRawSync } from "node:zlib";

export const LIMITES = {
  tailleArchive: 50 * 1024 * 1024,
  entrees: 2000,
  totalDecompresse: 200 * 1024 * 1024,
  parFichier: 50 * 1024 * 1024,
  /** Ratio décompressé/compressé refusé au-delà, pour toute entrée dont la taille dépasse `seuilRatio`. */
  ratio: 100,
  seuilRatio: 1024 * 1024,
  profondeur: 16,
  octetsNom: 255,
  octetsChemin: 1024,
  /** Nombre maximal de déchets système ignorés (jamais écrits) ; au-delà, l'archive est refusée. */
  ignores: 200,
} as const;
export type Limites = { -readonly [K in keyof typeof LIMITES]: number };

export const EXTENSIONS_AUTORISEES: readonly string[] = ["html", "css", "js", "json", "svg", "png", "jpg", "jpeg", "webp", "woff2", "txt", "md"];

/**
 * Liste FERMÉE de déchets système que les explorateurs ajoutent aux archives : ils sont IGNORÉS (jamais écrits, jamais
 * décompressés), comptés et listés dans le rapport, mais l'archive n'est pas refusée. Tout le reste suit les règles normales.
 * `__MACOSX/**` (fichiers AppleDouble), `.DS_Store`, `Thumbs.db`, `desktop.ini` (casse indifférente), `._*`.
 */
export const DECHETS_NOMS: readonly string[] = [".ds_store", "thumbs.db", "desktop.ini"];
export const DECHETS_PREFIXE_MACOS = "__MACOSX";
export function estDechetSysteme(segments: readonly string[]): boolean {
  if (segments.length > 1 && segments[0] === DECHETS_PREFIXE_MACOS) return true;
  const dernier = segments[segments.length - 1] ?? "";
  return DECHETS_NOMS.includes(dernier.toLowerCase()) || dernier.startsWith("._");
}

/** Drapeaux d'ouverture en écriture : création exclusive, jamais de lien suivi. */
export const DRAPEAUX_ECRITURE = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW;

export type Famille = "archive" | "chemin" | "lien" | "bombe" | "chiffrement" | "format" | "extension" | "sortie";

export class ErreurZip extends Error {
  constructor(readonly famille: Famille, message: string) {
    super(message);
    this.name = "ErreurZip";
  }
}
const refus = (f: Famille, m: string): never => {
  throw new ErreurZip(f, m);
};

export interface EntreeZip {
  nom: string;
  segments: string[];
  dossier: boolean;
  /** Déchet système : validé comme les autres mais jamais écrit. */
  ignoree: boolean;
  methode: 0 | 8;
  crc: number;
  tailleCompressee: number;
  tailleAnnoncee: number;
  decalageLocal: number;
  debutDonnees: number;
}

const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const SIG_FIN = 0x06054b50;
const SIG_ZIP64_LOCALISEUR = 0x07064b50;
const TYPE_MASQUE = 0o170000;

// ---------- CRC32 (table, sans dépendance à la version de node) ----------
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(donnees: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < donnees.length; i++) c = TABLE_CRC[(c ^ donnees[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ---------- noms ----------
/** Valide un nom d'entrée et rend ses segments ; lève ErreurZip("chemin") au moindre doute. */
export function validerNom(nom: string, lim: Limites = LIMITES): { segments: string[]; dossier: boolean } {
  if (nom.length === 0) return refus("chemin", "Nom d'entrée vide.");
  if (/[\u0000-\u001f\u007f-\u009f]/.test(nom)) return refus("chemin", `Nom d'entrée avec caractère nul ou de contrôle : ${JSON.stringify(nom)}.`);
  if (nom.startsWith("/") || nom.startsWith("\\") || /^[A-Za-z]:/.test(nom)) return refus("chemin", `Chemin absolu refusé : ${nom}.`);
  if (nom.includes("\\")) return refus("chemin", `Antislash refusé dans un nom : ${nom}.`);
  if (Buffer.byteLength(nom, "utf8") > lim.octetsChemin) return refus("chemin", `Chemin trop long (> ${lim.octetsChemin} octets).`);
  const dossier = nom.endsWith("/");
  const segments = (dossier ? nom.slice(0, -1) : nom).split("/");
  if (segments.length > lim.profondeur) return refus("chemin", `Profondeur > ${lim.profondeur} : ${nom}.`);
  for (const s of segments) {
    if (s === "") return refus("chemin", `Segment vide dans ${nom}.`);
    // `..` et `.` refusés tels quels ET après décodage pourcentage (« %2e%2e »).
    let decode = s;
    try {
      decode = decodeURIComponent(s);
    } catch {
      /* pas de pourcentage valide : on garde le texte */
    }
    if (s === "." || s === ".." || decode === "." || decode === ".." || /[/\\]/.test(decode)) return refus("chemin", `Segment « ${s} » refusé dans ${nom}.`);
    if (Buffer.byteLength(s, "utf8") > lim.octetsNom) return refus("chemin", `Nom de fichier > ${lim.octetsNom} octets.`);
  }
  return { segments, dossier };
}

const cle = (segments: string[]): string => segments.join("/").normalize("NFC").toLowerCase();

// ---------- lecture du répertoire central (PUR) ----------
export function lireArchive(zip: Buffer, lim: Limites = LIMITES): EntreeZip[] {
  if (zip.length > lim.tailleArchive) return refus("bombe", `Archive trop grande (> ${lim.tailleArchive} octets).`);
  if (zip.length < 22) return refus("format", "Fichier trop court pour être un .zip.");
  // Fin du répertoire central : on cherche la dernière signature dont le commentaire va exactement jusqu'à la fin.
  let fin = -1;
  for (let p = zip.length - 22; p >= Math.max(0, zip.length - 22 - 0xffff); p--) {
    if (zip.readUInt32LE(p) === SIG_FIN && p + 22 + zip.readUInt16LE(p + 20) === zip.length) {
      fin = p;
      break;
    }
  }
  if (fin < 0) return refus("format", "Fin de répertoire .zip introuvable (archive tronquée ou données parasites).");
  if (fin >= 20 && zip.readUInt32LE(fin - 20) === SIG_ZIP64_LOCALISEUR) return refus("format", "ZIP64 non géré : refusé.");
  const disque = zip.readUInt16LE(fin + 4);
  const disqueCentral = zip.readUInt16LE(fin + 6);
  const surDisque = zip.readUInt16LE(fin + 8);
  const total = zip.readUInt16LE(fin + 10);
  const tailleCentral = zip.readUInt32LE(fin + 12);
  const decalageCentral = zip.readUInt32LE(fin + 16);
  if (disque !== 0 || disqueCentral !== 0 || surDisque !== total) return refus("format", "Archive multi-disques refusée.");
  if (total === 0xffff || tailleCentral === 0xffffffff || decalageCentral === 0xffffffff) return refus("format", "ZIP64 non géré : refusé.");
  if (total > lim.entrees) return refus("bombe", `Trop d'entrées (${total} > ${lim.entrees}).`);
  if (total === 0) return refus("format", "Archive vide.");
  if (decalageCentral + tailleCentral !== fin) return refus("format", "Répertoire central incohérent (taille ou position).");

  const entrees: EntreeZip[] = [];
  const decodeur = new TextDecoder("utf-8", { fatal: true });
  let p = decalageCentral;
  const clesVues = new Set<string>();
  const dossiersVus = new Set<string>();
  let ignorees = 0;
  for (let i = 0; i < total; i++) {
    if (p + 46 > fin || zip.readUInt32LE(p) !== SIG_CENTRAL) return refus("format", "Entrée du répertoire central illisible.");
    const faitPar = zip.readUInt16LE(p + 4) >>> 8;
    const drapeaux = zip.readUInt16LE(p + 8);
    const methode = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const tailleCompressee = zip.readUInt32LE(p + 20);
    const tailleAnnoncee = zip.readUInt32LE(p + 24);
    const lNom = zip.readUInt16LE(p + 28);
    const lExtra = zip.readUInt16LE(p + 30);
    const lCommentaire = zip.readUInt16LE(p + 32);
    const disqueDebut = zip.readUInt16LE(p + 34);
    const externes = zip.readUInt32LE(p + 38);
    const decalageLocal = zip.readUInt32LE(p + 42);
    const suite = p + 46 + lNom + lExtra + lCommentaire;
    if (suite > fin) return refus("format", "Entrée du répertoire central hors limites.");
    if (disqueDebut !== 0) return refus("format", "Archive multi-disques refusée.");
    if (drapeaux & 0x1 || drapeaux & 0x40 || drapeaux & 0x2000) return refus("chiffrement", "Entrée chiffrée refusée.");
    if (methode !== 0 && methode !== 8) return refus("format", `Méthode de compression ${methode} refusée (seules 0 et 8 sont permises).`);
    if (tailleCompressee === 0xffffffff || tailleAnnoncee === 0xffffffff || decalageLocal === 0xffffffff) return refus("format", "ZIP64 non géré : refusé.");
    let nom: string;
    try {
      nom = decodeur.decode(zip.subarray(p + 46, p + 46 + lNom));
    } catch {
      return refus("chemin", "Nom d'entrée qui n'est pas de l'UTF-8 valide.");
    }
    const { segments, dossier } = validerNom(nom, lim);

    const mode = externes >>> 16;
    const type = mode & TYPE_MASQUE;
    if (type === 0o120000) return refus("lien", `Lien symbolique refusé : ${nom}.`);
    if ((faitPar === 3 || faitPar === 19) && type !== 0 && type !== 0o100000 && type !== 0o040000) {
      return refus("lien", `Type d'entrée non permis (ni fichier ni dossier) : ${nom}.`);
    }
    // Dossier explicite `__MACOSX/` : ignoré aussi (même liste fermée).
    const ignoree = estDechetSysteme(segments) || (dossier && segments.length === 1 && segments[0] === DECHETS_PREFIXE_MACOS);
    if (ignoree && ++ignorees > lim.ignores) return refus("bombe", `Trop de fichiers système à ignorer (> ${lim.ignores}).`);
    if (type === 0o040000 && !dossier) return refus("format", `Entrée dossier sans « / » final : ${nom}.`);
    if (type === 0o100000 && dossier) return refus("format", `Entrée fichier avec « / » final : ${nom}.`);
    if (dossier) {
      if (tailleAnnoncee !== 0) return refus("format", `Dossier avec données : ${nom}.`);
    } else {
      const ext = posix.extname(segments[segments.length - 1]!).slice(1).toLowerCase();
      if (!ignoree && !EXTENSIONS_AUTORISEES.includes(ext)) return refus("extension", `Extension non permise pour ${nom} (permises : ${EXTENSIONS_AUTORISEES.join(", ")}).`);
      if (tailleAnnoncee > lim.parFichier) return refus("bombe", `Fichier trop gros (annoncé ${tailleAnnoncee} octets) : ${nom}.`);
      if (methode === 0 && tailleCompressee !== tailleAnnoncee) return refus("format", `Taille stockée incohérente : ${nom}.`);
      if (tailleAnnoncee > lim.seuilRatio && tailleAnnoncee > lim.ratio * Math.max(1, tailleCompressee)) return refus("bombe", `Ratio de compression excessif (> ${lim.ratio}:1) : ${nom}.`);
    }
    const k = cle(segments);
    if (clesVues.has(k)) return refus("chemin", `Nom en double (casse ou normalisation Unicode comprises) : ${nom}.`);
    clesVues.add(k);
    // Un fichier ne peut pas aussi servir de dossier parent (a et a/b).
    for (let d = 1; d < segments.length; d++) dossiersVus.add(cle(segments.slice(0, d)));
    if (dossier) dossiersVus.add(k);

    // En-tête local : doit dire la même chose que le central.
    if (decalageLocal + 30 > decalageCentral || zip.readUInt32LE(decalageLocal) !== SIG_LOCAL) return refus("format", `En-tête local introuvable : ${nom}.`);
    const lDrapeaux = zip.readUInt16LE(decalageLocal + 6);
    const lMethode = zip.readUInt16LE(decalageLocal + 8);
    const lNomLong = zip.readUInt16LE(decalageLocal + 26);
    const lExtraLong = zip.readUInt16LE(decalageLocal + 28);
    if (lDrapeaux & 0x1 || lDrapeaux & 0x40) return refus("chiffrement", `Entrée chiffrée refusée : ${nom}.`);
    if (lMethode !== methode) return refus("format", `Méthode locale ≠ centrale : ${nom}.`);
    const finNom = decalageLocal + 30 + lNomLong;
    if (lNomLong !== lNom || finNom > decalageCentral || !zip.subarray(decalageLocal + 30, finNom).equals(zip.subarray(p + 46, p + 46 + lNom))) {
      return refus("format", `Nom local ≠ nom central : ${nom}.`);
    }
    if (!(lDrapeaux & 0x8)) {
      if (zip.readUInt32LE(decalageLocal + 14) !== crc || zip.readUInt32LE(decalageLocal + 18) !== tailleCompressee || zip.readUInt32LE(decalageLocal + 22) !== tailleAnnoncee) {
        return refus("format", `Tailles ou CRC locaux ≠ centraux : ${nom}.`);
      }
    }
    const debutDonnees = finNom + lExtraLong;
    if (debutDonnees + tailleCompressee > decalageCentral) return refus("format", `Données hors du fichier : ${nom}.`);
    entrees.push({ nom, segments, dossier, ignoree, methode: methode as 0 | 8, crc, tailleCompressee, tailleAnnoncee, decalageLocal, debutDonnees });
    p = suite;
  }
  if (p !== fin) return refus("format", "Répertoire central avec octets en trop.");
  for (const e of entrees) if (!e.dossier && dossiersVus.has(cle(e.segments))) return refus("chemin", `« ${e.nom} » est à la fois fichier et dossier.`);

  // Chevauchement : les plages [en-tête local, fin des données] ne doivent pas se recouvrir (zip quine, bombe par recouvrement).
  const triees = [...entrees].sort((a, b) => a.decalageLocal - b.decalageLocal);
  for (let i = 1; i < triees.length; i++) {
    const avant = triees[i - 1]!;
    if (triees[i]!.decalageLocal < avant.debutDonnees + avant.tailleCompressee) return refus("format", `Entrées qui se chevauchent : ${avant.nom} / ${triees[i]!.nom}.`);
  }
  let annonce = 0;
  for (const e of entrees) annonce += e.tailleAnnoncee;
  if (annonce > lim.totalDecompresse) return refus("bombe", `Taille totale annoncée > ${lim.totalDecompresse} octets.`);
  return entrees;
}

// ---------- extraction d'une entrée (PUR) ----------
/**
 * Rend les octets de l'entrée. NE FAIT PAS CONFIANCE aux tailles annoncées : l'inflation est coupée par zlib
 * (`maxOutputLength`) dès que le PLUS PETIT des plafonds (annoncé+1, par fichier, budget total restant, ratio) est dépassé.
 */
export function extraireOctets(zip: Buffer, e: EntreeZip, budgetRestant: number, lim: Limites = LIMITES): Buffer {
  const brut = zip.subarray(e.debutDonnees, e.debutDonnees + e.tailleCompressee);
  let sortie: Buffer;
  if (e.methode === 0) {
    sortie = Buffer.from(brut);
  } else {
    const plafondRatio = Math.max(lim.seuilRatio, lim.ratio * Math.max(1, e.tailleCompressee));
    const plafond = Math.max(1, Math.min(e.tailleAnnoncee + 1, lim.parFichier, budgetRestant + 1, plafondRatio));
    try {
      sortie = inflateRawSync(brut, { maxOutputLength: plafond });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "ERR_BUFFER_TOO_LARGE") return refus("bombe", `Décompression interrompue (plafond dépassé, taille annoncée mensongère ou bombe) : ${e.nom}.`);
      return refus("format", `Données deflate corrompues : ${e.nom}.`);
    }
  }
  if (sortie.length > lim.parFichier) return refus("bombe", `Fichier trop gros : ${e.nom}.`);
  if (sortie.length > budgetRestant) return refus("bombe", `Taille décompressée totale > ${lim.totalDecompresse} octets.`);
  if (sortie.length > lim.seuilRatio && sortie.length > lim.ratio * Math.max(1, e.tailleCompressee)) return refus("bombe", `Ratio de compression excessif (> ${lim.ratio}:1) : ${e.nom}.`);
  if (sortie.length !== e.tailleAnnoncee) return refus("format", `Taille réelle ≠ taille annoncée : ${e.nom}.`);
  if (crc32(sortie) !== e.crc) return refus("format", `CRC32 faux : ${e.nom}.`);
  return sortie;
}

// ---------- disque (node:fs) ----------
/** Lit l'archive sans suivre de lien et sans dépasser le plafond (taille vérifiée sur le descripteur ouvert). */
export function lireArchiveSurDisque(chemin: string, lim: Limites = LIMITES): Buffer {
  let fd: number;
  try {
    // O_NONBLOCK : une FIFO donnée par erreur ne bloque pas l'ouverture (elle est ensuite refusée par `isFile`).
    fd = openSync(chemin, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch {
    return refus("archive", `Archive illisible ou lien symbolique : ${chemin}.`);
  }
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) return refus("archive", "L'archive n'est pas un fichier ordinaire (ni FIFO, ni périphérique, ni dossier).");
    if (st.size > lim.tailleArchive) return refus("bombe", `Archive trop grande (${st.size} > ${lim.tailleArchive} octets).`);
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** Crée chaque dossier parent en 0o755 ; refuse tout parent qui est un lien symbolique ou n'est pas un dossier. */
export function creerParents(racine: string, segments: readonly string[]): string {
  let courant = racine;
  for (const s of segments) {
    courant = join(courant, s);
    let st;
    try {
      st = lstatSync(courant);
    } catch {
      mkdirSync(courant, { mode: 0o755 });
      continue;
    }
    if (st.isSymbolicLink() || !st.isDirectory()) return refus("lien", `Parent non sûr (lien ou non-dossier) : ${s}.`);
  }
  return courant;
}

export function ecrireFichierSur(chemin: string, octets: Buffer): void {
  let fd: number;
  try {
    fd = openSync(chemin, DRAPEAUX_ECRITURE, 0o644);
  } catch {
    return refus("sortie", `Écriture refusée (fichier déjà présent ou lien) : ${basename(chemin)}.`);
  }
  try {
    let fait = 0;
    while (fait < octets.length) fait += writeSync(fd, octets, fait, octets.length - fait);
  } finally {
    closeSync(fd);
  }
}

function verifierSortie(sortie: string): void {
  const parent = dirname(sortie);
  const conseil = "Donnez un SOUS-DOSSIER du volume de sortie, par exemple /sortie/maquette.";
  if (parent === sortie) return refus("sortie", `La sortie ne peut pas être la racine du disque. ${conseil}`);
  let sp;
  try {
    sp = lstatSync(parent);
  } catch {
    return refus("sortie", `Dossier parent de la sortie introuvable : ${parent}.`);
  }
  if (sp.isSymbolicLink() || !sp.isDirectory()) return refus("sortie", "Le parent de la sortie n'est pas un dossier ordinaire.");
  try {
    accessSync(parent, constants.W_OK | constants.X_OK);
  } catch {
    return refus("sortie", `Le parent de la sortie (${parent}) n'est pas inscriptible (lecture seule ?). ${conseil}`);
  }
  let st;
  try {
    st = lstatSync(sortie);
  } catch {
    return; // n'existe pas : sera créée par renommage
  }
  if (st.isSymbolicLink() || !st.isDirectory()) return refus("sortie", "La sortie existe et n'est pas un dossier ordinaire.");
  // Point de montage (le disque diffère de celui du parent) : on ne peut pas le remplacer par renommage (ex. /sortie elle-même).
  if (st.dev !== sp.dev) return refus("sortie", `La sortie est un point de montage (${sortie}) : elle ne peut pas être remplacée. ${conseil}`);
  if (readdirSync(sortie).length > 0) return refus("sortie", "La sortie existe déjà et n'est pas vide.");
}

export interface Resultat {
  fichiers: number;
  octets: number;
  /** Noms (dans l'archive) des déchets système ignorés, jamais écrits. */
  ignores: string[];
  /** Nombre de temporaires `.decompression-*` périmés (lancement précédent tué) supprimés au démarrage. */
  restesSupprimes: number;
}

/**
 * Supprime les `.decompression-*` FRÈRES de la sortie laissés par un lancement précédent tué (SIGTERM du `timeout`, SIGKILL :
 * le code est synchrone, aucun gestionnaire de signal ne pourrait s'exécuter en cours d'écriture, donc on nettoie au démarrage).
 * Seulement des vrais dossiers (lstat : jamais un lien, jamais un fichier) appartenant à l'uid courant ; `rmSync` récursif ne suit aucun lien.
 * Au mieux : une erreur sur un reste n'arrête pas le lancement.
 * NE JAMAIS lancer `decompresser` en même temps qu'une capture (ou une autre décompression) sur le même /sortie :
 * le nettoyage supprimerait le temporaire du lancement concurrent, et le temporaire frère n'est protégé que par ce rangement.
 */
export function nettoyerRestesTemporaires(parent: string): number {
  let n = 0;
  let noms: string[];
  try {
    noms = readdirSync(parent);
  } catch {
    return 0;
  }
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  for (const nom of noms) {
    if (!nom.startsWith(".decompression-")) continue;
    const chemin = join(parent, nom);
    try {
      const st = lstatSync(chemin);
      if (st.isSymbolicLink() || !st.isDirectory() || (uid !== undefined && st.uid !== uid)) continue;
      rmSync(chemin, { recursive: true, force: true });
      n++;
    } catch {
      /* reste intouchable : on continue */
    }
  }
  return n;
}

/**
 * Décompresse `zip` dans `sortie`. Tout est écrit dans un dossier temporaire frère (même volume), renommé en `sortie`
 * seulement si TOUT est valide ; au moindre échec le temporaire est supprimé : rien de partiel ne reste.
 */
export function decompresserZip(zip: Buffer, sortie: string, lim: Limites = LIMITES): Resultat {
  const cible = resolve(sortie);
  verifierSortie(cible);
  const restesSupprimes = nettoyerRestesTemporaires(dirname(cible));
  const entrees = lireArchive(zip, lim);
  const temp = join(dirname(cible), `.decompression-${process.pid}-${Date.now().toString(36)}`);
  mkdirSync(temp, { mode: 0o755 });
  try {
    let octets = 0;
    let fichiers = 0;
    const ignores: string[] = [];
    for (const e of entrees) {
      if (e.ignoree) {
        ignores.push(e.nom);
        continue;
      }
      const dest = join(temp, ...e.segments);
      if (!dest.startsWith(temp + sep)) return refus("chemin", `Sortie du dossier refusée : ${e.nom}.`);
      if (e.dossier) {
        creerParents(temp, e.segments);
        continue;
      }
      creerParents(temp, e.segments.slice(0, -1));
      const contenu = extraireOctets(zip, e, lim.totalDecompresse - octets, lim);
      ecrireFichierSur(dest, contenu);
      octets += contenu.length;
      fichiers++;
    }
    renameSync(temp, cible);
    return { fichiers, octets, ignores, restesSupprimes };
  } catch (err) {
    rmSync(temp, { recursive: true, force: true });
    throw err;
  }
}
