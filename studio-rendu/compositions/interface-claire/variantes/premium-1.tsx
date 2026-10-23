import React from "react";
/**
 * AIDES « PREMIUM » du designer n° 1 (cartes Frise, Message tapé, Grille de vignettes, Liste cochée — 15/10/2026).
 * Standard : `<dossier-de-plan-prive>/CARTES-20-PREMIUM-2026-10-15.md`.
 *
 * Fichier NOUVEAU, par AJOUT seulement : rien ici ne modifie `charte.ts`, `elements.tsx` ni `mouvement.ts`. Quand le
 * socle commun (`NUANCES`, `pose`, `claque`, `glisse`, `Grain`, `Reflet`…) sera écrit dans ces fichiers, ces aides
 * s'y fondront à l'identique (mêmes noms, mêmes valeurs).
 */
import type { CSSProperties } from "react";
import { Easing, interpolate } from "remotion";
import { COULEURS, GEOMETRIE, POLICES } from "../charte";

/* ------------------------------------------------------------------ Les 12 jetons de couleur ------------------------------------------------------------------ */

/** Les 4 couleurs de la charte et leurs mélanges calculés (standard § 2.4). Aucune autre teinte. */
export const NUANCES = Object.freeze({
  ivoire: COULEURS.ivoire,
  ivoireCreux: "#DECFB9",
  sableClair: "#D4C2AA",
  sable: COULEURS.sable,
  sableProfond: "#94806A",
  filet: "#CBBFAD",
  orangeVoile: "#DEC0A8",
  orange: COULEURS.orange,
  orangeChaud: "#BC6441",
  orangeProfond: "#934122",
  encreDouce: "#45392D",
  encre: COULEURS.encre,
} as const);

/** Encre avec opacité (ombres, grain) : la teinte reste l'encre de la charte. */
export const encreA = (alpha: number) => `rgba(17, 10, 5, ${alpha})`;
/** Ivoire avec opacité (reflets). */
export const ivoireA = (alpha: number) => `rgba(233, 220, 200, ${alpha})`;

/* ------------------------------------------------------------------ Courbes nommées (standard § 2.5) ------------------------------------------------------------------ */

const BORNE = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** « pose » : ressort amorti, ≈ 6 % de dépassement (back 1,3), 0,18-0,25 s. */
export const pose = (t: number, debut: number, duree = 0.22) => interpolate(t, [debut, debut + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(1.3)) });
/** « claque » : ≈ 11 % de dépassement en 0,1 s (mot fort). */
export const claque = (t: number, debut: number, duree = 0.1) => interpolate(t, [debut, debut + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.back(1.9)) });
/** « glisse » : départ rapide, arrivée très douce (expo out), 0,15-0,22 s. */
export const glisse = (t: number, debut: number, duree = 0.18) => interpolate(t, [debut, debut + duree], [0, 1], { ...BORNE, easing: Easing.out(Easing.exp) });
/** « sortie » : anticipation de 3 % en sens inverse (0,04 s) puis départ cubic in (0,12 s). Rend -0,03 → 1. */
export function sortieAnticipee(t: number, debut: number): number {
  if (t < debut) return 0;
  if (t < debut + 0.04) return -0.03 * Math.sin((Math.PI / 2) * ((t - debut) / 0.04));
  return -0.03 + 1.03 * interpolate(t, [debut + 0.04, debut + 0.16], [0, 1], { ...BORNE, easing: Easing.in(Easing.cubic) });
}
/** Bosse 0 → 1 → 0 (écrasement du conteneur, pulsation). */
export const bosse = (t: number, debut: number, duree: number) => (t < debut || t > debut + duree ? 0 : Math.sin((Math.PI * (t - debut)) / duree));
/** Fondu des deux premières images d'une entrée (0,08 s). */
export const fondu = (t: number, debut: number) => interpolate(t, [debut, debut + 0.08], [0, 1], BORNE);

/* ------------------------------------------------------------------ Typographie (standard § 2.1) ------------------------------------------------------------------ */

/** Les 3 niveaux, en px, à la largeur `W` de l'image. Plancher absolu : 0,024 L. */
export const TYPO = Object.freeze({
  minimum: (W: number) => Math.ceil(W * 0.024),
  corps: (W: number) => W * 0.032,
  titre: (W: number) => W * 0.042,
  heros: (W: number) => W * 0.1,
});

/** Style « titre » : Montserrat ExtraBold, capitales, interlettrage +0,04 em, chiffres tabulaires. */
export const styleTitre = (taille: number, couleur: string): CSSProperties => ({
  fontFamily: POLICES.titre,
  fontSize: taille,
  lineHeight: 1,
  color: couleur,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
});

/** Style « corps » : Inter Bold, casse normale. */
export const styleCorps = (taille: number, couleur: string): CSSProperties => ({
  fontFamily: POLICES.texte,
  fontSize: taille,
  lineHeight: 1.25,
  color: couleur,
});

/** Largeur estimée (px) d'un texte en Inter Bold, casse naturelle (volontairement un peu large). */
export function largeurInter(texte: string, taille: number): number {
  let s = 0;
  for (const c of texte) {
    if (/\s/.test(c)) s += 0.27;
    else if (/[MWmw]/.test(c)) s += 0.9;
    else if (/[iljIt'’.,:;!|f]/.test(c)) s += 0.32;
    else if (/[A-ZÀÂÉÈÊÎÔÙÛÇ]/.test(c)) s += 0.7;
    else if (/\d/.test(c)) s += 0.64;
    else s += 0.6;
  }
  return s * taille;
}

/** Largeur estimée (px) d'un texte en Montserrat ExtraBold CAPITALES avec interlettrage +0,04 em. */
export function largeurTitre(texte: string, taille: number): number {
  let s = 0;
  for (const c of texte.toUpperCase()) {
    if (/\s/.test(c)) s += 0.3;
    else if (/[MWÆŒ]/.test(c)) s += 0.98;
    else if (/[IJ1|!]/.test(c)) s += 0.36;
    else if (/[.,:;'’()«»\-]/.test(c)) s += 0.36;
    else if (/\d/.test(c)) s += 0.72;
    else s += 0.76;
    s += 0.04;
  }
  return s * taille;
}

/** Taille qui fait tenir `largeur(texte, 1)` dans `place`, bornée à [min, max]. */
export const tailleQuiTient = (largeur1: number, place: number, min: number, max: number) => Math.max(min, Math.min(max, place / Math.max(1e-6, largeur1)));

/** Coupe un texte en lignes (Inter) de largeur `place` au plus. */
export function couperLignes(texte: string, taille: number, place: number): string[] {
  const mots = texte.split(/\s+/).filter(Boolean);
  const lignes: string[] = [];
  let cur = "";
  for (const m of mots) {
    const essai = cur ? `${cur} ${m}` : m;
    if (cur && largeurInter(essai, taille) > place) {
      lignes.push(cur);
      cur = m;
    } else cur = essai;
  }
  if (cur) lignes.push(cur);
  return lignes;
}

/* ------------------------------------------------------------------ Relief (standard § 2.3) ------------------------------------------------------------------ */

/** Épaisseurs (px) à la largeur `W`. */
export const RELIEF = Object.freeze({
  filet: (W: number) => Math.max(2, Math.round(W * 0.0018)),
  contourHeros: (W: number) => Math.max(3, Math.round(W * 0.003)),
  ombreHeros: (W: number) => Math.max(4, Math.round(W * 0.005)),
  rayon: (W: number) => Math.round(W * 0.012),
});

/** Micro-ombre des éléments posés : encre 12 %, flou 0,006 L, décalage 0,003 L. */
export const microOmbre = (W: number, force = 1): string => `0 ${Math.round(W * 0.003 * force)}px ${Math.round(W * 0.006 * force)}px ${encreA(0.12)}`;

/** Ombre intérieure d'un champ en creux (10 %). */
export const ombreCreux = (W: number): string => `inset 0 ${Math.round(W * 0.003)}px ${Math.round(W * 0.006)}px ${encreA(0.1)}`;

/** L'UNIQUE héros d'une carte : contour encre 0,003 L + ombre dure 0,005 L (+ reflet en haut, à poser avec `Reflet`). */
export function styleHeros(W: number, fond: string, rayon: number): CSSProperties {
  return {
    background: fond,
    border: `${RELIEF.contourHeros(W)}px solid ${NUANCES.encre}`,
    borderRadius: rayon,
    boxShadow: `${RELIEF.ombreHeros(W)}px ${RELIEF.ombreHeros(W)}px 0 ${NUANCES.encre}`,
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
  };
}

/** Dégradé vertical orange (orange-chaud → orange-profond), entre jetons voisins. */
export const degradeOrange = `linear-gradient(180deg, ${NUANCES.orangeChaud} 0%, ${NUANCES.orange} 55%, ${NUANCES.orangeProfond} 100%)`;
/** Dégradé vertical encre (encre-douce → encre). */
export const degradeEncre = `linear-gradient(180deg, ${NUANCES.encreDouce} 0%, ${NUANCES.encre} 100%)`;

/** Reflet ivoire de 2 px à 22 % en haut d'une surface orange ou encre (le parent est `position: relative`). */
export function Reflet({ rayon, inset = 2 }: { rayon: number; inset?: number }) {
  return <div style={{ position: "absolute", left: inset + rayon * 0.35, right: inset + rayon * 0.35, top: inset, height: 2, borderRadius: 1, background: ivoireA(0.22), pointerEvents: "none" }} />;
}

/** Grain fixe : bruit `feTurbulence` encre à 3,5 %, sur toute la surface du parent (`position: relative`). */
export function Grain({ id, opacite = 0.035 }: { id: string; opacite?: number }) {
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "multiply" }}>
      <filter id={`grain-${id}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values={`0 0 0 0 0.067  0 0 0 0 0.039  0 0 0 0 0.02  0 0 0 ${opacite * 9} 0`} />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${id})`} />
    </svg>
  );
}

/* ------------------------------------------------------------------ Chiffre roulant (tambour tabulaire) ------------------------------------------------------------------ */

/**
 * Nombre qui ROULE comme un tambour vers sa nouvelle valeur : l'ancien chiffre monte et sort pendant que le nouveau
 * arrive du bas (0,16 s, « glisse »). `changements` : instants où la valeur augmente de 1 (triés).
 */
export function ChiffreRoulant({ t, depart, changements, taille, couleur, couleurChange }: { t: number; depart: number; changements: number[]; taille: number; couleur: string; couleurChange?: string }) {
  const passes = changements.filter((c) => t >= c);
  const valeur = depart + passes.length;
  const k = passes.length ? glisse(t, passes[passes.length - 1], 0.16) : 1;
  const enCours = k < 1;
  const h = taille * 1.05;
  return (
    <span style={{ position: "relative", display: "inline-block", height: h, overflow: "hidden", verticalAlign: "bottom" }}>
      <span style={{ display: "block", ...styleTitre(taille, enCours && couleurChange ? couleurChange : couleur), lineHeight: `${h}px`, transform: `translateY(${(1 - k) * h}px)` }}>{valeur}</span>
      {enCours ? <span style={{ position: "absolute", left: 0, top: 0, ...styleTitre(taille, couleur), lineHeight: `${h}px`, transform: `translateY(${-k * h}px)` }}>{valeur - 1}</span> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ Divers ------------------------------------------------------------------ */

/** Largeur intérieure (px) du corps d'une `Carte` (largeur de carte − marges de 0,04 L de chaque côté). */
export const largeurCorps = (W: number) => W * (GEOMETRIE.carteL - 0.08);

/** Pseudo-aléa déterministe dans [0, 1[ (frappe irrégulière, scintillements). */
export function alea(i: number, graine = 1): number {
  const x = Math.sin(i * 12.9898 + graine * 78.233) * 43758.5453;
  return x - Math.floor(x);
}
