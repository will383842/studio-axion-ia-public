/**
 * C11-E4 (NEUF, non branché, non inscrit) : fil de cartes ivoire arrondies avec du texte noir, qui défile vers le haut.
 * Générique : que du texte dans des cartes. Message refusé, absent, ou plus de 6 : fond seul.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../../../src/briques/jetons-motion";
import { geometrieFil, MAX_CARTES_FIL } from "../../../../src/briques/motion/ecrans-couverture/ecrans-composes";
import { textesGeneriques } from "../../../../src/briques/motion/ecrans-couverture/textes-generiques";
import { chargerPoliceMarque } from "../police-marque";

/** Éteint : aucun branchement. */
export const FIL_SOCIAL_GENERIQUE_ACTIVE = false;

const chargerManropeFil = chargerPoliceMarque;

export type ProprietesFilSocialGenerique = { messages?: string[] };

export function FilSocialGenerique({ messages = [] }: ProprietesFilSocialGenerique) {
  chargerManropeFil();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const fond = CHARTE_AXION.gris;
  const valides = messages.length > 0 && messages.length <= MAX_CARTES_FIL && messages.every((m) => typeof m === "string" && m.trim() !== "") && textesGeneriques(messages).length === 0;
  if (!valides) return <AbsoluteFill style={{ background: fond }} />;
  const g = geometrieFil({ largeur: width, hauteur: height, cartes: messages.length, t: frame / fps });
  return (
    <AbsoluteFill style={{ background: fond, fontFamily: FAMILLE_CSS_AXION }}>
      <div style={{ position: "absolute", left: g.zone.x, top: g.zone.y, width: g.zone.w, height: g.zone.h, overflow: "hidden" }}>
        {g.cartes.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: c.x - g.zone.x, top: c.y - g.zone.y, width: c.w, height: c.h, borderRadius: c.rayon, background: CHARTE_AXION.ivoire, color: CHARTE_AXION.noir, display: "flex", alignItems: "center", padding: "0 6%", boxSizing: "border-box", fontWeight: 600, fontSize: Math.round(height * 0.026), lineHeight: 1.2 }}>
            {messages[i]}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}
