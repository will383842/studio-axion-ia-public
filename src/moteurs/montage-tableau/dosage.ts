/**
 * Dosage de l'animation (X3-07a) : intensité des sous-titres du tableau selon le cran. PUR, non branché (X3-07b).
 */
import { NIVEAU_DU_DOSAGE } from "@/briques/dosage-motion/crans";
import type { DosageMotion } from "@/briques/dosage-motion/types";
import type { NiveauIntensite } from "@/domaine/types";

/** L'intensité actuelle, rendue telle quelle sans cran ou en équilibre ; sinon le niveau du cran. */
export function intensiteSousTitresTableau(cran: DosageMotion | undefined, actuelle: NiveauIntensite | undefined): NiveauIntensite | undefined {
  if (cran === undefined || cran === "equilibre") return actuelle;
  return NIVEAU_DU_DOSAGE[cran];
}
