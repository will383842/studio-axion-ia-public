/**
 * CALQUE « PLAN DE SCÈNES » (lot R2) : dessine un plan validé PAR-DESSUS une composition existante (Cas concret, Facecam,
 * Facecam animée), fond transparent, sans toucher à ce qui est dessous. Réutilise `ImagePlan` (pur) ; l'image du plan
 * (25 i/s) est déduite de l'image courante de la composition, quelle que soit sa cadence. Absent : la composition hôte
 * ne rend pas ce composant (aucun changement).
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ImagePlan } from "../../../src/briques/plan-scenes/rendu";
import type { PlanValide } from "../../../src/briques/plan-scenes/schema";
import { chargerJetBrainsMono } from "../petits-objets/polices";
import { chargerManrope } from "./PlanDeScenes";

export function CalquePlanScenes({ plan }: { plan: PlanValide }) {
  chargerManrope();
  // FIX-POLICE-TERMINAL-v20l : la police à chasse fixe ne se charge que si le plan dessine un terminal.
  const terminal = (piece: string) => piece === "objet-terminal-commande";
  if (plan.scenes.some((s) => terminal(s.piece) || s.calques?.some((c) => terminal(c.piece)))) chargerJetBrainsMono();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const image = Math.floor((frame * plan.format.fps) / fps);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <ImagePlan plan={{ ...plan, facecam: true }} image={image} />
    </AbsoluteFill>
  );
}
