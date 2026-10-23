import React, { useId } from "react";
/**
 * SOCLE « PREMIUM » du designer n° 2 (15/10/2026) — petites aides partagées par les 4 cartes redessinées Calendrier,
 * Graphique, Statuts et Calcul (standard : `<dossier-de-plan-prive>/CARTES-20-PREMIUM-2026-10-15.md`).
 *
 * Rien ici ne modifie `charte.ts`, `elements.tsx` ni `mouvement.ts` : quand le socle commun y sera ajouté (NUANCES,
 * courbes nommées, Grain, Reflet, TamponExemple), ces aides pourront être remplacées une à une sans changer le rendu.
 *
 *  - NUANCES : les 12 jetons de couleur (les 4 couleurs de la charte et des mélanges calculés entre elles) ;
 *  - TYPO : les 3 niveaux typographiques (héros, titre, corps) en fraction de la largeur de l'image ;
 *  - courbes « pose », « claque », « glisse », « sortieAnticipee » ;
 *  - `eclat` : flash de sous-élément (orange plein 0,12 s puis retour en 0,06 s, mesurable à + 0,12 s) ;
 *  - Grain, reflet, micro-ombre, relief « héros », tampon EXEMPLE.
 */
import type { CSSProperties } from "react";
import { POLICES, largeurTexte } from "../charte";

/* ------------------------------------------------------------------ Couleurs ------------------------------------------------------------------ */

/** Les 12 jetons (rôle unique chacun). Aucune autre teinte n'est permise dans les cartes premium. */
export const NUANCES = Object.freeze({
  ivoire: "#E9DCC8",
  ivoireCreux: "#DECFB9",
  sableClair: "#D4C2AA",
  /** « En attente » uniquement. */
  sable: "#BFA88B",
  sableProfond: "#94806A",
  filet: "#CBBFAD",
  orangeVoile: "#DEC0A8",
  /** « Actif / fort » uniquement. */
  orange: "#B44F29",
  orangeChaud: "#BC6441",
  orangeProfond: "#934122",
  encreDouce: "#45392D",
  encre: "#110A05",
} as const);

/** `#RRGGBB` → `rgba(r, g, b, a)` (transparences des jetons, jamais une nouvelle teinte). */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Dégradé vertical entre deux jetons voisins. */
export const degradeOrange = `linear-gradient(180deg, ${NUANCES.orangeChaud} 0%, ${NUANCES.orangeProfond} 100%)`;
export const degradeIvoire = `linear-gradient(180deg, ${NUANCES.ivoire} 0%, ${NUANCES.ivoireCreux} 100%)`;

/* ------------------------------------------------------------------ Typographie ------------------------------------------------------------------ */

/** Trois niveaux (fractions de la largeur de l'image L). Rapport ≥ 1,5 entre voisins ; rien sous 0,024 L. */
export const TYPO = Object.freeze({ heros: 0.09, titre: 0.042, titreMin: 0.034, corps: 0.028, corpsMin: 0.026, minimum: 0.024, interlettrage: 0.04 });

/** Police du titre (Montserrat ExtraBold, capitales, interlettrage + 0,04 em). */
export function styleTitre(taille: number, couleur: string): CSSProperties {
  return { fontFamily: POLICES.titre, fontSize: taille, color: couleur, textTransform: "uppercase", letterSpacing: `${TYPO.interlettrage}em`, lineHeight: 1.05, whiteSpace: "nowrap" };
}

/** Police du corps (Inter Bold, casse normale). */
export function styleCorps(taille: number, couleur: string): CSSProperties {
  return { fontFamily: POLICES.texte, fontSize: taille, color: couleur, lineHeight: 1.15, whiteSpace: "nowrap" };
}

/** Largeur ESTIMÉE (px, un peu large) d'un texte en Inter Bold, casse normale. */
export function largeurCorps(texte: string, taille: number): number {
  let s = 0;
  for (const c of texte) {
    if (/\s/.test(c)) s += 0.28;
    else if (/[MWmw]/.test(c)) s += 0.9;
    else if (/[iljIt'’.,:;!|f]/.test(c)) s += 0.34;
    else if (/[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ]/.test(c)) s += 0.72;
    else if (/\d/.test(c)) s += 0.64;
    else s += 0.6;
  }
  return s * taille;
}

/** Largeur ESTIMÉE (px) d'un titre (capitales, interlettrage compris). */
export const largeurTitre = (texte: string, taille: number) => largeurTexte(texte, taille) + [...texte].length * TYPO.interlettrage * taille;

/** Plus grande taille dans [min, max] qui fait tenir `largeur(taille)` dans `dispo`. */
export function tailleQuiTient(max: number, min: number, dispo: number, largeur: (t: number) => number): number {
  const l1 = largeur(1);
  if (l1 <= 0) return max;
  return Math.max(min, Math.min(max, dispo / l1));
}

/* ------------------------------------------------------------------ Mouvement ------------------------------------------------------------------ */

const borne01 = (x: number) => Math.min(1, Math.max(0, x));

/** Ressort amorti : 0 → 1 en `duree`, dépassement ≈ `depassement` (0,06 = 6 %), posé net à 1,1 × `duree`. */
function ressort(t: number, a: number, duree: number, depassement: number): number {
  const u = t - a;
  if (u <= 0) return 0;
  // Pic du dépassement à 55 % de la durée ; le 2ᵉ extrême (≈ dépassement²) tombe à 1,1 × durée, où l'on pose à 1.
  if (u >= duree * 1.1) return 1;
  const k = -Math.log(depassement) / Math.PI; // σ / ωd
  const wd = Math.PI / (0.55 * duree);
  const s = k * wd;
  return 1 - Math.exp(-s * u) * (Math.cos(wd * u) + k * Math.sin(wd * u));
}

/** « pose » : ressort, ≈ 6 % de dépassement, 0,18-0,25 s. */
export const pose = (t: number, a: number, duree = 0.22, depassement = 0.06) => ressort(t, a, duree, depassement);
/** « claque » : 10-12 % de dépassement en 0,1 s (mot fort). */
export const claque = (t: number, a: number, duree = 0.1) => ressort(t, a, duree, 0.11);
/** « glisse » : départ rapide, arrivée très douce (expo out), 0,15-0,22 s. */
export function glisse(t: number, a: number, duree = 0.18): number {
  const p = borne01((t - a) / duree);
  return p >= 1 ? 1 : (1 - Math.pow(2, -10 * p)) / (1 - Math.pow(2, -10));
}
/** « sortie » : anticipation de 3 % en sens inverse (0,04 s) puis départ en accélération (cubic in, 0,12 s). Rend -0,03 → 1. */
export function sortieAnticipee(t: number, a: number): number {
  const u = t - a;
  if (u <= 0) return 0;
  if (u < 0.04) return -0.03 * Math.sin((Math.PI / 2) * (u / 0.04));
  const p = borne01((u - 0.04) / 0.12);
  return -0.03 + 1.03 * p * p * p;
}
/** Bosse 0 → 1 → 0 (suivi, écrasement du conteneur). */
export const bosse = (t: number, a: number, duree: number) => (t < a || t > a + duree ? 0 : Math.sin((Math.PI * (t - a)) / duree));
/** Fondu d'arrivée sur les deux premières images (≈ 0,08 s). */
export const fonduEntree = (t: number, a: number) => borne01((t - a) / 0.08);

/** Flash d'un sous-élément : orange plein 0,12 s puis retour en 0,06 s (l'image à + 0,12 s le montre encore à 100 %). */
export const ECLAT = Object.freeze({ tenue: 0.12, retour: 0.06 });

/** Intensité (0 → 1) du flash le plus récent parmi `instants`. */
export function eclat(t: number, instants: number[]): number {
  let m = 0;
  for (const a of instants) {
    const u = t - a;
    if (u < 0) continue;
    if (u < ECLAT.tenue) return 1;
    if (u < ECLAT.tenue + ECLAT.retour) m = Math.max(m, 1 - (u - ECLAT.tenue) / ECLAT.retour);
  }
  return m;
}

/* ------------------------------------------------------------------ Relief et matière ------------------------------------------------------------------ */

/** Micro-ombre des éléments posés : encre à 12 %, flou 0,006 L, décalage 0,003 L. */
export const microOmbre = (W: number) => `0 ${Math.round(W * 0.003)}px ${Math.round(W * 0.006)}px ${alpha(NUANCES.encre, 0.12)}`;
/** Reflet ivoire de 2 px à 22 % en haut d'une surface orange ou encre (ombre intérieure). */
export const reflet = (W: number) => `inset 0 ${Math.max(1, Math.round(W * 0.0018))}px 0 ${alpha(NUANCES.ivoire, 0.22)}`;
/** Ombre intérieure d'un champ en creux. */
export const creux = (W: number) => `inset 0 ${Math.round(W * 0.002)}px ${Math.round(W * 0.004)}px ${alpha(NUANCES.encre, 0.1)}`;
/** Épaisseur d'un filet intérieur (0,0018 L). */
export const filetPx = (W: number) => Math.max(2, Math.round(W * 0.0018));

/** Relief du SEUL élément héros d'une carte : contour 0,003 L, ombre dure 0,005 L (+ reflet si surface sombre). */
export function styleHeros(W: number, avecReflet = true): CSSProperties {
  const c = Math.max(2, Math.round(W * 0.003));
  const o = Math.max(3, Math.round(W * 0.005));
  return { border: `${c}px solid ${NUANCES.encre}`, boxShadow: `${o}px ${o}px 0 ${NUANCES.encre}${avecReflet ? `, ${reflet(W)}` : ""}`, boxSizing: "border-box" };
}

/** Grain fixe (feTurbulence, encre à ≈ 3,5 %) posé sur une surface (le parent est `position: relative`). */
export function Grain({ opacite = 0.035, graine = 7, rayon = 0 }: { opacite?: number; graine?: number; rayon?: number }) {
  const id = `grain${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", borderRadius: rayon, overflow: "hidden" }}>
      <filter id={id} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={graine} stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 0.067  0 0 0 0 0.039  0 0 0 0 0.02  1 0 0 0 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} opacity={opacite * 2} />
    </svg>
  );
}

/** Tampon « EXEMPLE » standard : petit, encre, incliné de -6°, posé d'un coup (« claque »). Jamais sous 0,024 L. */
export function TamponExemple({ t, a, W, style }: { t: number; a: number; W: number; style?: CSSProperties }) {
  if (t < a) return null;
  const taille = Math.round(W * 0.025);
  const c = claque(t, a, 0.1);
  return (
    <div
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        border: `${Math.max(2, Math.round(W * 0.0028))}px solid ${NUANCES.encre}`,
        borderRadius: Math.round(W * 0.008),
        padding: `${Math.round(taille * 0.12)}px ${Math.round(taille * 0.38)}px`,
        background: alpha(NUANCES.ivoire, 0.9),
        ...styleTitre(taille, NUANCES.encre),
        letterSpacing: "0.1em",
        lineHeight: 1.1,
        opacity: fonduEntree(t, a),
        transform: `rotate(-6deg) scale(${1.25 - 0.25 * c})`,
      }}
    >
      Exemple
    </div>
  );
}

/** Largeur (px) du tampon EXEMPLE posé à plat (pour réserver sa place sur la grille). */
export const largeurTampon = (W: number) => {
  const taille = Math.round(W * 0.025);
  return largeurTitre("EXEMPLE", taille) + taille * 0.06 * 7 + taille * 0.76 + 2 * Math.max(2, Math.round(W * 0.0028)) + taille * 0.4;
};
export const hauteurTampon = (W: number) => Math.round(W * 0.025) * 1.45 + 2 * Math.max(2, Math.round(W * 0.0028)) + W * 0.012;

/** Largeur utile ESTIMÉE (px) du corps d'une carte (0,81 L moins les marges de `Carte.tsx`, au format 9:16). */
export const largeurCorpsCarte = (W: number) => W * 0.728;
