/**
 * Contrôles du texte COLLÉ ou IMPORTÉ (correcteur 3 : B6, B13 de l'audit B), PUR : utilisé par l'écran et par le
 * serveur. Le texte n'est jamais réécrit : on ne retire que les marques de mise en forme d'un fichier .md.
 */

export const MESSAGE_TROP_COURT = "Ce texte est trop court.";
/** Un fichier importé pèse au plus 5 Mo. */
export const TAILLE_MAX_IMPORT = 5 * 1024 * 1024;
export const MESSAGE_TROP_LOURD = "Ce fichier dépasse 5 Mo : il est trop lourd.";
export const MESSAGE_TYPE_REFUSE = "Ce type de fichier n'est pas lu. Choisissez un fichier .txt, .md, .docx ou .pdf.";
export const MESSAGE_ILLISIBLE = "Ce fichier n'a pas pu être lu. Ouvrez-le, copiez le texte et collez-le.";
export const MESSAGE_FICHIER_VIDE = "Ce fichier ne contient pas de texte.";
/** VERIF-E2E-1 (B) : un .pdf scanné est une image, pas du texte ; Will a deux pistes simples. */
export const MESSAGE_PDF_SCANNE = "Ce fichier est une image (un scan) : le studio ne peut pas en lire le texte. Copiez le texte et collez-le, ou dictez-le.";
/**
 * Relecture paquet 4 (sécurité D1) : un script tient en 200 000 caractères au plus (≈ 30 000 mots), bien au-delà d'une
 * vidéo. Au-delà : refus clair, jamais une coupe en silence. Même borne pour un fichier importé, un texte collé et le
 * découpage sur le serveur.
 */
export const TEXTE_MAX_CARACTERES = 200_000;
export const MESSAGE_TEXTE_TROP_LONG = "Ce texte est trop long pour un script (200 000 caractères au plus).";
/** Fichier trop complexe à lire (bombe zip ou PDF, filtre refusé, mémoire ou délai de lecture dépassés, document démesuré). */
export const MESSAGE_FICHIER_TROP_COMPLEXE = "Ce fichier est trop complexe. Ouvrez-le, copiez le texte et collez-le.";
/** Types acceptés par le bouton « Importer un fichier ». */
export const EXTENSIONS_IMPORT = [".txt", ".md", ".docx", ".pdf"] as const;
export type ExtensionImport = (typeof EXTENSIONS_IMPORT)[number];

/** Au moins 3 mots ; sinon « Ce texte est trop court. » (plus jamais ignoré en silence). */
export function verifierTexteColle(texte: string): { ok: true; texte: string } | { ok: false; message: string } {
  const propre = texte.trim();
  if (propre.length > TEXTE_MAX_CARACTERES) return { ok: false, message: MESSAGE_TEXTE_TROP_LONG };
  return propre.split(/\s+/).filter(Boolean).length < 3 ? { ok: false, message: MESSAGE_TROP_COURT } : { ok: true, texte: propre };
}

/** Le fichier peut-il être importé ? .txt et .md : lus dans le navigateur ; .docx et .pdf : lus par le serveur. */
export function verifierFichierImport(f: { nom: string; taille: number }): { ok: true; lecture: "navigateur" | "serveur"; extension: ExtensionImport } | { ok: false; message: string } {
  const point = f.nom.lastIndexOf(".");
  const extension = (point >= 0 ? f.nom.slice(point).toLowerCase() : "") as ExtensionImport;
  if (!EXTENSIONS_IMPORT.includes(extension)) return { ok: false, message: MESSAGE_TYPE_REFUSE };
  if (f.taille > TAILLE_MAX_IMPORT) return { ok: false, message: MESSAGE_TROP_LOURD };
  return { ok: true, lecture: extension === ".txt" || extension === ".md" ? "navigateur" : "serveur", extension };
}

/**
 * VERIF-E2E-1 (B) : texte d'un fichier .txt ou .md, dans le navigateur comme sur le serveur. UTF-8 d'abord (marque
 * d'ordre des octets retirée) ; si ce n'est PAS de l'UTF-8 valide (vieux Bloc-notes, export d'un logiciel métier en
 * Windows-1252 / ISO-8859-1), relu en Windows-1252 : les accents sont gardés, jamais de « � » dans le script.
 */
export function decoderTexteFichier(octets: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    // Table écrite ici : le décodeur « windows-1252 » de Node lit en fait de l'ISO-8859-1 (« œ », « € », « ’ » perdus).
    let texte = "";
    for (const o of octets) texte += o >= 0x80 && o <= 0x9f ? WINDOWS_1252_80_9F[o - 0x80] : String.fromCharCode(o);
    return texte;
  }
}

/** Windows-1252, octets 0x80 à 0x9F (les 5 cases vides de la norme sont lues comme en ISO-8859-1). */
const WINDOWS_1252_80_9F = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";

/** Texte d'un fichier .md : titres, listes, citations, gras, italique et liens perdent leurs marques ; les mots restent. */
export function texteDuMarkdown(md: string): string {
  return md
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s{0,3}>\s?/, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/(\*\*|__)(.+?)\1/g, "$2")
        .replace(/(?<![\p{L}\p{N}])([*_])(.+?)\1(?![\p{L}\p{N}])/gu, "$2"),
    )
    .join("\n");
}
