// Opposition écrite par la personne elle-même (« stop », « arrêtez ») : PUR. Aucun texte n'est jamais envoyé en réponse.
/** Mots d'opposition reçus (comparés sans accents ni casse, mot seul). */
export const MOTS_OPPOSITION: readonly string[] = ["STOP", "ARRET", "ARRETEZ"];

/** Le texte reçu est-il un mot d'opposition (mot seul, sans accents ni casse, ponctuation finale tolérée) ? */
export function estMotOpposition(texte: string | null | undefined): boolean {
  if (typeof texte !== "string") return false;
  const n = texte.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase().replace(/[\s.!]+$/u, "").trim();
  return MOTS_OPPOSITION.includes(n);
}
