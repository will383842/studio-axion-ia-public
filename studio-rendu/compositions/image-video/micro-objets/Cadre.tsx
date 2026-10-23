import React from "react";
/**
 * K11 · Cadre commun des micro-objets : carré de 240 × 240 (grille × 10 des dessins maison), trait arrondi sans
 * remplissage par défaut, entrée avec rebond, lueur orangée sur fond sombre, légère respiration une fois l'animation
 * finie. Chaque dessin y pose ses tracés.
 */
import type { ReactNode } from "react";
import { couleursMicro, entreeMicro, GRILLE_MICRO, respiration, TRAIT_MICRO, type ProprietesMicroObjet } from "./commun";

export function Cadre({ t, taille, fond, dureeS, children }: ProprietesMicroObjet & { dureeS: number; children: ReactNode }) {
  const e = entreeMicro(t);
  const c = couleursMicro(fond);
  const m = GRILLE_MICRO / 2;
  return (
    <svg
      width={taille}
      height={taille}
      viewBox={`0 0 ${GRILLE_MICRO} ${GRILLE_MICRO}`}
      fill="none"
      stroke={c.trait}
      strokeWidth={TRAIT_MICRO}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", overflow: "visible", opacity: e.opacite, filter: c.lueur }}
    >
      <g transform={`translate(${m} ${m + respiration(t, dureeS)}) scale(${e.echelle}) translate(${-m} ${-m})`}>{children}</g>
    </svg>
  );
}
