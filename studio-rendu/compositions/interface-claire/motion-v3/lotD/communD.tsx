/**
 * OUTILS COMMUNS DU LOT D « La typo vivante » (v3, 16/10/2026) — standard : STANDARD-DA-V3-2026-10-16.md (§ C.3, C.4, D.5, E.2, F.2).
 *
 * Ce fichier n'est PAS un élément. Il porte : les ressorts nommés v3 (`VERRE`, `PIVOT`, `FOUET`) en plus des ressorts v2
 * (`JAILLIR`, `CLAQUER`, `POSER`, `GLISSER`), l'ombre douce en 3 couches (une seule lumière, du haut), le flou DIRECTIONNEL
 * bon marché (filtre SVG `feGaussianBlur stdDeviation="X 0"` dans un conteneur tourné), la puce (« chip ») v3, le grain,
 * les bruitages (fichiers `sons/`, CC0) et le chargement des polices. Aucune teinte nouvelle : tout vient de `N3` (= NUANCES).
 * Aucun fichier existant n'est modifié : les outils v2 sont importés tels quels.
 */
import React from "react";
import { Audio, Sequence, spring, staticFile } from "remotion";
import { chargerPoliceMontserrat, chargerPoliceTitre } from "../../../commune/polices";
import { POLICES } from "../../charte";
import { avancesLettres, borne, boiteTournee, courbe, dimensionsMot, entrant, FPS, intersecte, lin, N3, PRISE_COMMUNE_LOT, RESSORTS, ressort as ressortV2, TAILLE_MIN, zonePx } from "../../motion-v2/lot3/outils3";
import type { FicheLot3, PriseLot, RectPx } from "../../motion-v2/lot3/outils3";

export { avancesLettres, borne, boiteTournee, courbe, dimensionsMot, entrant, FPS, intersecte, lin, N3, PRISE_COMMUNE_LOT, TAILLE_MIN, zonePx, POLICES };
export type { FicheLot3, PriseLot, RectPx };

/* ------------------------------------------------------------------ Couleurs ------------------------------------------------------------------ */

/** Transparence d'une couleur de la charte (aucune teinte nouvelle : seule l'opacité change). */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
export const DEGRADE_ORANGE = `linear-gradient(180deg, ${N3.orangeChaud} 0%, ${N3.orangeProfond} 100%)`;

/* ------------------------------------------------------------------ Ressorts ------------------------------------------------------------------ */

/** Ressorts v3 du standard (§ C.4). Dépassements théoriques : ζ = damping ÷ (2√(stiffness × mass)). */
export const RESSORTS_V3 = Object.freeze({
  VERRE: { damping: 16, stiffness: 180, mass: 0.9 },
  PIVOT: { damping: 11, stiffness: 120, mass: 1 },
  FOUET: { damping: 30, stiffness: 520, mass: 0.6 },
} as const);
export type NomRessortD = keyof typeof RESSORTS_V3 | keyof typeof RESSORTS;

/** Valeur 0 → 1 (avec dépassement) du ressort `nom`, `k` images après son départ. */
export function rs(k: number, nom: NomRessortD): number {
  if (k <= 0) return 0;
  if (nom in RESSORTS_V3) return spring({ frame: k, fps: FPS, config: RESSORTS_V3[nom as keyof typeof RESSORTS_V3] });
  return ressortV2(k, nom as keyof typeof RESSORTS);
}

/** Secousse de l'ÉLÉMENT SEUL (jamais de la prise) sur 8 images. */
export function secousseD(kLocal: number, amplitudePx: number): number {
  if (kLocal < 0 || kLocal > 8) return 0;
  return amplitudePx * Math.exp(-kLocal / 3) * Math.sin((2 * Math.PI * kLocal) / 3);
}

/* ------------------------------------------------------------------ Matière ------------------------------------------------------------------ */

/**
 * Ombre douce en 3 couches (§ C.3), lumière du haut : toutes les ombres tombent vers le bas.
 * `cran` 2 = plan P2 (plus proche) : 2ᵉ et 3ᵉ couches décalées et grandes de ×1,3.
 */
export function ombres(W: number, cran: 1 | 2 = 1, teinte: string = N3.encre): string {
  const f = cran === 2 ? 1.3 : 1;
  return [
    `0 ${0.004 * W}px ${0.01 * W}px ${alpha(teinte, 0.2)}`,
    `0 ${0.018 * W * f}px ${0.045 * W * f}px ${alpha(teinte, 0.24)}`,
    `0 ${0.045 * W * f}px ${0.11 * W * f}px ${alpha(teinte, 0.16)}`,
  ].join(", ");
}

/** Reflet haut (la fonction `reflet()` de premium-2, portée à 0,0025 L et 35 %). */
export const refletHaut = (W: number) => `inset 0 ${Math.max(1.5, 0.0025 * W)}px 0 ${alpha(N3.ivoire, 0.35)}`;

/** Grain fin (SVG `feTurbulence` en image de fond, fixe, jamais animé) : `force` ≈ 0,02 pour 2 %. */
export function grainUri(force = 0.02): string {
  const a = (force * 3).toFixed(3);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='11'/>` +
    `<feColorMatrix type='matrix' values='0 0 0 0 0.07  0 0 0 0 0.04  0 0 0 0 0.02  0 0 0 ${a} 0'/></filter><rect width='220' height='220' filter='url(%23g)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
}

/* ------------------------------------------------------------------ Polices ------------------------------------------------------------------ */

/** Charge Montserrat ExtraBold et Inter Bold (le rendu attend leur chargement : jamais de police de secours). */
export function usePolicesD(): void {
  chargerPoliceMontserrat();
  chargerPoliceTitre();
}

/* ------------------------------------------------------------------ Flou directionnel (§ D.5) ------------------------------------------------------------------ */

/**
 * Flou de mouvement DIRECTIONNEL bon marché : un conteneur tourné de `angle` degrés porte le filtre `stdDeviation="px 0"`,
 * le contenu est remis droit. `px` = 0 → aucun filtre (aucun coût hors des images rapides).
 * Le contenu est centré en (cx, cy) dans un carré de côté `cote`.
 */
export function FlouDir({ cx, cy, cote, angle, px, children }: { cx: number; cy: number; cote: number; angle: number; px: number; children: React.ReactNode }) {
  const id = "fd" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const actif = px >= 0.4;
  return (
    <div style={{ position: "absolute", left: cx - cote / 2, top: cy - cote / 2, width: cote, height: cote, display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${angle}deg)`, pointerEvents: "none" }}>
      {actif ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <filter id={id} filterUnits="userSpaceOnUse" x={-cote} y={-cote} width={3 * cote} height={3 * cote}>
              <feGaussianBlur stdDeviation={`${px.toFixed(2)} 0`} />
            </filter>
          </defs>
        </svg>
      ) : null}
      <div style={{ filter: actif ? `url(#${id})` : undefined, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `rotate(${-angle}deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Puce v3 (§ E.2) ------------------------------------------------------------------ */

/** Largeur (px) d'une puce de police `fs` px portant `mot` (marges incluses). */
export function largeurPuce(mot: string, fs: number): number {
  return avancesLettres(mot, fs).reduce((a, b) => a + b, 0) * 1.02 + 1.24 * fs + 0.04 * fs * mot.length;
}
export const hauteurPuce = (fs: number) => fs * 1.4;

/**
 * Puce v3 : `degradeOrange`, coins de 0,22 em, reflet en haut, ombre douce en 2 couches, SANS contour.
 * `reflet` : position (0 → 1) de la bande de lumière qui traverse la puce (hors de 0 → 1 : invisible).
 * Le centre de la puce est son centre géométrique ; les transformations sont à la charge de l'appelant.
 */
export function Puce({ mot, fs, W, reflet = -1, verre = false, ombre = true }: { mot: string; fs: number; W: number; reflet?: number; verre?: boolean; ombre?: boolean }) {
  const w = largeurPuce(mot, fs);
  const h = hauteurPuce(fs);
  const fond = verre ? alpha(N3.encre, 0.78) : DEGRADE_ORANGE;
  const bande = reflet > -0.05 && reflet < 1.05 ? `linear-gradient(110deg, transparent ${reflet * 160 - 40}%, ${alpha(N3.ivoire, 0.55)} ${reflet * 160 - 20}%, transparent ${reflet * 160}%)` : undefined;
  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: "border-box",
        borderRadius: 0.22 * fs,
        background: bande ? `${bande}, ${fond}` : fond,
        boxShadow: `${refletHaut(W)}${ombre ? `, 0 ${0.012 * W}px ${0.03 * W}px ${alpha(N3.encre, 0.3)}, 0 ${0.004 * W}px ${0.008 * W}px ${alpha(N3.encre, 0.22)}` : ""}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: POLICES.titre,
        fontWeight: 800,
        fontSize: fs,
        letterSpacing: "0.04em",
        lineHeight: 1,
        color: N3.ivoire,
        textShadow: `0 ${0.04 * fs}px ${0.1 * fs}px ${alpha(N3.encre, 0.35)}`,
        whiteSpace: "nowrap",
        paddingLeft: "0.04em",
      }}
    >
      {mot}
    </div>
  );
}

/* ------------------------------------------------------------------ Bruitages ------------------------------------------------------------------ */

export type SonD = { k: number; fichier: string; volume?: number; rate?: number };

/** Pose les bruitages d'un élément : `k` = image (depuis i0) ; `debut` = instant (s) de i0. Fichiers de `sons/` (Kenney, CC0). */
export function Sons({ debut, sons }: { debut: number; sons: readonly SonD[] }) {
  return (
    <>
      {sons.map((s, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(debut * FPS + s.k))} durationInFrames={60} layout="none">
          <Audio src={staticFile(`sons/${s.fichier}.wav`)} volume={s.volume ?? 0.8} playbackRate={s.rate ?? 1} />
        </Sequence>
      ))}
    </>
  );
}

/** Calque plein cadre (HTML) : rien ne capte la souris, tout reste dans l'image. */
export function Calque({ W, H, children, style }: { W: number; H: number; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", pointerEvents: "none", ...style }}>{children}</div>
  );
}
