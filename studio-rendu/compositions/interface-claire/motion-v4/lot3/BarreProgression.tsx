import React from "react";
/**
 * 17 bis — `BarreProgression` (standard v4 § B.7) : barre tout en haut (y 0 → 10 px, pleine largeur), fond ENCRE, rempli ACCENT_1
 * proportionnel au temps écoulé, petit trait vertical BLANC de 4 px au bout du rempli. Toujours visible, au-dessus de tout
 * (sauf du panneau de fin). `p` va de 0 à 1 ; sans `p`, elle se calcule sur `dureeTotale` (images) avec l'image courante.
 */
import { useCurrentFrame } from "remotion";
import { accents, COULEURS, W } from "./commun-lot3";
import type { Palette } from "./commun-lot3";

export function BarreProgression({ palette, p, dureeTotale }: { palette: Palette; p?: number; dureeTotale?: number }) {
  const frame = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const prog = p ?? (dureeTotale ? frame / dureeTotale : 0);
  const x = Math.max(0, Math.min(1, prog)) * W;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 10, background: COULEURS.ENCRE, zIndex: 1000 }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: x, height: 10, background: ACCENT_1 }} />
      <div style={{ position: "absolute", left: Math.max(0, x - 4), top: 0, width: 4, height: 10, background: COULEURS.BLANC }} />
    </div>
  );
}
