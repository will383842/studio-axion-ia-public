/**
 * TUTORIEL SANS VOIX COMPOSÉ (lot qualité 25-11, QUAL-3) : lit l'image courante, demande à la géométrie (QUAL-1) les
 * éléments posés à cet instant et les dessine. Aucune logique de temps ni de mise en page ici.
 */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { PlanComposeSansVoix } from "../../../../src/briques/plan-scenes/tutoriel/sans-voix/types";
import { chargerManrope } from "../PlanDeScenes";
import { DessinSansVoix } from "./DessinSansVoix";

export function ScenesSansVoix({ plan }: { plan: PlanComposeSansVoix }) {
  chargerManrope();
  const image = useCurrentFrame();
  const tMs = (image * 1000) / plan.format.fps;
  // Branché sur la géométrie de QUAL-1 dès sa fusion.
  return (
    <AbsoluteFill>
      <DessinSansVoix image={{ tMs, fond: "ivoire", elements: [] }} format={plan.format} />
    </AbsoluteFill>
  );
}
