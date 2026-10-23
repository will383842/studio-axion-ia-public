/** Palette des illustrations : les couleurs de la charte (jamais d'autre), plus le blanc de carte. */
import { BLANC_CARTE } from "../../../../src/briques/visuels/couleur-papier";
import { COULEURS } from "../commun/constantes";

export { BLANC_CARTE };

/** Seules valeurs acceptées : une couleur de la charte carrousel ou le blanc de carte (aucune chaîne libre). */
export type CouleurCharte = (typeof COULEURS)[keyof typeof COULEURS] | typeof BLANC_CARTE;

export interface CouleursDessin {
  /** Contours et détails. */
  encre?: CouleurCharte;
  /** Couleur d'accent : matières, épaisseurs, éléments forts. */
  orange?: CouleurCharte;
  /** Fonds de scène, ombres portées, second aplat. */
  pale?: CouleurCharte;
  /** Objets papier. */
  papier?: CouleurCharte;
  /** Motifs discrets posés sur le pâle. */
  creme?: CouleurCharte;
}

export type PaletteDessin = Required<CouleursDessin>;

export function palette(c: CouleursDessin = {}): PaletteDessin {
  return {
    encre: c.encre ?? COULEURS.encre,
    orange: c.orange ?? COULEURS.orange,
    pale: c.pale ?? COULEURS.pale,
    papier: c.papier ?? BLANC_CARTE,
    creme: c.creme ?? COULEURS.creme,
  };
}
