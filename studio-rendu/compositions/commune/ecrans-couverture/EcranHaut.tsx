/**
 * C11-E4 (NEUF, non branché, non inscrit) : écran en haut, intervenant en bas. Vidéos toujours MUETTES, recadrées seulement.
 * Sans adresse : cadre vide, sans erreur. Aucun effet sur l'image de la personne.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../../../src/briques/jetons-motion";
import { entreeEcranCompose, geometrieEcranHaut } from "../../../../src/briques/motion/ecrans-couverture/ecrans-composes";

/** Éteint : aucun branchement. */
export const ECRAN_HAUT_ACTIVE = false;

export type ProprietesEcranHaut = { srcEcran?: string; srcIntervenant?: string; debutImage?: number };

const a = (s?: string) => typeof s === "string" && s.trim() !== "";

export function EcranHaut({ srcEcran, srcIntervenant, debutImage = 0 }: ProprietesEcranHaut) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const g = geometrieEcranHaut({ largeur: width, hauteur: height });
  const e = entreeEcranCompose(frame / fps, 0);
  const cadre = (r: { x: number; y: number; w: number; h: number; rayon: number }, src?: string) => (
    <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.rayon, overflow: "hidden", background: CHARTE_AXION.gris, opacity: e.opacite, transform: `scale(${e.echelle})` }}>
      {a(src) ? <OffthreadVideo src={src as string} trimBefore={debutImage} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
    </div>
  );
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.ivoire, fontFamily: FAMILLE_CSS_AXION }}>
      {cadre(g.ecran, srcEcran)}
      {cadre(g.intervenant, srcIntervenant)}
    </AbsoluteFill>
  );
}
