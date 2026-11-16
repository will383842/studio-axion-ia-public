/**
 * C11-E4 (NEUF, non branché, non inscrit) : macro sur une CAPTURE d'écran (image seulement, jamais une vidéo de personne).
 * Zoom vers le foyer, flou progressif hors du foyer (copie floutée dessous, copie nette dessus avec un masque radial).
 */
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../../../src/briques/jetons-motion";
import { progres } from "../../../../src/briques/motion/courbes";
import { geometrieMacro } from "../../../../src/briques/motion/ecrans-couverture/ecrans-composes";

/** Éteint : aucun branchement. */
export const MACRO_INTERFACE_ACTIVE = false;

export type ProprietesMacroInterface = { srcCapture?: string; foyer?: { x: number; y: number } };

export function MacroInterface({ srcCapture, foyer = { x: 0.5, y: 0.5 } }: ProprietesMacroInterface) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const g = geometrieMacro({ largeur: width, hauteur: height, foyer });
  const k = progres(frame / fps, 0, 1.2);
  const echelle = 1 + (g.zoom - 1) * k;
  const origine = `${g.origine.x}px ${g.origine.y}px`;
  const aCapture = typeof srcCapture === "string" && srcCapture.trim() !== "";
  const px = `${(g.origine.x / width) * 100}% ${(g.origine.y / height) * 100}%`;
  const rayonNet = `radial-gradient(circle at ${px}, #000 0%, #000 22%, transparent 55%)`;
  const calque = { position: "absolute" as const, inset: 0, width: "100%", height: "100%", objectFit: "cover" as const };
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.gris, fontFamily: FAMILLE_CSS_AXION, overflow: "hidden" }}>
      {aCapture ? (
        <div style={{ position: "absolute", inset: 0, transform: `scale(${echelle})`, transformOrigin: origine }}>
          <Img src={srcCapture as string} style={{ ...calque, filter: `blur(${(g.flouMaxPx * k).toFixed(2)}px)` }} />
          <div style={{ position: "absolute", inset: 0, WebkitMaskImage: rayonNet, maskImage: rayonNet }}>
            <Img src={srcCapture as string} style={calque} />
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
