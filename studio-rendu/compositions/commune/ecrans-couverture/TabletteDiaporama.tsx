/**
 * C11-E4 (NEUF, non branché, non inscrit) : tablette neutre (rectangle arrondi paysage) dont les diapos changent aux instants fournis
 * (calés sur la voix par l'appelant), avec un fondu court. Sans diapo : tablette vide, sans erreur. Aucun son.
 */
import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../../../src/briques/jetons-motion";
import { progres } from "../../../../src/briques/motion/courbes";
import { diapoAuTemps, entreeEcranCompose, geometrieTablette } from "../../../../src/briques/motion/ecrans-couverture/ecrans-composes";

/** Éteint : aucun branchement. */
export const TABLETTE_DIAPORAMA_ACTIVE = false;
const FONDU_S = 0.25;

export type ProprietesTabletteDiaporama = { diapos?: string[]; instants?: number[] };

export function TabletteDiaporama({ diapos = [], instants = [] }: ProprietesTabletteDiaporama) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const g = geometrieTablette({ largeur: width, hauteur: height });
  const e = entreeEcranCompose(t, 0);
  const idx = Math.min(diapoAuTemps(instants, t), diapos.length - 1);
  return (
    <AbsoluteFill style={{ background: CHARTE_AXION.ivoire, fontFamily: FAMILLE_CSS_AXION }}>
      <div style={{ position: "absolute", left: g.cadre.x, top: g.cadre.y, width: g.cadre.w, height: g.cadre.h, borderRadius: g.cadre.rayon, background: CHARTE_AXION.noir, opacity: e.opacite, transform: `scale(${e.echelle})` }}>
        <div style={{ position: "absolute", left: g.bordPx, top: g.bordPx, width: g.ecran.w, height: g.ecran.h, borderRadius: Math.max(0, g.cadre.rayon - g.bordPx), overflow: "hidden", background: CHARTE_AXION.gris }}>
          {diapos.slice(0, idx + 1).map((src, i) => (
            <Img key={i} src={src} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: progres(t, instants[i], FONDU_S) }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}
