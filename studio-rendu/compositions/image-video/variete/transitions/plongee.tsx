import React from "react";
/**
 * TRA-D · on entre dans la carte (maquette TraD1) : la carte dont on parle grandit, son contour orange devient le cadre
 * de l'écran et son blanc le remplit (sortie) ; l'écran qui arrive sort de ce blanc pendant que le cadre orange s'ouvre
 * au-delà des bords (entrée). À la jointure, l'écran est blanc des deux côtés (sous la marque). Aucun JSX au niveau module.
 */
import { AbsoluteFill } from "remotion";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { teinte } from "../../../cas-concret/plans/commun";
import type { RectEcran } from "./donnees";

const C = COULEURS_DUO;

export function Plongee({ sens, avance, haut, hauteur, largeur, carte }: { sens: "sortie" | "entree"; avance: number; haut: number; hauteur: number; largeur: number; carte?: RectEcran }) {
  const plein = { x: -40, y: haut - 40, l: largeur + 80, h: hauteur - haut + 80 };
  if (sens === "sortie") {
    const depart = carte ?? { x: largeur * 0.2, y: hauteur * 0.35, l: largeur * 0.6, h: hauteur * 0.15 };
    const u = avance * avance;
    const m = (a: number, b: number) => a + (b - a) * u;
    const r = { x: m(depart.x, plein.x), y: m(depart.y, plein.y), l: m(depart.l, plein.l), h: m(depart.h, plein.h) };
    return (
      <AbsoluteFill style={{ clipPath: `inset(${haut}px 0 0 0)` }}>
        <div style={{ position: "absolute", left: r.x, top: r.y, width: r.l, height: r.h, boxSizing: "border-box", borderRadius: 34 + 62 * u, border: `${6 + 12 * u}px solid ${C.orangeVif}`, background: teinte(C.blanc, Math.min(1, avance * 1.6)), boxShadow: `0 40px 90px ${teinte(C.encre, 0.12)}` }} />
      </AbsoluteFill>
    );
  }
  const u = 1 - (1 - avance) * (1 - avance);
  const ouvert = 40 + 160 * u;
  return (
    <AbsoluteFill style={{ clipPath: `inset(${haut}px 0 0 0)` }}>
      <AbsoluteFill style={{ background: teinte(C.blanc, 1 - u) }} />
      <div style={{ position: "absolute", left: -ouvert, top: haut - ouvert, width: largeur + 2 * ouvert, height: hauteur - haut + 2 * ouvert, boxSizing: "border-box", borderRadius: 96, border: `18px solid ${C.orangeVif}`, opacity: 1 - u }} />
    </AbsoluteFill>
  );
}
