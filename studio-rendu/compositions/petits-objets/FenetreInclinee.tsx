/**
 * FENÊTRE INCLINÉE (X1-03) : enveloppe CSS de la fenêtre d'application C9-18. `perspective` sur le parent,
 * `rotateX/rotateY` sur l'enfant, calculés par `fenetre-inclinee.ts` (pur). Aucune bibliothèque 3D.
 * Aucun branchement : rien n'importe ce fichier (non inscrit, éteint).
 */
import type { JSX } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FenetreInclineeVue, type PropsFenetreInclinee } from "../../../src/briques/motion/petits-objets/fenetre-inclinee";

export function FenetreInclinee(p: Omit<PropsFenetreInclinee, "image" | "fps" | "dureeImages"> & { dureeImages?: number }): JSX.Element {
  const image = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <FenetreInclineeVue {...p} image={image} fps={fps} dureeImages={p.dureeImages ?? durationInFrames} />
    </AbsoluteFill>
  );
}
