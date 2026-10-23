import React, { useId } from "react";
/**
 * OUTILS COMMUNS du lot C « Cartes en verre » (standard v3, § C.3, C.4, D) : ressorts nommés, matière verre, ombres
 * douces en 3 couches, flou directionnel + mise au point (filtre SVG bon marché), reflet qui passe.
 *
 * Convention : tout est piloté par `i`, l'IMAGE (à 30 i/s) écoulée depuis le début de l'élément (i < 0 = pas encore là).
 * Rien n'est modifié dans les fichiers existants : on IMPORTE `alpha`, `NUANCES`, `degradeOrange` de `premium-2`.
 */
import type { CSSProperties, ReactNode } from "react";
import { Easing, interpolate, spring } from "remotion";
import { POLICES } from "../../charte";
import { alpha, NUANCES } from "../../variantes/premium-2";

export { alpha, NUANCES };
export const FPS = 30;

/** Ressorts du standard (§ C.4). Dépassement et temps de pose THÉORIQUES (ζ = damping ÷ 2√(stiffness × mass)). */
export const RESSORTS = Object.freeze({
  VERRE: { damping: 16, stiffness: 180, mass: 0.9 },
  PIVOT: { damping: 11, stiffness: 120, mass: 1 },
  FOUET: { damping: 30, stiffness: 520, mass: 0.6 },
  JAILLIR: { damping: 12, stiffness: 200, mass: 0.7 },
  CLAQUER: { damping: 18, stiffness: 420, mass: 0.5 },
  POSER: { damping: 20, stiffness: 170, mass: 1 },
  GLISSER: { damping: 26, stiffness: 260, mass: 0.8 },
} as const);
export type NomRessort = keyof typeof RESSORTS;

/** Ressort 0 → 1 (dépasse 1 puis se pose) `i` images après son départ ; 0 avant. */
export function ressort(nom: NomRessort, i: number): number {
  if (i <= 0) return 0;
  return spring({ frame: i, fps: FPS, config: RESSORTS[nom] });
}

export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;
export const borne01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Progression 0 → 1 en `n` images à partir de l'image `i0`, avec une courbe d'Easing. */
export function courbe(i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}

/** Vitesse (déplacement par image, en unités de `p`) d'une progression `f(i)` : sert au flou directionnel. */
export const vitesse = (f: (i: number) => number, i: number): number => Math.abs(f(i) - f(i - 1));

/** Secousse amortie de l'ÉLÉMENT (jamais de la prise) : A · e^(−k/3) · sin(2πk/3), k images après l'impact. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}

/** Micro-vie au repos : flottement ±0,25 % H (période 2,4 s = 72 i) et ±0,6° de rotateX, déphasés. */
export function microVie(i: number, H: number): { dy: number; rx: number } {
  const w = (2 * Math.PI * i) / 60;
  return { dy: Math.sin(w) * 0.004 * H, rx: Math.sin(w + 1.1) * 0.9 };
}

/* ------------------------------------------------------------------ Matière ------------------------------------------------------------------ */

/**
 * Verre réel (`backdrop-filter`) ou « faux verre » (§ D.6 : alpha plus élevé, sans flou, même reflet et même ombre).
 * Le rendu sans tête de Chromium rend le flou d'arrière-plan lentement : le réglage par défaut est mesuré avant d'être figé.
 */
export const VERRE_REEL = false;

/** Bruitage d'un élément : [image depuis le début de l'élément, fichier de sons/ sans extension, volume]. Aucune musique. */
export type SonElement = readonly [number, string, number];

/** Ombre douce en 3 couches (lumière du haut, toutes les ombres tombent vers le bas). `proche` > 1 : objet plus proche (P2). */
export function ombres(W: number, proche = 1): string {
  const e = NUANCES.encre;
  return [
    `0 ${0.004 * W}px ${0.01 * W}px ${alpha(e, 0.2)}`,
    `0 ${0.018 * W * proche}px ${0.045 * W * proche}px ${alpha(e, 0.24)}`,
    `0 ${0.045 * W * proche}px ${0.11 * W * proche}px ${alpha(e, 0.16)}`,
  ].join(", ");
}

/** Corps de verre ivoire : dégradé translucide, liseré intérieur, reflet en haut, épaisseur au bord bas, ombre douce. */
export function styleVerre(W: number, rayon: number, o: { opacite?: number; proche?: number; reel?: boolean } = {}): CSSProperties {
  const opacite = o.opacite ?? 0.86;
  const reel = o.reel ?? VERRE_REEL;
  const filet = Math.max(2, 0.0025 * W);
  return {
    borderRadius: rayon,
    background: `linear-gradient(168deg, ${alpha(NUANCES.ivoire, Math.min(1, opacite + 0.08))} 0%, ${alpha(NUANCES.ivoire, opacite)} 45%, ${alpha(NUANCES.ivoireCreux, Math.min(1, opacite + 0.04))} 100%)`,
    backdropFilter: reel ? `blur(${0.022 * W}px) saturate(1.2)` : undefined,
    boxShadow: [
      ombres(W, o.proche ?? 1),
      `0 0 0 1px ${alpha(NUANCES.encre, 0.08)}`,
      `inset 0 0 0 ${filet}px ${alpha(NUANCES.ivoire, 0.55)}`,
      `inset 0 ${filet}px 0 ${alpha(NUANCES.ivoire, 1)}`,
      `inset 0 ${-0.004 * W}px ${0.006 * W}px ${alpha(NUANCES.sableProfond, 0.22)}`,
    ].join(", "),
    boxSizing: "border-box",
  };
}

/** Verre d'encre (pastille « n/N », puces sombres) : `alpha(encre, 0,72)`, reflet en haut. */
export function styleVerreEncre(W: number, rayon: number): CSSProperties {
  return {
    borderRadius: rayon,
    background: `linear-gradient(180deg, ${alpha(NUANCES.encreDouce, 0.78)} 0%, ${alpha(NUANCES.encre, 0.78)} 100%)`,
    boxShadow: `0 ${0.004 * W}px ${0.012 * W}px ${alpha(NUANCES.encre, 0.3)}, inset 0 1px 0 ${alpha(NUANCES.ivoire, 0.28)}`,
  };
}

/** Surface orange : dégradé orangeChaud → orangeProfond avec reflet de 1-2 px en haut. */
export function styleOrange(W: number, rayon: number, proche = 0): CSSProperties {
  return {
    borderRadius: rayon,
    background: `linear-gradient(180deg, ${NUANCES.orangeChaud} 0%, ${NUANCES.orange} 52%, ${NUANCES.orangeProfond} 100%)`,
    boxShadow: [`inset 0 ${Math.max(1.5, 0.0025 * W)}px 0 ${alpha(NUANCES.ivoire, 0.35)}`, `inset 0 ${-0.003 * W}px ${0.006 * W}px ${alpha(NUANCES.encre, 0.18)}`, proche ? `0 ${0.008 * W * proche}px ${0.02 * W * proche}px ${alpha(NUANCES.orangeProfond, 0.4)}` : ""].filter(Boolean).join(", "),
  };
}

/** Typographie : titres Montserrat ExtraBold capitales, texte Inter Bold. */
export const titre = (taille: number, couleur: string, interlettrage = 0.04): CSSProperties => ({ fontFamily: POLICES.titre, fontSize: taille, color: couleur, textTransform: "uppercase", letterSpacing: `${interlettrage}em`, lineHeight: 1.05 });
export const texte = (taille: number, couleur: string): CSSProperties => ({ fontFamily: POLICES.texte, fontSize: taille, color: couleur, lineHeight: 1.15 });

/* ------------------------------------------------------------------ Flou de mouvement et mise au point ------------------------------------------------------------------ */

/**
 * Flou directionnel (filtre SVG `feGaussianBlur stdDeviation="X Y"`) + mise au point (flou rond qui s'efface) sur un
 * calque. Sans flou (≤ 0,3 px) le filtre n'est PAS monté : rendu net et bon marché hors des 4 à 6 images rapides.
 * Ce calque couvre tout le cadre : placer le contenu DEDANS, avec ses propres transformations 3D.
 */
export function Flou({ sx = 0, sy = 0, mise = 0, children }: { sx?: number; sy?: number; mise?: number; children: ReactNode }) {
  const id = `fl${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const x = sx + mise;
  const y = sy + mise;
  if (x < 0.3 && y < 0.3) return <div style={{ position: "absolute", inset: 0 }}>{children}</div>;
  return (
    <div style={{ position: "absolute", inset: 0, filter: `url(#${id})` }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${x.toFixed(2)} ${y.toFixed(2)}`} />
        </filter>
      </svg>
      {children}
    </div>
  );
}

/** Conteneur en perspective (§ C.5 : 1400 px à 1080 de large), plein cadre, sans capter de pointeur. */
export function Perspective({ W, origine = "50% 50%", children }: { W: number; origine?: string; children: ReactNode }) {
  return <div style={{ position: "absolute", inset: 0, perspective: (1400 * W) / 1080, perspectiveOrigin: origine, transformStyle: "flat" }}>{children}</div>;
}

/** Reflet qui passe (§ C.3) : bande diagonale de 0,25 L à 20°, une seule fois en `n` images (Easing.inOut cubic). À placer dans un parent `overflow: hidden`. */
export function ReflePassant({ i, i0, W, n = 10, force = 0.5, hauteur }: { i: number; i0: number; W: number; n?: number; force?: number; hauteur: number }) {
  const p = courbe(i, i0, n, Easing.inOut(Easing.cubic));
  if (p <= 0 || p >= 1) return null;
  const l = 0.25 * W;
  const total = hauteur * Math.tan((20 * Math.PI) / 180);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: -hauteur * 0.1,
          height: hauteur * 1.2,
          width: l,
          left: lerp(-l - total, W + total, p),
          transform: "skewX(-20deg)",
          background: `linear-gradient(90deg, transparent 0%, ${alpha(NUANCES.ivoire, force)} 50%, transparent 100%)`,
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

/** Balayage de lumière d'un squelette qui se remplit (8 images). */
export function Squelette({ i, i0, largeur, hauteur, W, rayon }: { i: number; i0: number; largeur: number; hauteur: number; W: number; rayon?: number }) {
  const p = (i - i0) / 24;
  const bal = ((p % 1) + 1) % 1;
  return (
    <div style={{ position: "relative", width: largeur, height: hauteur, borderRadius: rayon ?? hauteur / 2, background: alpha(NUANCES.sable, 0.5), overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, width: largeur * 0.4, left: lerp(-largeur * 0.4, largeur, bal), background: `linear-gradient(90deg, transparent, ${alpha(NUANCES.ivoire, 0.7)}, transparent)` }} />
    </div>
  );
}

/** Halo orange doux d'un élément actif (§ D.1). */
export const halo = (W: number, force: number): string => `0 0 ${0.03 * W}px ${alpha(NUANCES.orange, 0.35 * force)}, 0 0 0 ${Math.max(2, 0.0025 * W)}px ${alpha(NUANCES.orange, 0.5 * force)}`;

/** Props communes des éléments : `i` = image écoulée depuis le début de l'élément, taille de l'image (1080 × 1920 par défaut). */
export type PropsElement = { i: number; W?: number; H?: number };
