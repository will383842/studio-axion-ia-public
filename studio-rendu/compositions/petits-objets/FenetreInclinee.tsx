/**
 * FENÊTRE INCLINÉE (X1-03) : enveloppe CSS de la fenêtre d'application C9-18. `perspective` sur le parent,
 * `rotateX/rotateY` sur l'enfant, calculés par `fenetre-inclinee.ts` (pur). Aucune bibliothèque 3D.
 * Aucun branchement : rien n'importe ce fichier (non inscrit, éteint).
 */
import type { JSX } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { OBJET_FENETRE_APP, type ParametresFenetreApp } from "../../../src/briques/motion/petits-objets/fenetre-app";
import { angleFenetre, styleInclinaison } from "../../../src/briques/motion/petits-objets/fenetre-inclinee";
import type { FondAxion } from "../../../src/briques/jetons-motion";

export interface PropsFenetreInclinee {
  image: number;
  fps: number;
  dureeImages: number;
  fond: FondAxion;
  graine: number;
  parametres: ParametresFenetreApp;
  /** +1 ou −1 : côté de l'inclinaison. */
  sens?: number;
}

/** Vue pure (testable sans Remotion). */
export function FenetreInclineeVue({ image, fps, dureeImages, fond, graine, parametres, sens }: PropsFenetreInclinee): JSX.Element {
  const a = angleFenetre(image / fps, { sens });
  const s = styleInclinaison(a);
  return (
    <div style={{ position: "absolute", inset: 0, perspective: s.perspective }}>
      <div style={{ position: "absolute", inset: 0, transform: s.transform, transformOrigin: "50% 50%" }}>
        {OBJET_FENETRE_APP.Rendu({ image, fps, dureeImages, fond, parametres, ton: "neutre", graine })}
      </div>
    </div>
  );
}

export function FenetreInclinee(p: Omit<PropsFenetreInclinee, "image" | "fps" | "dureeImages"> & { dureeImages?: number }): JSX.Element {
  const image = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <FenetreInclineeVue {...p} image={image} fps={fps} dureeImages={p.dureeImages ?? durationInFrames} />
    </AbsoluteFill>
  );
}
