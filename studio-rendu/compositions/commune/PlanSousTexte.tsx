/**
 * Chantier 5 (5.05a) : monté nulle part ; 5.05b le pose dans `TexteCompose` après 5.04.
 * Dessin du plan de scènes à l'instant `t` (s), sous le texte, fond transparent. Tout vient des propriétés : aucun
 * `useCurrentFrame`, aucun hasard, aucun son, aucune couleur en dur (elles viennent du plan).
 */
import { AbsoluteFill } from "remotion";
import { imagePlanAuTemps, planDessinableSur } from "../../../src/briques/composition/scene";
import { ImagePlan } from "../../../src/briques/plan-scenes/rendu";
import type { PlanValide } from "../../../src/briques/plan-scenes/schema";
import { chargerManrope } from "../plan-scenes/PlanDeScenes";

export function PlanSousTexte({ plan, t, largeur, hauteur }: { plan?: PlanValide; t: number; largeur: number; hauteur: number }) {
  if (!plan || !planDessinableSur(plan, { largeur, hauteur })) return null;
  const image = imagePlanAuTemps(plan, t);
  if (image === null) return null;
  chargerManrope();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <ImagePlan plan={{ ...plan, facecam: true }} image={image} />
    </AbsoluteFill>
  );
}
