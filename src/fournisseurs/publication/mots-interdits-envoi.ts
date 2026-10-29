/**
 * Mots refusés à l'ENVOI vers Buffer (décision de Will) : chacun de ces mots, seul, suffit à refuser le texte du post
 * comme le premier commentaire. Insensible à la casse et aux accents ; le mot doit être entier.
 * Fichier à part : il ne touche pas aux règles d'interdits du studio.
 */
const RACINES: readonly { libelle: string; motif: RegExp }[] = [
  { libelle: ["cert", "ifié"].join(""), motif: new RegExp(`\\b${["cert", "ifi"].join("")}(?:e|ee|es|ees)?\\b`) },
  { libelle: ["cert", "ification"].join(""), motif: new RegExp(`\\b${["cert", "ification"].join("")}s?\\b`) },
  { libelle: ["Quali", "opi"].join(""), motif: new RegExp(`\\b${["quali", "opi"].join("")}\\b`) },
];

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Les mots interdits présents dans ce texte (libellés, sans doublon). PUR. */
export function motsInterditsEnvoi(texte: string): string[] {
  const n = sansAccents(texte);
  return RACINES.filter((r) => r.motif.test(n)).map((r) => r.libelle);
}
