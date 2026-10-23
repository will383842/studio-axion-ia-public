import React from "react";
/**
 * SOCLE DU LOT 1 « Papier & collage » (standard DA v2, 16/10/2026) : ressorts nommés du § B.4, secousse de l'ÉLÉMENT,
 * aléa fixé (jamais Math.random : le rendu doit être identique à chaque image), bord déchiré, grain, zone interdite Z.
 *
 * Rien ici ne modifie `charte.ts`, `mouvement.ts` ni `elements.tsx` (les ressorts s'AJOUTENT, ils ne remplacent rien).
 * Teintes : les 4 de la charte + les nuances calculées de `NUANCES` (copiées ici pour ne pas dépendre d'un fichier que
 * d'autres designers peuvent retoucher).
 */
import { Easing, interpolate, spring } from "remotion";

export const FPS = 30;

export const C = Object.freeze({
  ivoire: "#E9DCC8",
  ivoireCreux: "#DECFB9",
  sableClair: "#D4C2AA",
  sable: "#BFA88B",
  sableProfond: "#94806A",
  orange: "#B44F29",
  orangeProfond: "#934122",
  encre: "#110A05",
  encreDouce: "#45392D",
} as const);

/** Ressorts du standard (§ B.4). Dépassements théoriques : à confirmer à l'œil sur la planche. */
export const RESSORTS = Object.freeze({
  JAILLIR: { damping: 12, stiffness: 200, mass: 0.7 },
  CLAQUER: { damping: 18, stiffness: 420, mass: 0.5 },
  POSER: { damping: 20, stiffness: 170, mass: 1 },
  GLISSER: { damping: 26, stiffness: 260, mass: 0.8 },
  TOUPIE: { damping: 9, stiffness: 140, mass: 0.8 },
  BALANCER: { damping: 5, stiffness: 90, mass: 1 },
} as const);
export type NomRessort = keyof typeof RESSORTS;

/** Ressort de 0 vers 1, `k` = images écoulées depuis l'instant i0 (fraction permise ; avant i0 : 0). */
export function ressort(k: number, nom: NomRessort): number {
  if (k <= 0) return 0;
  return spring({ frame: k, fps: FPS, config: RESSORTS[nom] });
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const bornes = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Progression 0 → 1 entre les images `a` et `b` avec une courbe au choix. */
export function entre(k: number, a: number, b: number, ease: (x: number) => number = (x) => x): number {
  return interpolate(k, [a, b], [0, 1], { ...bornes, easing: ease });
}
export const easeIn3 = Easing.in(Easing.cubic);
export const easeOut3 = Easing.out(Easing.cubic);
export const easeBalayage = Easing.bezier(0.83, 0, 0.17, 1);
export const easeTrace = Easing.bezier(0.33, 0, 0.2, 1);

/** Secousse de l'élément (§ M4) : A · e^(−k/3) · sin(2πk/3), k = images depuis l'impact (0 avant, 0 après 9 images). */
export function secousse(k: number, A: number): number {
  if (k < 0 || k > 9) return 0;
  return A * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}

/** Aléa déterministe (mulberry32). */
export function alea(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Prise = { yeux?: number; centreX?: number; largeurVisage?: number };
export type Rect = { x0: number; y0: number; x1: number; y1: number };

/**
 * Zone interdite Z (§ B.1) en pixels : boîte du visage + marge de 0,02. Cheveux à yeux − 0,20 H, menton à yeux + 0,22 H,
 * largeur = largeurVisage × 1,2, centrée sur `centreX`. Les éléments « visage entier » n'y entrent jamais.
 */
export function zoneVisage(W: number, H: number, prise: Prise = {}): Rect {
  const yeux = prise.yeux ?? 0.34;
  const cx = prise.centreX ?? 0.5;
  const demi = ((prise.largeurVisage ?? 0.38) * 1.2) / 2;
  return { x0: (cx - demi - 0.02) * W, x1: (cx + demi + 0.02) * W, y0: (yeux - 0.2 - 0.02) * H, y1: (yeux + 0.22 + 0.02) * H };
}

/** Points d'un bord déchiré horizontal de `x0` à `x1` autour de `y` (dents de 0,006 à 0,018 L, hauteur `amp`). */
export function bordHorizontal(rng: () => number, x0: number, x1: number, y: number, amp: number, W: number): [number, number][] {
  const pts: [number, number][] = [];
  const dir = x1 >= x0 ? 1 : -1;
  let x = x0;
  while (dir * (x1 - x) > 0) {
    pts.push([x, y + (rng() - 0.5) * 2 * amp]);
    x += dir * W * (0.006 + rng() * 0.012);
  }
  pts.push([x1, y + (rng() - 0.5) * 2 * amp]);
  return pts;
}

/** Points d'un bord déchiré vertical de `y0` à `y1` autour de `x`. */
export function bordVertical(rng: () => number, y0: number, y1: number, x: number, amp: number, W: number): [number, number][] {
  const pts: [number, number][] = [];
  const dir = y1 >= y0 ? 1 : -1;
  let y = y0;
  while (dir * (y1 - y) > 0) {
    pts.push([x + (rng() - 0.5) * 2 * amp, y]);
    y += dir * W * (0.006 + rng() * 0.012);
  }
  pts.push([x + (rng() - 0.5) * 2 * amp, y1]);
  return pts;
}

export const versPoints = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** Calque de grain fixe (`feTurbulence`), à poser par-dessus un aplat ou un papier. `id` doit être unique dans la page. */
export function GrainPapier({ id, largeur, hauteur, opacite = 0.06, graine = 5, frequence = 0.85 }: { id: string; largeur: number; hauteur: number; opacite?: number; graine?: number; frequence?: number }) {
  return (
    <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", mixBlendMode: "multiply" }}>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={frequence} numOctaves={2} seed={graine} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.07  0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 1.4 -0.35" />
      </filter>
      <rect width={largeur} height={hauteur} filter={`url(#${id})`} opacity={Math.min(1, opacite * 6.5)} />
    </svg>
  );
}

/** Fibres de papier : petits traits courbes clairs, fixes (aléa fixé). */
export function Fibres({ largeur, hauteur, graine, nombre, couleur = C.sable, opacite = 0.4, epaisseur = 1.4 }: { largeur: number; hauteur: number; graine: number; nombre: number; couleur?: string; opacite?: number; epaisseur?: number }) {
  const r = alea(graine);
  const traits: React.ReactNode[] = [];
  for (let i = 0; i < nombre; i++) {
    const x = r() * largeur;
    const y = r() * hauteur;
    const l = largeur * (0.008 + r() * 0.02);
    const a = r() * Math.PI;
    const dx = Math.cos(a) * l;
    const dy = Math.sin(a) * l;
    traits.push(<path key={i} d={`M${x.toFixed(1)} ${y.toFixed(1)} q${(dx / 2 + dy * 0.3).toFixed(1)} ${(dy / 2 - dx * 0.3).toFixed(1)} ${dx.toFixed(1)} ${dy.toFixed(1)}`} stroke={couleur} strokeWidth={epaisseur} fill="none" strokeLinecap="round" />);
  }
  return (
    <svg width={largeur} height={hauteur} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", opacity: opacite }}>
      {traits}
    </svg>
  );
}

/** Calque plein cadre sans interaction, qui rogne ce qui sort du cadre. */
export const calqueCadre: React.CSSProperties = { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, overflow: "hidden", pointerEvents: "none" };

/** Aide à la planche : une bande de scotch (rectangle ivoire translucide aux bords courts dentelés). */
export function Scotch({ l, h, graine, opacite = 0.85, lisere = 3 }: { l: number; h: number; graine: number; opacite?: number; lisere?: number }) {
  const r = alea(graine);
  const dent = h * 0.16;
  const haut: [number, number][] = [];
  const bas: [number, number][] = [];
  const n = 5;
  const gauche: [number, number][] = [];
  const droite: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const y = (h * i) / n;
    gauche.push([(i % 2 ? dent : 0) * (0.6 + r() * 0.8), y]);
    droite.push([l - (i % 2 ? 0 : dent) * (0.6 + r() * 0.8), y]);
  }
  haut.push(...gauche);
  bas.push(...droite.reverse());
  const pts = [...haut, ...bas];
  return (
    <svg width={l} height={h} viewBox={`0 0 ${l} ${h}`} style={{ position: "absolute", left: -l / 2, top: -h / 2, overflow: "visible" }}>
      <polygon points={versPoints(pts)} fill={C.sableClair} fillOpacity={opacite} stroke={C.encre} strokeOpacity={0.75} strokeWidth={lisere} strokeLinejoin="round" />
      <line x1={l * 0.1} y1={h * 0.3} x2={l * 0.9} y2={h * 0.3} stroke={C.ivoire} strokeOpacity={0.9} strokeWidth={3} />
    </svg>
  );
}
