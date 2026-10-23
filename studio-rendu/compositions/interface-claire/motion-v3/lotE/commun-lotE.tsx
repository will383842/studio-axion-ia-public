import React, { useId } from "react";
/**
 * OUTILS COMMUNS DU LOT E « Coups de poing » (standard DA v3 du 16/10/2026, § C.3, C.4, D.5, F.2).
 * Ressorts nommés du standard (VERRE, PIVOT, FOUET, JAILLIR, CLAQUER, POSER, GLISSER), ombre douce en 3 couches (une seule
 * lumière, du haut), grain, flou directionnel SVG, vidéo plein cadre SANS ZOOM, duotone, puce de verre.
 * Rien ici ne touche à la prise de Will : tout est dessiné PAR-DESSUS une image de 1080 × 1920 (ou toute taille).
 * Tout est une fonction PURE du temps `t` (secondes, 30 i/s) : même résultat à chaque rendu, aucun `Math.random`.
 * N'importe rien d'autre que le socle existant (charte, premium-2, commune/polices) : aucun fichier existant n'est modifié.
 */
import { Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile } from "remotion";
import { POLICES } from "../../charte";
import { alpha, NUANCES } from "../../variantes/premium-2";
import { chargerPoliceMontserrat } from "../../../commune/polices";

export { alpha, NUANCES, POLICES, chargerPoliceMontserrat };

export const FPS = 30;

/** Ressorts du standard v3 (§ C.4). Dépassements théoriques : ζ = damping ÷ (2√(stiffness × mass)). */
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

/** Ressort 0 → 1 `k` images après son départ (k peut être décimal). Avant : 0. */
export function ressort(nom: NomRessort, k: number): number {
  if (k <= 0) return 0;
  return spring({ frame: k, fps: FPS, config: { ...RESSORTS[nom] } });
}

export const borne = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Image (décimale) écoulée depuis `debut` (secondes). */
export const imageDepuis = (t: number, debut: number) => (t - debut) * FPS;

/** Progression 0 → 1 de l'image `i0` à `i0 + n`, avec une courbe d'Easing. */
export function courbe(i: number, i0: number, n: number, easing: (x: number) => number = (x) => x): number {
  return interpolate(i, [i0, i0 + n], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
export const freinCubique = Easing.out(Easing.cubic);
export const aspiration = Easing.in(Easing.cubic);
export const trace = Easing.bezier(0.33, 0, 0.2, 1);
export const balayage = Easing.bezier(0.83, 0, 0.17, 1);

/** Secousse amortie de l'ÉLÉMENT (jamais de la prise) : A · e^(−k/3) · sin(2πk/3), k images après l'impact. */
export function secousse(k: number, amplitude: number): number {
  if (k < 0 || k > 12) return 0;
  return amplitude * Math.exp(-k / 3) * Math.sin((2 * Math.PI * k) / 3);
}

/** Pseudo-hasard fixe dans [0, 1[. */
export function alea(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. Aucune musique. */
export type BruitageMotion = [number, string, number];

/** Props communes de tous les éléments du lot E. */
export type PropsElementE = { t: number; largeurImage: number; hauteurImage: number; sansVideo?: boolean };

/* ------------------------------------------------------------------ Matière ------------------------------------------------------------------ */

/**
 * Ombre douce en 3 couches (§ C.3), lumière du haut : plus l'objet est « proche » (`proche` > 1), plus les 2ᵉ et 3ᵉ couches
 * sont décalées et grandes.
 */
export function ombre3(W: number, proche = 1, force = 1): string {
  const c = (a: number) => alpha(NUANCES.encre, a * force);
  return [
    `0 ${(0.004 * W).toFixed(1)}px ${(0.01 * W).toFixed(1)}px ${c(0.2)}`,
    `0 ${(0.018 * W * proche).toFixed(1)}px ${(0.045 * W * proche).toFixed(1)}px ${c(0.24)}`,
    `0 ${(0.045 * W * proche).toFixed(1)}px ${(0.11 * W * proche).toFixed(1)}px ${c(0.16)}`,
  ].join(", ");
}

/** Version `drop-shadow()` (pour un objet découpé par un masque). */
export function ombre3Filtre(W: number, proche = 1, force = 1): string {
  const c = (a: number) => alpha(NUANCES.encre, a * force);
  return [
    `drop-shadow(0 ${(0.004 * W).toFixed(1)}px ${(0.006 * W).toFixed(1)}px ${c(0.22)})`,
    `drop-shadow(0 ${(0.018 * W * proche).toFixed(1)}px ${(0.022 * W * proche).toFixed(1)}px ${c(0.22)})`,
    `drop-shadow(0 ${(0.045 * W * proche).toFixed(1)}px ${(0.05 * W * proche).toFixed(1)}px ${c(0.14)})`,
  ].join(" ");
}

/** Liseré intérieur ivoire à 55 % de 0,003 L et reflet du haut (§ C.3). */
export const lisereInterieur = (W: number) => `inset 0 0 0 ${Math.max(2, Math.round(0.003 * W))}px ${alpha(NUANCES.ivoire, 0.55)}`;

/** Extrusion douce d'un mot géant : 3 ombres empilées vers le bas (§ F.2), puis une ombre portée floue. */
export function relief(W: number, couleur: string, pas = 0.004, doux = 0.4): string {
  const p = pas * W;
  return [
    `0 ${(-0.0016 * W).toFixed(1)}px 0 ${alpha(NUANCES.ivoire, 0.4)}`,
    `0 ${p.toFixed(1)}px 0 ${couleur}`,
    `0 ${(p * 2).toFixed(1)}px 0 ${couleur}`,
    `0 ${(p * 3).toFixed(1)}px 0 ${couleur}`,
    `0 ${(p * 5).toFixed(1)}px ${(0.03 * W).toFixed(1)}px ${alpha(NUANCES.encre, doux)}`,
  ].join(", ");
}

/** Grain fixe (feTurbulence) posé sur une surface (le parent est `position: relative` ou absolu plein cadre). */
export function GrainPlein({ W, H, opacite = 0.1, graine = 7, clair = false }: { W: number; H: number; opacite?: number; graine?: number; clair?: boolean }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", mixBlendMode: clair ? "screen" : "multiply" }}>
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={graine} stitchTiles="stitch" result="b" />
        <feColorMatrix in="b" type="matrix" values={clair ? "0 0 0 0 0.91  0 0 0 0 0.86  0 0 0 0 0.78  1.4 0 0 0 -0.3" : "0 0 0 0 0.067  0 0 0 0 0.039  0 0 0 0 0.02  1.4 0 0 0 -0.3"} />
      </filter>
      <rect width={W} height={H} filter={`url(#${id})`} opacity={opacite * 3} />
    </svg>
  );
}

/** Définition d'un flou directionnel SVG (§ D.5) : `stdX`, `stdY` en px. À poser une fois, puis `filter: url(#id)`. */
export function DefFlouDirectionnel({ id, stdX, stdY = 0 }: { id: string; stdX: number; stdY?: number }) {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }}>
      <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation={`${Math.max(0, stdX).toFixed(2)} ${Math.max(0, stdY).toFixed(2)}`} />
      </filter>
    </svg>
  );
}

/* ------------------------------------------------------------------ Vidéo ------------------------------------------------------------------ */

/** Dossier public (publicDir du bundle) des B-roll : `broll/<fichier>.mp4`. */
export const dossierBroll = (nom: string) => staticFile(`broll/${nom}`);

/**
 * Vidéo qui REMPLIT son parent en « cover », SANS ZOOM (décision de Will du 15/10), muette, qui démarre à l'image `debutImage`
 * (relative à la séquence parente) depuis `depuisSec` de la source. `sansVideo` : gris uni (test de couverture du visage).
 */
export function VideoCover({ nom, debutImage, depuisSec = 0, filtre, sansVideo = false }: { nom: string; debutImage: number; depuisSec?: number; filtre?: string; sansVideo?: boolean }) {
  if (sansVideo) return <div style={{ position: "absolute", inset: 0, background: "#5a5a5a" }} />;
  return (
    <Sequence from={Math.max(0, Math.round(debutImage))} layout="none">
      <OffthreadVideo
        src={dossierBroll(nom)}
        muted
        startFrom={Math.round(depuisSec * FPS)}
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", filter: filtre }}
        pauseWhenBuffering={false}
      />
    </Sequence>
  );
}

/** Voile de vignette intérieure (§ C.3) : dégradé radial encre à 18 % dans les coins. */
export const vignette = `radial-gradient(ellipse 75% 70% at 50% 48%, rgba(17,10,5,0) 55%, ${alpha(NUANCES.encre, 0.34)} 100%)`;

/* ------------------------------------------------------------------ Puce de verre ------------------------------------------------------------------ */

/** Puce v3 (§ E.2) : dégradé orange, coins de 0,22 em, reflet du haut, ombre douce, sans contour. `verreEncre` : puce de verre encre. */
export function Puce({ texte, W, taille, inclinaison = -2, verreEncre = false, echelle = 1, flou = 0, style }: { texte: string; W: number; taille: number; inclinaison?: number; verreEncre?: boolean; echelle?: number; flou?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${taille * 0.28}px ${taille * 0.6}px`,
        borderRadius: taille * 0.22 + taille * 0.28,
        background: verreEncre ? alpha(NUANCES.encre, 0.78) : `linear-gradient(180deg, ${NUANCES.orangeChaud} 0%, ${NUANCES.orangeProfond} 100%)`,
        boxShadow: `inset 0 ${Math.max(1.5, 0.0025 * W)}px 0 ${alpha(NUANCES.ivoire, verreEncre ? 0.2 : 0.35)}, ${ombre3(W, 0.55)}`,
        fontFamily: POLICES.titre,
        fontSize: taille,
        lineHeight: 1,
        letterSpacing: "0.04em",
        color: NUANCES.ivoire,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        transform: `rotate(${inclinaison}deg) scale(${echelle})`,
        filter: flou > 0.05 ? `blur(${flou}px)` : undefined,
        ...style,
      }}
    >
      {texte}
    </div>
  );
}
