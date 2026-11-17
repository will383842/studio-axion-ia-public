/**
 * X3-08a : cran du dosage → intensité des sous-titres de l'image→vidéo. Fonction pure, NON branchée
 * (le branchement est X3-08b). `equilibre` ou absence de cran → `undefined` : l'appelant garde sa valeur d'aujourd'hui.
 * `aucun` n'est pas permis pour l'image→vidéo (CRANS_PERMIS) → `undefined`.
 */
import type { IntensiteSousTitres } from "@/domaine/types";
import type { DosageMotion } from "@/briques/dosage-motion/types";

export function intensiteDosageIV(cran: DosageMotion | undefined): IntensiteSousTitres | undefined {
  if (cran === "sobre") return "sobre";
  if (cran === "dynamique") return "tres-dynamique";
  return undefined;
}
