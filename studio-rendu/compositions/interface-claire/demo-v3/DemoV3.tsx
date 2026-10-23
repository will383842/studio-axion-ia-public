import React from "react";
import type { PlanFacecamAnimee } from "../../../../src/domaine/facecam-animee/plan";
import { VideoAnimee } from "../VideoAnimee";
import plan from "./plan-demo-v3.json";

/**
 * DÉMO v3 (~22 s, 1080 × 1920, 30 i/s) : le VRAI rendu final (`VideoAnimee`) sur un plan qui porte 8 éléments v3 actifs
 * (`sequence-demo.ts`, plan généré par `outils/facecam-animee-v3/generer-plan-demo.ts`). La prise est l'image fixe `prise-commune-1080x1920.png` transformée en
 * vidéo par `rendre-demo.mjs` : AUCUN zoom ni mouvement de la prise (hors la descente sous la carte du haut). Sous-titres agrandis de
 * 25 %, bruitages seulement, AUCUNE musique. Les vidéos des fenêtres sont des placeholders ffmpeg.
 */
export function DemoV3() {
  return <VideoAnimee {...(plan as unknown as PlanFacecamAnimee)} />;
}
