/**
 * C11-E4 (NEUF, non branché, non inscrit) : présentateur recadré dans un cadre 9:16 neutre (rectangle arrondi uniforme).
 * Vidéo MUETTE, recadrée seulement. Sans adresse : cadre vide, sans erreur.
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION, couleursSur, type FondAxion } from "../../../../src/briques/jetons-motion";
import { entreeEcranCompose, geometrieTelephoneRecadre } from "../../../../src/briques/motion/ecrans-couverture/ecrans-composes";

/** Éteint : aucun branchement. */
export const TELEPHONE_RECADRE_ACTIVE = false;

export type ProprietesTelephoneRecadre = { src?: string; debutImage?: number; fond?: "ivoire" | "noir" };

export function TelephoneRecadre({ src, debutImage = 0, fond = "ivoire" }: ProprietesTelephoneRecadre) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const f: FondAxion = fond === "noir" ? "noir" : "ivoire";
  const g = geometrieTelephoneRecadre({ largeur: width, hauteur: height });
  const e = entreeEcranCompose(frame / fps, 0);
  const aVideo = typeof src === "string" && src.trim() !== "";
  return (
    <AbsoluteFill style={{ background: couleursSur(f).fond, fontFamily: FAMILLE_CSS_AXION }}>
      <div style={{ position: "absolute", left: g.cadre.x, top: g.cadre.y, width: g.cadre.w, height: g.cadre.h, borderRadius: g.cadre.rayon, background: f === "noir" ? CHARTE_AXION.gris : CHARTE_AXION.noir, opacity: e.opacite, transform: `scale(${e.echelle})` }}>
        <div style={{ position: "absolute", left: g.bordPx, top: g.bordPx, width: g.video.w, height: g.video.h, borderRadius: Math.max(0, g.cadre.rayon - g.bordPx), overflow: "hidden", background: CHARTE_AXION.gris }}>
          {aVideo ? <OffthreadVideo src={src as string} trimBefore={debutImage} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        </div>
      </div>
    </AbsoluteFill>
  );
}
