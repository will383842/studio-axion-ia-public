/**
 * G4-11-PORTE-a : pièces « gardées » (hors petits objets) : elles n'entrent dans la consigne et dans les plans que si leur
 * id figure dans la liste `objetsPermis` transmise par l'appelant. Liste VIDE : `estGardee` ≡ « famille objet », donc
 * rien ne change. Aucun import (lu aussi par le rendu).
 */
export const PIECES_GARDEES: readonly string[] = [];

export function estGardee(d: { id: string; famille: string }): boolean {
  return d.famille === "objet" || PIECES_GARDEES.includes(d.id);
}
