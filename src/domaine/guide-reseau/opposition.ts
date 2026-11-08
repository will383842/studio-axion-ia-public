// Opposition écrite par la personne elle-même (« stop », « arrêtez ») : PUR. Aucun texte n'est jamais envoyé en réponse.
/** Mots d'opposition reçus (comparés sans accents ni casse, mot seul). */
export const MOTS_OPPOSITION: readonly string[] = ["STOP", "ARRET", "ARRETEZ"];

/**
 * Le texte reçu est-il un mot d'opposition ? Mot seul, MÊME tolérance que le déclencheur (`normaliserMot`) : NFKC (pleine chasse),
 * ponctuation, guillemets et émojis de bordure ignorés, sans accents ni casse. Un texte de plusieurs mots n'est jamais une opposition.
 */
export function estMotOpposition(texte: string | null | undefined): boolean {
  if (typeof texte !== "string") return false;
  const t = texte.normalize("NFKC").trim().replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}]+$/u, "");
  const n = t.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  return MOTS_OPPOSITION.includes(n);
}
