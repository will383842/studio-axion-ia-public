/**
 * TUTORIEL SANS VOIX COMPOSÉ (lot qualité 25-11, QUAL-3) : lit l'image courante, demande à la géométrie (QUAL-1) les
 * éléments posés à cet instant et les dessine. Aucune logique de temps ni de mise en page ici.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { imageSansVoixA } from "../../../../src/briques/plan-scenes/tutoriel/sans-voix/geometrie";
import type { PlanComposeSansVoix } from "../../../../src/briques/plan-scenes/tutoriel/sans-voix/types";
import { chargerManrope } from "../PlanDeScenes";
import { DessinSansVoix } from "./DessinSansVoix";

export function ScenesSansVoix({ plan }: { plan: PlanComposeSansVoix }) {
  chargerManrope();
  const image = useCurrentFrame();
  const tMs = (image * 1000) / plan.format.fps;
  return (
    <AbsoluteFill>
      <DessinSansVoix image={imageSansVoixA(plan, tMs)} format={plan.format} />
    </AbsoluteFill>
  );
}
