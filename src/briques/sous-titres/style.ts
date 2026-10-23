/**
 * STYLES DES SOUS-TITRES (catalogue, décision de Will du 01/10 : Karaoké, Minimal, Impact, Bandeau).
 * Un style est une DONNÉE : un seul moteur de rendu (`scene.ts`) les dessine tous, dans Remotion comme dans le
 * navigateur. PUR, imports de types seulement : importable par Remotion (`studio-rendu/compositions/sous-titres`).
 */
import type { NomPolice } from "./mesure";
import type { BaseRendu as BaseSousTitres, GabaritRendu as GabaritSousTitres, MarqueRendu, SegmentRendu, StyleBibliothequeRendu } from "./types-rendu";

export type AnimationGabarit = "karaoke" | "fondu" | "rebond" | "nette";

export interface DefinitionGabarit {
  id: GabaritSousTitres;
  nom: string;
  police: NomPolice;
  /** Graisse CSS de la police (le fichier chargé n'en contient qu'une). */
  poids: number;
  /** Taille de base pour une image de 1080 de large. */
  taillePx: number;
  casse: "normale" | "majuscules";
  /** Contour noir NOMINAL, tracé sous le remplissage (`paint-order: stroke fill`) : la moitié reste visible. */
  contourPx: number;
  ombre: { flouPx: number; decalagePx: number; opacite: number };
  /** Groupement : mots à la fois et durée d'affichage. */
  motsMin: number;
  motsMax: number;
  dureeMinSec: number;
  dureeMaxSec: number;
  animation: AnimationGabarit;
  /** Durée de l'entrée (fondu, rebond), en ms. */
  entreeMs: number;
  /** Mots en valeur colorés (« aucun » pour Minimal). */
  motCle: "un-mot" | "aucun";
  /** Karaoké : opacité des mots pas encore dits. */
  opaciteAVenir?: number;
  /** Bandeau : rectangle crème derrière le texte, texte noir. */
  bandeau?: { margeXEm: number; margeYEm: number };
  /** Espace entre les mots, en em. */
  espaceMotsEm: number;
}

/** Les 4 styles retenus. Signature et Pastille sont RETIRÉS (décision de Will). */
export const GABARITS: Record<GabaritSousTitres, DefinitionGabarit> = {
  karaoke: {
    id: "karaoke",
    nom: "Karaoké",
    police: "Poppins ExtraBold",
    poids: 800,
    taillePx: 70,
    casse: "normale",
    // Contour fin (3 px visibles) : la lecture tient sur les illustrations claires (B.5).
    contourPx: 6,
    ombre: { flouPx: 8, decalagePx: 3, opacite: 0.65 },
    motsMin: 2,
    motsMax: 4,
    dureeMinSec: 0.4,
    dureeMaxSec: 0.9,
    animation: "karaoke",
    entreeMs: 0,
    motCle: "un-mot",
    opaciteAVenir: 0.45,
    espaceMotsEm: 0.28,
  },
  minimal: {
    id: "minimal",
    nom: "Minimal",
    police: "Poppins Medium",
    poids: 500,
    taillePx: 60,
    casse: "normale",
    contourPx: 0,
    ombre: { flouPx: 10, decalagePx: 2, opacite: 0.8 },
    motsMin: 3,
    motsMax: 6,
    dureeMinSec: 0.6,
    dureeMaxSec: 1.6,
    animation: "fondu",
    entreeMs: 120,
    motCle: "aucun",
    espaceMotsEm: 0.28,
  },
  impact: {
    id: "impact",
    nom: "Impact",
    police: "Montserrat Black",
    poids: 900,
    // × 1,8 (très grand) : ≈ 126 px, comme la maquette (118-140 px).
    taillePx: 70,
    casse: "majuscules",
    contourPx: 16,
    ombre: { flouPx: 10, decalagePx: 6, opacite: 0.7 },
    motsMin: 1,
    motsMax: 2,
    dureeMinSec: 0.4,
    dureeMaxSec: 0.9,
    animation: "rebond",
    entreeMs: 240,
    motCle: "un-mot",
    espaceMotsEm: 0.24,
  },
  bandeau: {
    id: "bandeau",
    nom: "Bandeau",
    police: "Poppins ExtraBold",
    poids: 800,
    taillePx: 62,
    casse: "majuscules",
    contourPx: 0,
    ombre: { flouPx: 0, decalagePx: 0, opacite: 0 },
    motsMin: 2,
    motsMax: 4,
    dureeMinSec: 0.4,
    dureeMaxSec: 1.2,
    animation: "nette",
    entreeMs: 0,
    motCle: "un-mot",
    bandeau: { margeXEm: 0.48, margeYEm: 0.3 },
    espaceMotsEm: 0.28,
  },
};

export const BASES: readonly BaseSousTitres[] = ["karaoke", "minimal"];

/**
 * Gabarit d'un élément de Bibliothèque. Un élément d'avant le lot M2 (sans `gabarit`) est lu sans être réécrit :
 * karaoké pour l'ancien « surlignage » et le style avocat, Impact pour « pop » en majuscules, Minimal pour le reste.
 */
export function gabaritDe(valeur: StyleBibliothequeRendu | null | undefined): GabaritSousTitres {
  if (!valeur) return "karaoke";
  if (valeur.gabarit) return valeur.gabarit;
  if (valeur.animation === "surlignage" || valeur.animation === "mot-par-mot") return "karaoke";
  if (valeur.animation === "pop") return valeur.casse === "majuscules" ? "impact" : "karaoke";
  return valeur.position === "bas" ? "minimal" : "karaoke";
}

/** Base d'une vidéo depuis un gabarit : Impact et Bandeau ne sont que des accents. */
export function baseDe(gabarit: GabaritSousTitres): BaseSousTitres {
  return gabarit === "minimal" ? "minimal" : "karaoke";
}

/** Facteur de taille (3 niveaux) : normal ×1, grand ×1,3, très grand ×1,8 (Impact). */
export function facteurTaille(segment: Pick<SegmentRendu, "style" | "importance">): number {
  const imp = segment.importance ?? 0;
  if (segment.style === "impact") return imp >= 3 ? 1.8 : 1.3;
  return imp >= 3 ? 1.3 : 1;
}

export interface CouleursSousTitres {
  /** Texte crème. */
  texte: string;
  /** Emphase : jeton de la marque (`orange-vif` par défaut), jamais une valeur écrite dans le moteur. */
  accent: string;
  /** Contour, ombre, texte du bandeau. */
  contour: string;
}

/** Valeurs de repli = celles des jetons de `app/globals.css` (et de la marque Axion). */
export const COULEURS_REPLI: CouleursSousTitres = { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" };

function jeton(marque: MarqueRendu | null | undefined, nom: string): string | undefined {
  const cible = nom.replace(/^--/, "");
  return marque?.couleurs.find((c) => c.jeton.replace(/^--/, "") === cible)?.valeur;
}

/** Couleurs lues dans la marque par leur JETON (emphase : `jetonEmphase` du style, `orange-vif` par défaut). */
export function couleursDepuisMarque(marque: MarqueRendu | null | undefined, jetonEmphase = "orange-vif"): CouleursSousTitres {
  return {
    texte: jeton(marque, "texte") ?? COULEURS_REPLI.texte,
    accent: jeton(marque, jetonEmphase) ?? COULEURS_REPLI.accent,
    contour: jeton(marque, "fond") ?? COULEURS_REPLI.contour,
  };
}

/** Convertit « #RRGGBB » + opacité en rgba() (ombre). */
export function rgba(hex: string, opacite: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacite})`;
}

/**
 * Propriétés CSS communes d'une ligne (Remotion ET navigateur) : contour sous le remplissage, coins arrondis,
 * chiffres alignés à chasse fixe (B.5, v3.2). `famille` : nom CSS de la police chargée par chaque côté.
 */
export function cssLigne(g: DefinitionGabarit, taillePx: number, couleurs: CouleursSousTitres, famille: string): Record<string, string | number> {
  const css: Record<string, string | number> = {
    fontFamily: famille,
    fontWeight: g.poids,
    fontSize: taillePx,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    textTransform: g.casse === "majuscules" ? "uppercase" : "none",
    fontVariantNumeric: "lining-nums tabular-nums",
    fontFeatureSettings: '"lnum" 1, "tnum" 1',
    paintOrder: "stroke fill",
    strokeLinejoin: "round",
    WebkitFontSmoothing: "antialiased",
  };
  if (g.contourPx > 0) {
    css.WebkitTextStroke = `${g.contourPx}px ${couleurs.contour}`;
  }
  if (g.ombre.opacite > 0) {
    css.textShadow = `0 ${g.ombre.decalagePx}px ${g.ombre.flouPx}px ${rgba(couleurs.contour, g.ombre.opacite)}`;
  }
  return css;
}
