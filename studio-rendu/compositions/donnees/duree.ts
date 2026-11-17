/**
 * DURÉE PURE de la composition « tableau de bord » (G4-10a) : aucun import, aucun React, aucun Remotion.
 * Durée totale = les scènes du plan (leur somme couvre `plan.dureeMs`), puis la carte de fin Axion.
 * Le calcul des scènes est le même que `dureeImagesDonnees` (`src/moteurs/montage-donnees/proprietes.ts`), recopié ici
 * pour que le rendu n'importe rien de plus sous `src/` ; un test vérifie l'égalité.
 */

/** Durée de la carte de fin Axion (ms), la même que celle du tutoriel d'outil. */
export const DUREE_CARTE_FIN_MS = 2500;

export function imagesDeDuree(ms: number, fps: number): number {
  return Math.max(1, Math.ceil((ms * fps) / 1000));
}

/** Images du plan de scènes seul (au moins 1). */
export function dureeImagesScenes(plan: { dureeMs: number; format: { fps: number } }): number {
  return imagesDeDuree(plan.dureeMs, plan.format.fps);
}

/** Images de la carte de fin. */
export function dureeImagesCarteFin(fps: number, finMs: number = DUREE_CARTE_FIN_MS): number {
  return imagesDeDuree(finMs, fps);
}

/** Durée totale en images : les scènes, puis la carte de fin. */
export function dureeImagesTableauDeBord(plan: { dureeMs: number; format: { fps: number } }, finMs: number = DUREE_CARTE_FIN_MS): number {
  return dureeImagesScenes(plan) + dureeImagesCarteFin(plan.format.fps, finMs);
}
