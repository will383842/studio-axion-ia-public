/**
 * REGISTRE DES DROITS — BRIQUE COMMUNE (pièce N, plan ORG-12). PUR, SANS alias « @/ » : lisible par `studio-rendu`.
 * Une entrée par pièce (dessin, son, musique, stylo, police, capture de preuve), un fichier par entrée dans `registre/`.
 */

export const TYPES_PIECE = ["dessin", "son", "musique", "stylo", "police", "capture-preuve"] as const;
export type TypePiece = (typeof TYPES_PIECE)[number];

export interface EntreeDroit {
  /** Identifiant unique, en minuscules et tirets (ex. « stylo-crayon-1 »). */
  id: string;
  type: TypePiece;
  /** Licence en clair (ex. « ISC », « Création interne Axion-IA »). */
  licence: string;
  auteur: string;
  /** Lien ou mention qui prouve le droit. */
  preuve: string;
  /** Date d'entrée au registre, AAAA-MM-JJ. */
  date: string;
  /** Péremption facultative, AAAA-MM-JJ : le droit n'est plus valide à cette date et après. */
  perimeLe?: string;
}
