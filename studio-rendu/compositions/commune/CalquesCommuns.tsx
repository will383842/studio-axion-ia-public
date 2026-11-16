/**
 * CALQUES COMMUNS (G2-06) : un seul endroit pour poser, par-dessus n'importe quel générateur, le plan de scènes, les
 * calques ajoutés plus tard et les sous-titres. Ordre fixe, du fond vers le dessus : plan de scènes, `children`,
 * sous-titres (restent lisibles). Propriété absente = rien de rendu ; tout absent = `null`. Aucune valeur par défaut qui
 * dessine, aucune police neuve (Manrope est chargée par `CalquePlanScenes`).
 */
import type { ReactNode } from "react";
import type { PlanValide } from "../../../src/briques/plan-scenes/schema";
import { CalquePlanScenes } from "../plan-scenes/CalquePlanScenes";
import { CalqueSousTitres, type ProprietesCalque } from "../sous-titres/CalqueSousTitres";

export type ProprietesCalquesCommuns = {
  sousTitres?: ProprietesCalque;
  planScenes?: PlanValide;
  /** Calques ajoutés plus tard : au-dessus du plan de scènes, sous les sous-titres. */
  children?: ReactNode;
};

export function CalquesCommuns({ sousTitres, planScenes, children }: ProprietesCalquesCommuns) {
  if (!sousTitres && !planScenes && !children) return null;
  return (
    <>
      {planScenes ? <CalquePlanScenes plan={planScenes} /> : null}
      {children}
      {sousTitres ? <CalqueSousTitres {...sousTitres} /> : null}
    </>
  );
}
