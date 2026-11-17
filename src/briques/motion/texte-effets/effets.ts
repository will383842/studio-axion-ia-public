/**
 * PETITS EFFETS DE TEXTE : valeurs pures (C11-T8a). Aucun composant, aucune inscription : rien n'appelle ce module.
 * Chaque effet est une fonction pure `(image, ips, options) → style` (nombres et chaînes CSS simples).
 * Un effet s'applique au TEXTE, jamais au visage : aucune fonction ne reçoit de zone du cadre.
 * Manrope seule ; couleurs prises dans la charte ; liste fermée (ni « mème », ni légende « native »).
 * Le surcoût de rendu du flou et du noir et blanc (AM-05) reste à mesurer avant tout allumage.
 */

import { FAMILLE_CSS, PALETTE } from "../../charte/axion-2026";

export const EFFETS_TEXTE = [
  "flou-mot",
  "noir-blanc-mot",
  "degrade-balaye",
  "retrogradation",
  "aparte-fantome",
  "titre-survit",
  "interlettrage-serre",
  "intonation",
  "contour-marque",
] as const;

export type EffetTexte = (typeof EFFETS_TEXTE)[number];

/** Plafond du flou, en px : jamais en plein cadre. */
export const FLOU_MAX_PX = 6;
/** Plafond de l'opacité de l'aparté. */
export const OPACITE_APARTE_MAX = 0.35;
/** Survie du titre après la coupe, en secondes. */
export const SURVIE_TITRE_S = 0.3;
/** Interlettrage de départ (em) et durée du resserrement (s). */
export const INTERLETTRAGE_DEPART_EM = 0.2;
export const INTERLETTRAGE_DUREE_S = 0.4;
/** Graisses permises pour l'intonation. */
export const GRAISSE_LEGERE = 300;
export const GRAISSE_FORTE = 800;

const borne = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
/** Progression linéaire 0 → 1 sur `dureeS` secondes. */
function progression(image: number, ips: number, dureeS: number): number {
  const n = Math.max(1, Math.round(dureeS * ips));
  return borne(image / n, 0, 1);
}
const arrondi = (v: number) => Math.round(v * 1e4) / 1e4;

/* ---------------------------- flou-mot ---------------------------- */

export type OptionsFlouMot = { dureeS?: number; flouMaxPx?: number };
export type StyleFlou = { filtre: string };

/** Le mot passe du flou au net. Flou plafonné à 6 px. */
export function effetFlouMot(image: number, ips: number, options: OptionsFlouMot = {}): StyleFlou {
  const max = borne(options.flouMaxPx ?? FLOU_MAX_PX, 0, FLOU_MAX_PX);
  const p = progression(image, ips, options.dureeS ?? 0.5);
  return { filtre: `blur(${arrondi(max * (1 - p))}px)` };
}

/* -------------------------- noir-blanc-mot ------------------------ */

export type OptionsNoirBlanc = { dureeS?: number };
export type StyleGris = { filtre: string };

/** Le mot seul passe du noir et blanc à la couleur (niveaux de gris, rien d'autre). */
export function effetNoirBlancMot(image: number, ips: number, options: OptionsNoirBlanc = {}): StyleGris {
  const p = progression(image, ips, options.dureeS ?? 0.5);
  return { filtre: `grayscale(${arrondi(1 - p)})` };
}

/* -------------------------- degrade-balaye ------------------------ */

export type OptionsDegrade = { dureeS?: number };
export type StyleDegrade = {
  /** Couleur courante, mélange terracotta → ivoire (hex). */
  couleur: string;
  /** Avancée du balayage de gauche à droite, de 0 à 1. */
  balayage: number;
  depart: string;
  arrivee: string;
};

function melange(a: string, b: string, t: number): string {
  const canal = (h: string, k: number) => parseInt(h.slice(k, k + 2), 16);
  return (
    "#" +
    [1, 3, 5]
      .map((k) => Math.round(canal(a, k) + (canal(b, k) - canal(a, k)) * t).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/** De terracotta à ivoire (palette de la charte), sans chaîne de dégradé : couleur + avancée du balayage. */
export function effetDegradeBalaye(image: number, ips: number, options: OptionsDegrade = {}): StyleDegrade {
  const p = progression(image, ips, options.dureeS ?? 1);
  return {
    couleur: melange(PALETTE.terracotta, PALETTE.ivoire, p),
    balayage: arrondi(p),
    depart: PALETTE.terracotta,
    arrivee: PALETTE.ivoire,
  };
}

/* -------------------------- retrogradation ------------------------ */

export type OptionsRetrogradation = { barreS?: number };
export type StyleRetrogradation = { mot: "ancien" | "nouveau"; decoration: "line-through" | "none" };

/** Le mot est barré, puis remplacé par le nouveau. */
export function effetRetrogradation(image: number, ips: number, options: OptionsRetrogradation = {}): StyleRetrogradation {
  const bascule = Math.max(1, Math.round((options.barreS ?? 0.6) * ips));
  return image < bascule ? { mot: "ancien", decoration: "line-through" } : { mot: "nouveau", decoration: "none" };
}

/* -------------------------- aparte-fantome ------------------------ */

export type OptionsAparte = { dureeS?: number; opaciteMax?: number };
export type StyleOpacite = { opacite: number };

/** Texte en aparté : apparaît en filigrane, opacité 0,35 au plus. */
export function effetAparteFantome(image: number, ips: number, options: OptionsAparte = {}): StyleOpacite {
  const max = borne(options.opaciteMax ?? OPACITE_APARTE_MAX, 0, OPACITE_APARTE_MAX);
  return { opacite: arrondi(max * progression(image, ips, options.dureeS ?? 0.3)) };
}

/* --------------------------- titre-survit ------------------------- */

export type OptionsTitreSurvit = { coupeImage?: number };

/** Le titre reste plein jusqu'à 0,3 s après la coupe, puis vaut 0. */
export function effetTitreSurvit(image: number, ips: number, options: OptionsTitreSurvit = {}): StyleOpacite {
  const coupe = options.coupeImage ?? 0;
  return { opacite: image < coupe + Math.round(SURVIE_TITRE_S * ips) ? 1 : 0 };
}

/* ------------------------ interlettrage-serre --------------------- */

export type OptionsInterlettrage = { departEm?: number; dureeS?: number };
export type StyleInterlettrage = { interlettrage: string };

/** L'espacement des lettres se resserre de +0,2 em à 0 en 0,4 s. */
export function effetInterlettrageSerre(image: number, ips: number, options: OptionsInterlettrage = {}): StyleInterlettrage {
  const depart = options.departEm ?? INTERLETTRAGE_DEPART_EM;
  const p = progression(image, ips, options.dureeS ?? INTERLETTRAGE_DUREE_S);
  return { interlettrage: `${arrondi(depart * (1 - p))}em` };
}

/* ----------------------------- intonation ------------------------- */

export type OptionsIntonation = { basculeS?: number };
export type StyleIntonation = { graisse: 300 | 800; famille: string; italique: false };

/** Manrope 300 puis 800 : jamais une autre police, jamais d'italique. */
export function effetIntonation(image: number, ips: number, options: OptionsIntonation = {}): StyleIntonation {
  const bascule = Math.max(1, Math.round((options.basculeS ?? 0.5) * ips));
  return { graisse: image < bascule ? GRAISSE_LEGERE : GRAISSE_FORTE, famille: FAMILLE_CSS, italique: false };
}

/* ---------------------------- contour-marque ---------------------- */

export type NomCouleurCharte = keyof typeof PALETTE;
export type OptionsContour = { dureeS?: number; epaisseurPx?: number; couleur?: NomCouleurCharte };
export type StyleContour = { contourPx: number; couleurContour: string };

/** Contour qui apparaît, dans une couleur de la charte (orange par défaut). */
export function effetContourMarque(image: number, ips: number, options: OptionsContour = {}): StyleContour {
  const epaisseur = borne(options.epaisseurPx ?? 2, 0, 8);
  return {
    contourPx: arrondi(epaisseur * progression(image, ips, options.dureeS ?? 0.3)),
    couleurContour: PALETTE[options.couleur ?? "orange"],
  };
}

/* ------------------------------ répartiteur ----------------------- */

export type StyleEffet =
  | StyleFlou
  | StyleGris
  | StyleDegrade
  | StyleRetrogradation
  | StyleOpacite
  | StyleInterlettrage
  | StyleIntonation
  | StyleContour;

/** Applique l'effet nommé (options propres à chaque effet). */
export function appliquerEffet(effet: EffetTexte, image: number, ips: number, options: Record<string, unknown> = {}): StyleEffet {
  switch (effet) {
    case "flou-mot":
      return effetFlouMot(image, ips, options as OptionsFlouMot);
    case "noir-blanc-mot":
      return effetNoirBlancMot(image, ips, options as OptionsNoirBlanc);
    case "degrade-balaye":
      return effetDegradeBalaye(image, ips, options as OptionsDegrade);
    case "retrogradation":
      return effetRetrogradation(image, ips, options as OptionsRetrogradation);
    case "aparte-fantome":
      return effetAparteFantome(image, ips, options as OptionsAparte);
    case "titre-survit":
      return effetTitreSurvit(image, ips, options as OptionsTitreSurvit);
    case "interlettrage-serre":
      return effetInterlettrageSerre(image, ips, options as OptionsInterlettrage);
    case "intonation":
      return effetIntonation(image, ips, options as OptionsIntonation);
    case "contour-marque":
      return effetContourMarque(image, ips, options as OptionsContour);
  }
}
