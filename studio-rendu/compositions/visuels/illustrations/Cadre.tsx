import type { ReactNode } from "react";
import { palette, type CouleursDessin, type PaletteDessin } from "./palette";

export interface ProprietesIllustration extends CouleursDessin {
  /** Côté du dessin carré : nombre de px, ou longueur CSS. */
  taille: number | string;
}

/** Hiérarchie des traits (grille 200 × 200) : contour des objets, détails, micro-détails de matière. */
export const TRAIT = 5;
export const FIN = 3;
export const MICRO = 2;

/**
 * Cadre commun : scène 200 × 200, trait d'encre à bouts arrondis, décorative et SANS texte.
 * Les formes héritent du contour ; un aplat sans trait passe `stroke="none"`.
 */
export function Cadre({ taille, couleurs, enfants }: { taille: number | string; couleurs: CouleursDessin; enfants: (p: PaletteDessin) => ReactNode }) {
  const p = palette(couleurs);
  return (
    <svg width={taille} height={taille} viewBox="0 0 200 200" aria-hidden>
      <g fill="none" stroke={p.encre} strokeWidth={TRAIT} strokeLinecap="round" strokeLinejoin="round">
        {enfants(p)}
      </g>
    </svg>
  );
}
