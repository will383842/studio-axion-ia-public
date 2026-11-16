/**
 * Dosage de l'animation (X3-01) : types seulement, aucun comportement.
 * Brique pure, côté Studio seulement, jamais importée par `studio-rendu/**`.
 * Aucune date, aucun hasard.
 */

export const DOSAGES = ["aucun", "sobre", "equilibre", "dynamique"] as const;
export type DosageMotion = (typeof DOSAGES)[number];

export type IdGenerateurDosage =
  | "avocat"
  | "facecam"
  | "facecam-animee"
  | "cas-concret"
  | "tableau"
  | "image-video"
  | "demo-facecam"
  | "tutoriel-outil";

/** Ce qu'un cran retire. Pas de champ pour les sous-titres : ils restent toujours. */
export interface RetraitsDosage {
  cartes: boolean;
  illustrations: boolean;
  texteEcran: boolean;
  zooms: boolean;
  transitions: "franches" | "douces" | "inchangees";
  bandeauNom: boolean;
  effetsSpeciaux: boolean;
  bruitagesParDefaut: "aucun" | "reglage";
}
