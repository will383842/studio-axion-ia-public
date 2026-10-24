/**
 * Les cas PROPOSÉS sur la page « Cas concret MD » : ni déjà traités (vidéo allée au bout), ni retirés par Will. PUR.
 * Un cas traité ou retiré reste visible sur sa page (« Cas déjà faits », « Cas retirés ») avec son bouton pour le remettre.
 */
export function casProposables<T extends { cas: { id: string } }>(liste: readonly T[], traites: { has(id: string): boolean }, retires: { has(id: string): boolean }): T[] {
  return liste.filter((c) => !traites.has(c.cas.id) && !retires.has(c.cas.id));
}
