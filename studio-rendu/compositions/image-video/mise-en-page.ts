/** Module PUR partagé avec le moteur (contrôle de mise en page Q21) : SEULE SOURCE dans `src/briques/schema-motion/mise-en-page.ts`. */
import { miseEnPageDeHauteurIV } from "../../../src/briques/schema-motion/types";
export * from "../../../src/briques/schema-motion/mise-en-page";
/** Mise en page par format (9:16 inchangé, 4:5 du lot F45) : SEULE SOURCE dans `src/briques/schema-motion/types.ts`. */
export { DECALAGE_REFERENCE_4X5_PX, formatDeHauteurIV, MISE_EN_PAGE_IV, miseEnPageDeHauteurIV, type FormatEcranIV, type MiseEnPageFormatIV } from "../../../src/briques/schema-motion/types";

/**
 * Transformation CSS de la boîte 1080 × 1920 des moments et des objets dans un cadre de hauteur `hauteur` : rien en
 * 9:16 ; en 4:5, la mise en page du 9:16 remontée de 60 px (à poser par `Compositions.tsx`, hors du lot F45).
 */
export function decalageReferenceIV(hauteur: number): string {
  const d = miseEnPageDeHauteurIV(hauteur).decalageReference;
  return d ? `translateY(${-d}px)` : "";
}
