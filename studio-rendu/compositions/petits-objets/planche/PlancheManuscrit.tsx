/**
 * PLANCHE « MANUSCRIT » (C9-40a) : post-it et trois bulles (parole, pensée, notification), une case par exemple.
 * Socle commun dans `PlancheEtiquettes`. Pur, aucune image extérieure. Rien d'inscrit.
 */
import type { JSX } from "react";
import type { FondAxion } from "../../../../src/briques/jetons-motion";
import { DEF_POST_IT, EXEMPLES_POST_IT } from "../../../../src/briques/motion/petits-objets/post-it";
import { EXEMPLES_BULLES, OBJET_BULLE_NOTIFICATION, OBJET_BULLE_PAROLE, OBJET_BULLE_PENSEE } from "../../../../src/briques/motion/petits-objets/bulles";
import type { FormatPlanche } from "./PlancheTraits";
import { listerFamille, PlancheDeFamille, type EntreeFamille } from "./PlancheEtiquettes";

export const ENTREES_MANUSCRIT: readonly EntreeFamille[] = [
  ...listerFamille([DEF_POST_IT], EXEMPLES_POST_IT),
  ...listerFamille([OBJET_BULLE_PAROLE, OBJET_BULLE_PENSEE, OBJET_BULLE_NOTIFICATION], EXEMPLES_BULLES),
];

export function PlancheManuscrit({ fond, format, image }: { fond: FondAxion; format: FormatPlanche; image?: number }): JSX.Element {
  return <PlancheDeFamille nom="manuscrit" entrees={ENTREES_MANUSCRIT} fond={fond} format={format} image={image} />;
}
