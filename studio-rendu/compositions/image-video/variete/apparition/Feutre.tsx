import React from "react";
/**
 * APP-B · le feutre qui trace la carte (maquette validée `prototypes/d3-camera-schema-transitions/apparition.tsx`) :
 * corps encre, capuchon orange, pointe posée sur le bout du trait (x, y), ombre douce. Pixels de toile.
 */
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { teinte } from "../../../cas-concret/plans/commun";

export function Feutre({ x, y, angle = 28, opacite = 1 }: { x: number; y: number; angle?: number; opacite?: number }) {
  if (opacite <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `rotate(${angle}deg)`, opacity: opacite }}>
      <div style={{ position: "absolute", left: 6, top: -230, width: 64, height: 236, borderRadius: 30, background: teinte(COULEURS_DUO.encre, 0.08), filter: "blur(14px)", transform: "translate(18px, 18px)" }} />
      <svg width={60} height={60} style={{ position: "absolute", left: -30, top: -58 }} viewBox="0 0 60 60">
        <path d="M 14 0 L 46 0 L 34 54 Q 30 60 26 54 Z" fill={COULEURS_DUO.encre} />
      </svg>
      <div style={{ position: "absolute", left: -32, top: -250, width: 64, height: 196, borderRadius: "14px 14px 8px 8px", background: COULEURS_DUO.encre }} />
      <div style={{ position: "absolute", left: -32, top: -250, width: 64, height: 54, borderRadius: "14px 14px 0 0", background: COULEURS_DUO.orangeVif }} />
    </div>
  );
}

/** Contour arrondi en un seul trait qui part du MILIEU du bord bas (sens horaire), en pixels de la carte. */
export function contourBas(l: number, h: number, r = 34): string {
  const m = l / 2;
  return `M ${m} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 L ${l - r} 0 A ${r} ${r} 0 0 1 ${l} ${r} L ${l} ${h - r} A ${r} ${r} 0 0 1 ${l - r} ${h} L ${m} ${h}`;
}

/** Point du contour `contourBas` à la part `u` (0 à 1) de sa longueur : où est la pointe du feutre. */
export function pointContourBas(l: number, h: number, u: number, r = 34): [number, number] {
  const arc = (Math.PI * r) / 2;
  const segs: { long: number; at: (s: number) => [number, number] }[] = [
    { long: l / 2 - r, at: (s) => [l / 2 - s, h] },
    { long: arc, at: (s) => { const a = Math.PI / 2 + s / r; return [r + r * Math.cos(a), h - r + r * Math.sin(a)]; } },
    { long: h - 2 * r, at: (s) => [0, h - r - s] },
    { long: arc, at: (s) => { const a = Math.PI + s / r; return [r + r * Math.cos(a), r + r * Math.sin(a)]; } },
    { long: l - 2 * r, at: (s) => [r + s, 0] },
    { long: arc, at: (s) => { const a = -Math.PI / 2 + s / r; return [l - r + r * Math.cos(a), r + r * Math.sin(a)]; } },
    { long: h - 2 * r, at: (s) => [l, r + s] },
    { long: arc, at: (s) => { const a = s / r; return [l - r + r * Math.cos(a), h - r + r * Math.sin(a)]; } },
    { long: l / 2 - r, at: (s) => [l - r - s, h] },
  ];
  const total = segs.reduce((a, s) => a + s.long, 0);
  let reste = Math.max(0, Math.min(1, u)) * total;
  for (const s of segs) {
    if (reste <= s.long) return s.at(reste);
    reste -= s.long;
  }
  return [l / 2, h];
}
