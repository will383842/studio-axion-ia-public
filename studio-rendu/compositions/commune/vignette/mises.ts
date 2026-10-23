/**
 * MISES EN PAGE DES VIGNETTES (lot 1) — PURES. Trois mises génériques par ratio, plus la mise Instagram.
 * Valeurs de départ : `docs/vignettes/v2/gabarit/g-facecam.js` (générateur de référence), sans le cadran.
 *   m1 « gros plan » : sujet à droite, visage ≈ 30 % de la hauteur, titre en bas à gauche ;
 *   m2 « titre géant » : titre en haut, sujet coupé au bord droit ;
 *   m3 « visage moyen » : sujet au centre droit plus petit, titre en haut à gauche (place libre pour l'objet du lot 3).
 */
import type { MiseVignette, RatioVignette } from "./socle";

export interface PlacementSujet {
  /** Centre visé du visage, en pixels de la vignette. */
  cx: number;
  cy: number;
  /** Hauteur visée du visage, en pixels. */
  hv: number;
}

export interface PlacementTitre {
  x: number;
  /** Bord bas (ancre « bas ») ou bord haut (ancre « haut ») du titre. */
  y: number;
  ancre: "haut" | "bas";
  largeur: number;
  taille: number;
  align?: "centre";
}

export interface MiseDef {
  sujet?: PlacementSujet;
  titre: PlacementTitre;
  /** Centre du halo, en % de la vignette. */
  halo: { hx: number; hy: number };
}

/** Taille 128 en vertical (et non 136) : « OÙ FUIT VOTRE TEMPS » tient dans 856 px sans dépasser la réduction de 15 %. */
/** Interligne du titre (socle.css : 0.94). */
export const INTERLIGNE_TITRE = 0.94;

export const MISES: Readonly<Record<RatioVignette, Readonly<Record<MiseVignette, MiseDef>>>> = Object.freeze({
  "16:9": {
    m1: { sujet: { cx: 960, cy: 330, hv: 560 }, titre: { x: 56, y: 650, ancre: "bas", largeur: 720, taille: 112 }, halo: { hx: 78, hy: 40 } },
    m2: { sujet: { cx: 1130, cy: 430, hv: 640 }, titre: { x: 56, y: 130, ancre: "haut", largeur: 860, taille: 132 }, halo: { hx: 88, hy: 60 } },
    m3: { sujet: { cx: 880, cy: 360, hv: 400 }, titre: { x: 56, y: 140, ancre: "haut", largeur: 780, taille: 112 }, halo: { hx: 68, hy: 50 } },
  },
  "9:16": {
    m1: { sujet: { cx: 600, cy: 660, hv: 560 }, titre: { x: 84, y: 1420, ancre: "bas", largeur: 856, taille: 128 }, halo: { hx: 60, hy: 38 } },
    m2: { sujet: { cx: 760, cy: 1250, hv: 640 }, titre: { x: 84, y: 590, ancre: "haut", largeur: 856, taille: 128 }, halo: { hx: 70, hy: 62 } },
    m3: { sujet: { cx: 560, cy: 880, hv: 470 }, titre: { x: 84, y: 1450, ancre: "bas", largeur: 856, taille: 128 }, halo: { hx: 50, hy: 50 } },
  },
});

/** Instagram (9:16 seulement) : fond d'ambiance, halo, socle et titre centré en grand. Aucun sujet. */
export const MISE_INSTAGRAM: MiseDef = Object.freeze({
  titre: { x: 84, y: 800, ancre: "haut", largeur: 856, taille: 128, align: "centre" },
  halo: { hx: 50, hy: 45 },
}) as MiseDef;

export interface BoiteTitre {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Boîte occupée par le titre (lignes × taille × interligne). PUR. */
export function boiteTitre(t: PlacementTitre, nbLignes: number, taillePx: number): BoiteTitre {
  const hauteur = nbLignes * taillePx * INTERLIGNE_TITRE;
  return { x: t.x, y: t.ancre === "haut" ? t.y : t.y - hauteur, largeur: t.largeur, hauteur };
}

/** Visage supposé quand aucune boîte n'est fournie : au tiers haut de l'image, centré. */
export const BOITE_VISAGE_PAR_DEFAUT: [number, number, number, number] = [0.375, 0.15, 0.625, 0.35];

export interface PositionSujet {
  gauche: number;
  haut: number;
  largeur: number;
  hauteur: number;
}

/**
 * Pose un sujet détouré pour que SON VISAGE ait la hauteur visée, centré au point visé. Transposition de `V2.sujet`
 * (`socle.js`). `dims` : taille de l'image du sujet ; `boiteVisage` : [x0, y0, x1, y1] en parts de l'image. PUR.
 */
export function placerSujet(
  dims: { l: number; h: number },
  boiteVisage: readonly [number, number, number, number] | undefined,
  mise: MiseVignette,
  ratio: RatioVignette,
  miroir = false,
): PositionSujet {
  const cible = MISES[ratio][mise].sujet;
  if (!cible) throw new Error("Cette mise n'a pas de sujet.");
  const [x0, y0, x1, y1] = boiteVisage ?? BOITE_VISAGE_PAR_DEFAUT;
  const echelle = cible.hv / ((y1 - y0) * dims.h);
  const largeur = dims.l * echelle;
  const hauteur = dims.h * echelle;
  const fx = miroir ? 1 - (x0 + x1) / 2 : (x0 + x1) / 2;
  return { gauche: cible.cx - fx * largeur, haut: cible.cy - ((y0 + y1) / 2) * hauteur, largeur, hauteur };
}
