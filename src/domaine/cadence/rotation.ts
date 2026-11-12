/**
 * ROTATION DES SUJETS (PUR, déterministe : aucun hasard, aucune horloge).
 * Fixe l'ordre dans lequel un lot de sujets prend ses jours : tri par identifiant (ordre numérique : v2 avant v10), doublons écartés.
 * Le même lot donne donc toujours le même plan, quel que soit l'ordre d'arrivée.
 */
export function ordreRotation<S extends { id: string }>(sujets: readonly S[]): S[] {
  const vus = new Set<string>();
  const uniques = sujets.filter((s) => (vus.has(s.id) ? false : (vus.add(s.id), true)));
  return uniques.sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
