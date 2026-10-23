/**
 * TYPES DES TROIS STYLES DU TABLEAU (16/10/2026). PUR, sans alias « @/ » : importable par Remotion.
 */
import type { PoliceTableau, StyleTableau } from "./styles";
import type { TraitTableau } from "./trace";

/** Objet posé sur le support (dessiné par le rendu, il apparaît avec son élément) : post-it, aimant, carte, ruban, plaque. */
export interface ObjetTableau {
  sorte: "postit" | "aimant" | "carte" | "ruban" | "plaque";
  x: number;
  y: number;
  l: number;
  h: number;
  /** Rotation (degrés). */
  rot?: number;
  c: string;
  /** Dessiné par-dessus l'encre (ruban sur une feuille). */
  dessus?: boolean;
}

/** Ce qu'un élément placé porte dans les trois styles (`ElementPlace.tableau`). */
export interface ElementTableauPlace {
  /** Police, taille (px) et couleur de chaque ligne (dans l'ordre des `lignes` de l'élément). */
  lignes: { police: PoliceTableau; taille: number; couleur: string }[];
  /** Traits tracés AVANT le texte (surligneur, case, médaillon…), puis APRÈS lui (souligné, barre, dessin illustré). */
  avant?: TraitTableau[];
  apres?: TraitTableau[];
  /** Objets posés qui arrivent avec l'élément. */
  objets?: ObjetTableau[];
}

/** Ce que la mise en page des trois styles ajoute (`MiseEnPageReference.tableau`). */
export interface MiseEnPageTableauStyle {
  style: StyleTableau;
  /** Chapitres : un libellé par chapitre (position de sa ligne de texte, px) et sa taille. */
  chapitres: { x: number; y: number; largeur: number; hauteur: number }[];
  tailleChapitre: number;
  /** Surface d'écriture (bord intérieur du cadre, de la feuille, du filet de craie), px. */
  surface: { x: number; y: number; largeur: number; hauteur: number };
  /** Bas du support (cadre, auget, rebord, chevalet), px : sous la bande des sous-titres. */
  basSupport: number;
  /** Zone du contenu (sous la barre des chapitres, au-dessus de la bande) : le filet de craie de l'ardoise l'entoure. */
  contenu: { x: number; y: number; largeur: number; hauteur: number };
}
