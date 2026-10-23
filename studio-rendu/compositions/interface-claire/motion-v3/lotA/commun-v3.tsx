/**
 * OUTILS COMMUNS du lot A « Fenêtres sur le visage » (standard v3 du 16/10, § C et § D) : ressorts nommés, matière « verre »
 * des fenêtres (ombre douce en 3 couches, liseré ivoire, reflet qui passe, vignette), flou directionnel SVG, puce-étiquette,
 * vidéo « cover » SANS zoom, bruitages. Aucun fichier existant n'est modifié : ces aides vivent à côté des éléments.
 *
 * Convention : tout est piloté par `t` (secondes) converti en IMAGES à 30 i/s ; « i0 » est l'image où Will dit le mot
 * déclencheur, c'est-à-dire `debut`. Aucune teinte hors charte : les transparences passent par `alpha()`.
 */
import React from "react";
import { Audio, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import { POLICES } from "../../charte";
import { alpha, degradeOrange, NUANCES } from "../../variantes/premium-2";

export const FPS = 30;

/** Ressorts du standard v3 (§ C.4). Dépassement et temps de pose THÉORIQUES, réglés à l'œil sur extrait. */
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

/** Image (décimale) écoulée depuis `debut` (secondes). */
export const img = (t: number, debut: number): number => (t - debut) * FPS;

/** Ressort 0 → 1 `i` images après son départ (avant : 0). */
export function ressort(nom: NomRessort, i: number): number {
  if (i <= 0) return 0;
  return spring({ frame: i, fps: FPS, config: RESSORTS[nom] });
}

export const borne01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Progression 0 → 1 en `n` images à partir de l'image `i0`. */
export function courbe(i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
export const aspiration = Easing.in(Easing.cubic);
export const douce = Easing.inOut(Easing.cubic);
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

/** Secousse amortie de l'ÉLÉMENT (jamais de la prise) : A · e^(−k/3) · sin(2πk/3), `k` images après l'arrêt. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}

/** Bruitage : le fichier vient de `sons/` (Kenney CC0), `t0` est en secondes locales à l'élément. */
export function Son({ t0, fichier, volume = 0.8, actif }: { t0: number; fichier: string; volume?: number; actif: boolean }) {
  if (!actif) return null;
  return (
    <Sequence from={Math.max(0, Math.round(t0 * FPS))} layout="none">
      <Audio src={staticFile(`sons/${fichier}.wav`)} volume={volume} />
    </Sequence>
  );
}

/* ------------------------------------------------------------------ Matière ------------------------------------------------------------------ */

/** Ombre douce en 3 couches, lumière du haut (§ C.3). `proche` > 1 : l'objet est plus proche (plan P2), ombres plus grandes. */
export function ombres(W: number, proche = 1): string {
  const e = NUANCES.encre;
  return [
    `0 ${(0.004 * W * proche).toFixed(1)}px ${(0.01 * W).toFixed(1)}px ${alpha(e, 0.2)}`,
    `0 ${(0.018 * W * proche).toFixed(1)}px ${(0.045 * W * proche).toFixed(1)}px ${alpha(e, 0.24)}`,
    `0 ${(0.045 * W * proche).toFixed(1)}px ${(0.11 * W * proche).toFixed(1)}px ${alpha(e, 0.16)}`,
  ].join(", ");
}

/** Liseré intérieur ivoire (55 %) + reflet en haut (35 %). */
export const lisere = (W: number): string => `inset 0 0 0 ${(0.003 * W).toFixed(1)}px ${alpha(NUANCES.ivoire, 0.55)}, inset 0 ${(0.0025 * W).toFixed(1)}px 0 ${alpha(NUANCES.ivoire, 0.35)}`;

/** Bande de lumière qui traverse l'objet en 10 images (reflet qui passe, une seule fois). `p` va de 0 à 1. */
export function Reflet({ l, h, p }: { l: number; h: number; p: number }) {
  if (p <= 0 || p >= 1) return null;
  const largeur = l * 0.3;
  const x = lerp(-largeur * 1.6, l + largeur * 0.6, p);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: -h * 0.3,
        width: largeur,
        height: h * 1.6,
        transform: `translateX(${x}px) rotate(20deg)`,
        background: `linear-gradient(90deg, ${alpha(NUANCES.ivoire, 0)} 0%, ${alpha(NUANCES.ivoire, 0.26)} 50%, ${alpha(NUANCES.ivoire, 0)} 100%)`,
      }}
    />
  );
}

/** Vignette intérieure (encre 18 % dans les coins) + brillance du haut : décolle la vidéo du bord. */
export function Vignette({ force = 1 }: { force?: number }) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 110% at 50% 45%, ${alpha(NUANCES.encre, 0)} 55%, ${alpha(NUANCES.encre, 0.18 * force)} 100%)` }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${alpha(NUANCES.ivoire, 0.16)} 0%, ${alpha(NUANCES.ivoire, 0)} 16%)` }} />
    </>
  );
}

/** Conteneur de perspective (§ C.5 : 1400 px à 1080 de large). Les enfants sont en `position: absolute` dans le plan de l'image. */
export function Perspective({ W, children, style }: { W: number; children: ReactNode; style?: CSSProperties }) {
  return <div style={{ position: "absolute", inset: 0, perspective: (1400 * W) / 1080, perspectiveOrigin: "50% 50%", ...style }}>{children}</div>;
}

/** Flou directionnel bon marché (§ D.5) : filtre SVG `feGaussianBlur`, à poser sur un calque plein cadre. Renvoie le style à appliquer. */
export function FiltreDirectionnel({ id, sx, sy }: { id: string; sx: number; sy: number }) {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id={id} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={`${sx.toFixed(2)} ${sy.toFixed(2)}`} />
        </filter>
      </defs>
    </svg>
  );
}
export const styleFlou = (id: string, sx: number, sy: number): CSSProperties => (sx > 0.4 || sy > 0.4 ? { filter: `url(#${id})` } : {});

/** Fenêtre en verre : ombre douce, liseré, vignette, reflet. Le contenu (vidéo) est clipsé par les coins arrondis. */
export function BoiteFenetre(p: {
  W: number;
  x: number;
  y: number;
  l: number;
  h: number;
  rayon: number;
  transform: string;
  flou?: number;
  proche?: number;
  reflet?: number;
  opacite?: number;
  fond?: string;
  children?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        width: p.l,
        height: p.h,
        borderRadius: p.rayon,
        transform: p.transform,
        transformOrigin: "50% 50%",
        filter: p.flou && p.flou > 0.2 ? `blur(${p.flou.toFixed(2)}px)` : undefined,
        opacity: p.opacite ?? 1,
        boxShadow: ombres(p.W, p.proche ?? 1),
        background: p.fond ?? NUANCES.encre,
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: p.rayon, overflow: "hidden" }}>
        {p.children}
        <Vignette />
        <Reflet l={p.l} h={p.h} p={p.reflet ?? 0} />
      </div>
      <div style={{ position: "absolute", inset: 0, borderRadius: p.rayon, boxShadow: lisere(p.W), pointerEvents: "none" }} />
    </div>
  );
}

/**
 * Vidéo (B-roll) en « cover », SANS ZOOM (décision de Will du 15/10), qui démarre à `debut` (secondes locales) depuis
 * `depuisSec` de la source. Les sources du pool font 5 s : jamais de boucle nécessaire (une fenêtre dure 3 s au plus).
 */
export function VideoDans({ src, depuisSec = 0, debut, largeur, hauteur, filtre, style }: { src: string; depuisSec?: number; debut: number; largeur?: number; hauteur?: number; filtre?: string; style?: CSSProperties }) {
  return (
    <Sequence from={Math.round(debut * FPS)} layout="none">
      <OffthreadVideo src={src} muted startFrom={Math.round(depuisSec * FPS)} style={{ width: largeur ?? "100%", height: hauteur ?? "100%", objectFit: "cover", filter: filtre, ...style }} />
    </Sequence>
  );
}

/* ------------------------------------------------------------------ Puce ------------------------------------------------------------------ */

export type VarianteParole = "orange" | "verreEncre" | "verreIvoire";

/**
 * Puce-étiquette v3 (§ E.2) : coins de 0,22 em, SANS contour, reflet en haut, ombre douce en 2 couches. Ancrée par son bord
 * gauche (`x`) et le centre de sa hauteur (`y`), en pixels de l'image. Entrée `JAILLIR` : échelle 0,4 → 1 + mise au point en 3 i.
 */
export function Puce(p: { texte: string; W: number; x: number; y: number; i: number; i0: number; rotation: number; dx?: number; dy?: number; sortie?: number; variante?: VarianteParole; taille?: number; ancre?: "gauche" | "centre" | "droite" }) {
  const k = p.i - p.i0;
  if (k < 0 || (p.sortie ?? 0) >= 1) return null;
  const e = 0.4 + 0.6 * ressort("JAILLIR", k);
  const flou = (0.006 * p.W) * (1 - courbe(k, 0, 3));
  const taille = p.taille ?? 0.056 * p.W;
  const v = p.variante ?? "orange";
  const fond = v === "orange" ? degradeOrange : v === "verreEncre" ? alpha(NUANCES.encre, 0.78) : alpha(NUANCES.ivoire, 0.88);
  const couleur = v === "verreIvoire" ? NUANCES.encre : NUANCES.ivoire;
  const ombre = [
    `0 ${(0.007 * p.W).toFixed(1)}px ${(0.02 * p.W).toFixed(1)}px ${alpha(NUANCES.encre, 0.3)}`,
    `0 ${(0.022 * p.W).toFixed(1)}px ${(0.05 * p.W).toFixed(1)}px ${alpha(NUANCES.encre, 0.2)}`,
    `inset 0 ${Math.max(1, 0.0022 * p.W).toFixed(1)}px 0 ${alpha(NUANCES.ivoire, 0.38)}`,
  ].join(", ");
  const sortie = p.sortie ?? 0;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        transform: `translate(${p.dx ?? 0}px, ${p.dy ?? 0}px) translate(${p.ancre === "centre" ? "-50%" : p.ancre === "droite" ? "-100%" : "0"}, -50%) rotate(${p.rotation}deg) scale(${e * (1 - 0.25 * sortie)})`,
        transformOrigin: p.ancre === "centre" ? "50% 50%" : p.ancre === "droite" ? "100% 50%" : "0% 50%",
        opacity: 1 - sortie,
        filter: flou > 0.3 ? `blur(${flou.toFixed(2)}px)` : undefined,
        fontFamily: POLICES.titre,
        fontSize: taille,
        lineHeight: 1,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        color: couleur,
        padding: `${(taille * 0.5).toFixed(1)}px ${(taille * 0.85).toFixed(1)}px`,
        borderRadius: taille * 0.22 + taille * 0.3,
        background: fond,
        backdropFilter: v === "orange" ? undefined : `blur(${(0.02 * p.W).toFixed(1)}px) saturate(1.2)`,
        boxShadow: ombre,
        textShadow: v === "verreIvoire" ? undefined : `0 ${(taille * 0.06).toFixed(1)}px ${(taille * 0.12).toFixed(1)}px ${alpha(NUANCES.encre, 0.35)}`,
      }}
    >
      {p.texte}
    </div>
  );
}

/* ------------------------------------------------------------------ Entrées et sorties ------------------------------------------------------------------ */

/**
 * N1 « pivot latéral » (§ C.5) : translation de 1,0 L → 0 (`VERRE`), rotateY de 38° → 0 (`PIVOT`), rotateZ de 7° → 2,5°,
 * mise au point 0,008 L → 0 en 4 i. `sens` = +1 : arrive de la droite ; −1 : arrive de la gauche.
 */
export function entreeN1(i: number, sens: 1 | -1, W: number, vif = 1) {
  const pv = ressort("VERRE", i * vif);
  return {
    dx: sens * W * 1.0 * (1 - pv),
    rotY: sens * 38 * (1 - courbe(i, 0, 14, Easing.out(Easing.quad))),
    rotZ: -sens * (2.5 + 4.5 * (1 - pv)),
    flou: 0.008 * W * (1 - courbe(i, 0, 4)),
  };
}

/** Sortie « fouet » (T1, `FOUET`, ≈ 5 i) : `k` images depuis le départ. Renvoie le décalage et la rotation. */
export function sortieFouet(k: number, sens: 1 | -1, W: number, distance = 1.15) {
  const q = ressort("FOUET", k);
  return { dx: -sens * W * distance * q, rotY: -sens * 25 * q, q };
}

/** Micro-vie au repos : flottement de ±0,3 % de translateY et ±0,6° de rotateX (période 2,4 s), qui s'installe après la pose. */
export function microVie(t: number, i: number, iPose: number, H: number) {
  const a = courbe(i, iPose, 10);
  return { ty: a * 0.006 * H * Math.sin((2 * Math.PI * t) / 2.4), rx: a * 0.7 * Math.sin((2 * Math.PI * t) / 2.4 + 1.2) };
}

/** Reflet qui repasse : une passe de 10 images à la pose (`i0`), puis toutes les 36 images (jamais figé plus de 0,5 s sans vie). Renvoie p (0 → 1) ou 0. */
export function refletsApresPose(i: number, i0: number): number {
  if (i < i0) return 0;
  const k = (i - i0) % 36;
  return k < 10 ? douce(k / 10) : 0;
}

/** Vitesse en pixels par image d'une position `f(i)`. */
export const vitesse = (f: (i: number) => number, i: number): number => Math.abs(f(i) - f(i - 1));
