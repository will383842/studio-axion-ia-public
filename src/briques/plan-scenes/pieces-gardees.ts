/**
 * G4-11-PORTE-a : pièces « gardées » (hors petits objets) : elles n'entrent dans la consigne et dans les plans que si leur
 * id figure dans la liste `objetsPermis` transmise par l'appelant. Liste de la fiche VL-10 : 3 pièces de la vidéo longue, fermées par défaut ; consigne, validation et retouche restent
 * identiques tant que personne ne les permet. Aucun import (lu aussi par le rendu).
 */
export const PIECES_GARDEES: readonly string[] = [
  // VL-10 : 3 pièces 16:9 de la vidéo longue, fermées tant que `objetsPermis` ne les cite pas.
  "intercalaire-chapitre",
  "flux-ramifie",
  "cadre-capture",
  // G4-11b-2 : courbe à plusieurs séries (2 à 4 courbes sur le même axe), fermée tant que `objetsPermis` ne la cite pas.
  "courbe-series",
];

export function estGardee(d: { id: string; famille: string }): boolean {
  return d.famille === "objet" || PIECES_GARDEES.includes(d.id);
}
