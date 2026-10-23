import React from "react";
/**
 * OUTILS COMMUNS DU LOT 4 « Impact / énergie » (standard DA v2 du 16/10/2026, § B).
 * Ressorts nommés du standard, zone interdite Z autour du visage, étoile à branches limitées par Z, grain.
 * Rien ici ne touche à la prise de Will : tout est dessiné PAR-DESSUS, en SVG, sur une image de 1080 × 1920 (ou toute taille).
 * Le temps de chaque élément est donné en secondes (`t`) ; `i0` = `donnees.debut` (instant du mot dit) ; 30 images par seconde.
 */
import { spring } from "remotion";
import { COULEURS } from "../../charte";

export const FPS = 30;

/** Ressorts nommés (standard § B.4) : damping, stiffness, mass. */
export const RESSORTS = Object.freeze({
  JAILLIR: { damping: 12, stiffness: 200, mass: 0.7 },
  CLAQUER: { damping: 18, stiffness: 420, mass: 0.5 },
  POSER: { damping: 20, stiffness: 170, mass: 1 },
  GLISSER: { damping: 26, stiffness: 260, mass: 0.8 },
  TOUPIE: { damping: 9, stiffness: 140, mass: 0.8 },
} as const);

/** Ressort 0 → 1 (avec dépassement) à `k` images après son départ ; 0 avant. */
export function ressort(k: number, nom: keyof typeof RESSORTS): number {
  if (k <= 0) return 0;
  return spring({ frame: k, fps: FPS, config: RESSORTS[nom] });
}

export const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const sortieCubique = (u: number) => borne(u, 0, 1) ** 3;
export const freinCubique = (u: number) => 1 - (1 - borne(u, 0, 1)) ** 3;

/** Pseudo-hasard déterministe dans [0, 1[ (aucun Math.random : le rendu doit être identique d'une image à l'autre). */
export const alea = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Secousse de l'ÉLÉMENT (jamais de la prise) : dx(m) = A · e^(−m/3) · sin(2π m / 3), m = images depuis l'impact. */
export const secousse = (m: number, amplitude: number): number => (m < 0 ? 0 : amplitude * Math.exp(-m / 3) * Math.sin((2 * Math.PI * m) / 3));

/** Visage de la prise (yeux, centre, largeur), fractions de l'image : valeurs par défaut du studio. */
export type PriseVisage = { yeux: number; centreX: number; largeurVisage: number };
/**
 * PRISE COMMUNE des planches v2 (`planche-v2/prise-commune-1080x1920.png`), mesurée sur l'image : cheveux à 0,14 H, yeux à
 * 0,325 H, menton à 0,49 H, oreilles de 0,27 à 0,76 L (centre 0,515 L). Valeurs calées pour que Z (zone interdite) contienne
 * toute la tête avec la marge de 0,02.
 */
export const PRISE_COMMUNE: PriseVisage = { yeux: 0.335, centreX: 0.515, largeurVisage: 0.4 };
export const PRISE_DEFAUT: PriseVisage = PRISE_COMMUNE;

export type Boite = { x0: number; y0: number; x1: number; y1: number };

/** Zone interdite Z (px) : boîte du visage (cheveux → menton, largeur × 1,2) + marge de 0,02. */
export function zoneZ(W: number, H: number, p: PriseVisage = PRISE_DEFAUT): Boite {
  const demi = (p.largeurVisage / 2) * 1.2 + 0.02;
  return { x0: (p.centreX - demi) * W, x1: (p.centreX + demi) * W, y0: (p.yeux - 0.2 - 0.02) * H, y1: (p.yeux + 0.22 + 0.02) * H };
}

/** Distance à laquelle le rayon (cx, cy, angle) entre dans la boîte (Infinity s'il ne la touche pas). */
export function distanceBoite(cx: number, cy: number, ang: number, b: Boite): number {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  let tmin = 0;
  let tmax = Infinity;
  for (const [o, d, a, c] of [[cx, dx, b.x0, b.x1], [cy, dy, b.y0, b.y1]] as const) {
    if (Math.abs(d) < 1e-9) {
      if (o < a || o > c) return Infinity;
      continue;
    }
    const t1 = (a - o) / d;
    const t2 = (c - o) / d;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  return tmin <= tmax ? tmin : Infinity;
}

/**
 * Contour d'une étoile / éclat (forme F5) centré sur (0, 0), `n` branches ALTERNÉES longues et courtes, vallées à
 * `vallee` × rayon, sommets légèrement irrégulières (fait main, ±3 %). `limite(angle)` plafonne la longueur d'un sommet
 * (l'étoile ne doit jamais entrer dans la zone interdite, même au plus fort du dépassement).
 */
export function cheminEtoile(n: number, rayon: number, opts: { vallee?: number; court?: number; rotation?: number; graine?: number; limite?: (ang: number) => number } = {}): string {
  const { vallee = 0.64, court = 0.84, rotation = 0, graine = 1, limite } = opts;
  const pts: string[] = [];
  for (let i = 0; i < 2 * n; i++) {
    const ang = rotation + (i * Math.PI) / n;
    const pointe = i % 2 === 0;
    const jitter = 1 + (alea(graine + i * 3.7) - 0.5) * 0.06;
    let r = pointe ? (Math.floor(i / 2) % 2 === 0 ? rayon : rayon * court) * jitter : rayon * vallee * jitter;
    if (limite) r = Math.min(r, Math.max(rayon * (pointe ? vallee * 0.7 : vallee * 0.55), limite(ang) * (pointe ? 1 : 0.96)));
    pts.push(`${i ? "L" : "M"} ${(Math.cos(ang) * r).toFixed(2)} ${(Math.sin(ang) * r).toFixed(2)}`);
  }
  return pts.join(" ") + " Z";
}

/** Grain fixe (feTurbulence) de 4 à 6 % : jamais d'aplat nu (standard F7). `id` doit être unique par composant. */
export function Grain({ W, H, id, opacite = 0.05, clair = false }: { W: number; H: number; id: string; opacite?: number; clair?: boolean }) {
  return (
    <>
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="b" />
          <feColorMatrix in="b" type="matrix" values={clair ? "0 0 0 0 0.91  0 0 0 0 0.86  0 0 0 0 0.78  0 0 0 1.6 -0.35" : "0 0 0 0 0.07  0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 1.6 -0.35"} />
        </filter>
      </defs>
      <rect x={0} y={0} width={W} height={H} filter={`url(#${id})`} opacity={opacite * 4} />
    </>
  );
}

/** Format des bruitages lu par `VideoAnimee` : [instant (s), nom du son de `sons/` sans extension, volume]. */
export type BruitageMotion = [number, string, number];
