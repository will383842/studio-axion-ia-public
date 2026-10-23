/**
 * Interface d'un stylo (pièce B du plan, TB-04). PUR, sans alias « @/ » : lu par `studio-rendu`.
 * Un stylo = une image + la position de sa pointe + six gestes (courbes de mouvement). Changer de stylo = changer
 * un identifiant (`pieces.stylo: "crayon/1"`) ; aucun format ne dessine son propre stylo.
 */

export interface Point {
  x: number;
  y: number;
}

/** Rectangle visé par un geste (px de la composition). */
export interface Cible {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/**
 * Courbe de mouvement : fraction de temps `u` (0 à 1, bornée) → position de la POINTE dans la composition.
 * Pure et déterministe : pas de hasard, pas d'horloge. `u = 0` et `u = 1` donnent exactement le départ et l'arrivée.
 */
export type CourbeGeste = (u: number, cible: Cible) => Point;

export const NOMS_GESTES = ["ecrire", "souligner", "entourer", "barrer", "cocher", "pointer"] as const;
export type NomGeste = (typeof NOMS_GESTES)[number];
export type GestesStylo = Record<NomGeste, CourbeGeste>;

export interface OmbreStylo {
  /** Décalage de l'ombre, en fraction de la hauteur de l'image. */
  decalage: Point;
  /** Flou, en fraction de la hauteur de l'image. */
  flou: number;
  opacite: number;
}

export interface Stylo {
  /** Famille (ex. « crayon »). */
  id: string;
  /** Version de la famille (entier ≥ 1). L'identifiant demandé par un format est « <id>/<version> ». */
  version: number;
  /** Clé publique de l'image (sous `public/`). */
  image: string;
  /** Dimensions de l'image (px) : le rapport largeur/hauteur est celui de l'image. */
  largeur: number;
  hauteur: number;
  /** Pointe, en fraction de l'image (0 à 1) : point qui touche la page. */
  pointe: Point;
  /** Inclinaison au repos (degrés, sens horaire, autour de la pointe). */
  angle: number;
  /**
   * Partie PEINTE de l'image (fractions, contours compris) ; absente = toute l'image. Sert à l'empreinte du stylo :
   * un corps rectangulaire de `y0` à `cone`, puis un cône jusqu'à la pointe.
   */
  emprise?: { x0: number; y0: number; x1: number; cone: number };
  ombre: OmbreStylo;
  gestes: GestesStylo;
  /** Identifiant dans le registre des droits (l'entrée est créée par une autre tâche). */
  licence: string;
  /** Image vectorielle en texte (SVG) : le rendu l'embarque sans dépendre d'un fichier copié dans l'image Docker. */
  svg: string;
}
