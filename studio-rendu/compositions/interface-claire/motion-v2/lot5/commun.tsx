/**
 * Outils communs du LOT 5 « Organique & objets » (motion v2, standard DA du 16/10/2026) : ressorts NOMMÉS du § B.4,
 * secousse amortie de l'ÉLÉMENT (jamais de la prise), courbes fermées organiques, grain d'impression.
 * Tout est une fonction PURE de l'image `f` (30 i/s, i0 = 0) : même résultat à chaque rendu, aucun état.
 */
import React from "react";
import { Easing, interpolate, spring } from "remotion";

export const FPS = 30;

/** Ressorts du standard (§ B.4). Dépassements et temps de pose THÉORIQUES, à confirmer avec `measureSpring`. */
export const RESSORTS = Object.freeze({
  JAILLIR: { damping: 12, stiffness: 200, mass: 0.7 },
  CLAQUER: { damping: 18, stiffness: 420, mass: 0.5 },
  POSER: { damping: 20, stiffness: 170, mass: 1 },
  GLISSER: { damping: 26, stiffness: 260, mass: 0.8 },
  TOUPIE: { damping: 9, stiffness: 140, mass: 0.8 },
  BALANCER: { damping: 5, stiffness: 90, mass: 1 },
} as const);

export type NomRessort = keyof typeof RESSORTS;

/** Ressort 0 → 1 (avec dépassement selon le nom) à l'image `f`, éventuellement retardé de `retard` images. */
export function ressort(nom: NomRessort, f: number, retard = 0): number {
  const x = f - retard;
  if (x <= 0) return 0;
  return spring({ frame: x, fps: FPS, config: { ...RESSORTS[nom] } });
}

/** Secousse amortie (§ M4) : dx(k) = A · e^(−k/3) · sin(2πk/3). `k` = images depuis le début de la secousse. */
export const secousse = (k: number, A: number): number => (k < 0 ? 0 : A * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3));

export const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Progression 0 → 1 de `debut` à `debut + duree` (images), courbe d'entrée cubique (départ lent, fin vive) : sorties. */
export const aspiration = (f: number, debut: number, duree: number): number =>
  interpolate(f, [debut, debut + duree], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });

/** Progression 0 → 1 linéaire bornée. */
export const lineaire = (f: number, debut: number, duree: number): number =>
  interpolate(f, [debut, debut + duree], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Graine pseudo-aléatoire déterministe (aucun `Math.random` : le rendu doit être identique à chaque passage). */
export const hasard = (i: number, graine = 1): number => {
  const x = Math.sin(i * 12.9898 + graine * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export type Pt = [number, number];

/** Courbe FERMÉE lisse passant par les points (Catmull-Rom → Bézier), pour les blobs organiques. */
export function cheminLisse(pts: Pt[]): string {
  const n = pts.length;
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + " Z";
}

/** Polygone fermé (angles vifs). */
export const cheminPolygone = (pts: Pt[]): string => "M " + pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" L ") + " Z";

/**
 * Grain d'impression FIXE (4 à 6 % d'encre, § F7) : à placer dans <defs>, à appliquer à un <rect> rempli de n'importe quelle
 * couleur (la couleur est remplacée par l'encre #110A05). `seed` fixe → même grain à chaque image (le papier ne scintille pas).
 */
export function FiltreGrain({ id, graine = 7, frequence = 0.85, force = 0.5 }: { id: string; graine?: number; frequence?: number; force?: number }) {
  return (
    <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency={frequence} numOctaves={2} seed={graine} result="bruit" />
      <feColorMatrix in="bruit" type="matrix" values={`0 0 0 0 0.067  0 0 0 0 0.039  0 0 0 0 0.02  ${force} 0 0 0 ${-force * 0.4}`} />
    </filter>
  );
}
