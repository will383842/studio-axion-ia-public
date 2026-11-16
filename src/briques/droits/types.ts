/**
 * REGISTRE DES DROITS — BRIQUE COMMUNE (pièce N, plan ORG-12). PUR, SANS alias « @/ » : lisible par `studio-rendu`.
 * Une entrée par pièce (dessin, son, musique, stylo, police, capture de preuve), un fichier par entrée dans `registre/`.
 */

export const TYPES_PIECE = ["dessin", "son", "musique", "stylo", "police", "capture-preuve", "icone", "animation", "logo-outil"] as const;
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
  /** Famille d'icônes ou d'animations (ex. « feather »). Facultatif (C6-H16). */
  famille?: string;
  /** Version figée de la source importée. */
  versionFigee?: string;
  /** Identifiant SPDX de la licence (ne sert qu'aux imports). */
  spdx?: string;
  /** Chemin du fichier de licence copié dans le dépôt. */
  fichierLicence?: string;
  /** Adresse de la source. */
  adresseSource?: string;
  /** Adresse du texte de la licence. */
  adresseLicence?: string;
  /** Littéral : aucun crédit n'est exigé. */
  creditRequis?: false;
  /** Nombre d'éléments importés. */
  nbElements?: number;
  /** Chemin du manifeste des éléments. */
  manifeste?: string;
}
