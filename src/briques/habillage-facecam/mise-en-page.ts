/**
 * MISE EN PAGE DU FACE CAMÉRA (plan v4 B.23, opération `miseEnPage{cote|vignette}` du monteur, lot G) — PUR.
 *
 *   - CÔTÉ (« mets-moi à droite ») : Will sur une colonne de 55 % de la largeur, son visage à 40 % de la largeur depuis
 *     son bord (35 à 45 %), l'animation de l'autre côté (45 %). Entrée en 9 images (même courbe que l'écran partagé) :
 *     la colonne de Will glisse de sa place dans l'image pleine vers son côté, la carte entre par l'autre bord.
 *   - VIGNETTE (« petite version de moi ») : la carte plein écran, Will en petit dans un coin (30 % de la largeur, 28 à
 *     35 %), recadré serré sur son visage. Le recadrage est calculé sur la SOURCE 4K : la vignette ne grossit jamais
 *     un pixel de la prise (échelle ≤ 1), le visage reste net.
 * Jamais de fondu sur le visage ; aucun détourage.
 */
import { PREFIXE_ENTREE, type PlanScene } from "../composition/scene";

export const REGLES_MISE_EN_PAGE = {
  /** Côté : largeur de la colonne de Will et place de son visage depuis son bord (35 à 45 %). */
  colonnePersonnePct: 0.55,
  visageDepuisBordPct: 0.4,
  /** Vignette : largeur (28 à 35 %), proportions 4:5, visage ≈ 42 % de la largeur de la vignette. */
  vignetteLargeurPct: 0.3,
  vignetteProportion: 5 / 4,
  visageDansVignettePct: 0.42,
  /** Yeux à 40 % de la hauteur de la vignette ; marge au bord ; haut sous l'interface des réseaux (10 %). */
  yeuxDansVignettePct: 0.4,
  margePct: 0.05,
  hautPct: 0.1,
  entreeImages: 9,
} as const;

export type ModeMiseEnPage = "cote" | "vignette";
export type CoteWill = "gauche" | "droite";

/** Visage dans l'image composée (piste pré-cadrée), en fractions ; défauts : le cadrage centre le visage, yeux à 34 %. */
export interface VisageImage {
  centreXPct?: number;
  yeuxPct?: number;
  /** Largeur du visage / largeur de l'image (≈ 0,28 en plan 100 %). */
  largeurPct?: number;
}

const pair = (x: number) => 2 * Math.round(x / 2);
const borne = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export interface GeometrieCote {
  /** Colonne de l'image composée prise pour Will (px). */
  sourceX: number;
  largeurPersonne: number;
  /** Bord gauche de la colonne de Will dans l'image finale. */
  xPersonne: number;
  /** Zone de la carte (pleine hauteur). */
  xCarte: number;
  largeurCarte: number;
}

export function geometrieCote(largeur: number, cote: CoteWill, visage: VisageImage = {}, r = REGLES_MISE_EN_PAGE): GeometrieCote {
  const L = pair(largeur * r.colonnePersonnePct);
  const visageX = (visage.centreXPct ?? 0.5) * largeur;
  // Le visage tombe à 40 % de la largeur depuis le bord de Will.
  const cible = cote === "gauche" ? r.visageDepuisBordPct * largeur : (1 - r.visageDepuisBordPct) * largeur;
  const xPersonne = cote === "gauche" ? 0 : largeur - L;
  const dansColonne = cible - xPersonne;
  const sourceX = pair(borne(visageX - dansColonne, 0, largeur - L));
  return { sourceX, largeurPersonne: L, xPersonne, xCarte: cote === "gauche" ? L : 0, largeurCarte: largeur - L };
}

export interface GeometrieVignette {
  /** Recadrage dans l'image composée (px). */
  recadrage: { x: number; y: number; largeur: number; hauteur: number };
  /** Place de la vignette dans l'image finale (px). */
  place: { x: number; y: number; largeur: number; hauteur: number };
  /** Pixels de la vignette par pixel de la SOURCE (≤ 1 : jamais agrandie, visage net). */
  echelleSource: number;
}

/**
 * Vignette : recadrage serré sur le visage, calculé pour que la vignette ne soit jamais plus grande que ce que la source
 * 4K porte (`pixelsSourceParPixel` : pixels de la prise par pixel de l'image composée, ≈ 1,1 en plan 100 % sur une
 * prise 4K ; < 1 sur un punch-in fort). Le coin suit le côté demandé (droite par défaut), en haut.
 */
export function geometrieVignette(largeur: number, hauteur: number, cote: CoteWill = "droite", visage: VisageImage = {}, pixelsSourceParPixel = 2160 / 1920, r = REGLES_MISE_EN_PAGE): GeometrieVignette {
  const lv = pair(largeur * r.vignetteLargeurPct);
  const hv = pair(lv * r.vignetteProportion);
  const largeurVisage = (visage.largeurPct ?? 0.28) * largeur;
  // Recadrage : le visage occupe ≈ 42 % de la vignette ; jamais moins de pixels de source que de pixels de vignette.
  const minimum = lv / Math.max(1e-6, pixelsSourceParPixel);
  let lr = Math.max(largeurVisage / r.visageDansVignettePct, minimum);
  lr = Math.min(lr, largeur, hauteur / r.vignetteProportion);
  const hr = lr * r.vignetteProportion;
  const cx = (visage.centreXPct ?? 0.5) * largeur;
  const yeux = (visage.yeuxPct ?? 0.34) * hauteur;
  const x = borne(cx - lr / 2, 0, largeur - lr);
  const y = borne(yeux - r.yeuxDansVignettePct * hr, 0, hauteur - hr);
  const marge = Math.round(largeur * r.margePct);
  return {
    recadrage: { x: pair(x), y: pair(y), largeur: pair(lr), hauteur: pair(hr) },
    place: { x: cote === "gauche" ? marge : largeur - marge - lv, y: pair(hauteur * r.hautPct), largeur: lv, hauteur: hv },
    echelleSource: +(lv / (pair(lr) * pixelsSourceParPixel)).toFixed(3),
  };
}

/** Mise en page posée sur un plan de la composition (référence de la carte, géométrie, entrée). */
export interface MiseEnPageScene {
  mode: ModeMiseEnPage;
  cote: CoteWill;
  /** Référence de la carte (`entree:<nom>`) : colonne de la carte (côté) ou image entière (vignette). */
  carte: string;
  entreeImages: number;
  carteDebutSec: number;
  geometrie: { cote?: GeometrieCote; vignette?: GeometrieVignette };
}

export interface PassageMiseEnPage {
  debutSec: number;
  finSec: number;
  carte: string;
  mode: ModeMiseEnPage;
  cote: CoteWill;
  geometrie: MiseEnPageScene["geometrie"];
}

/**
 * Pose les mises en page sur les plans : coupés aux bornes de chaque passage ; le premier plan porte l'entrée, les
 * suivants lisent la carte décalée. Un plan d'illustration ou un écran partagé déjà posé reste prioritaire.
 */
export function poserMisesEnPage(plans: PlanScene[], passages: PassageMiseEnPage[], entreeImages: number = REGLES_MISE_EN_PAGE.entreeImages): PlanScene[] {
  if (!passages.length) return plans;
  const bornes = passages.flatMap((p) => [p.debutSec, p.finSec]);
  const coupes: PlanScene[] = [];
  for (const pl of plans) {
    const internes = bornes.filter((b) => b > pl.debutSec + 1e-6 && b < pl.finSec - 1e-6).sort((a, b) => a - b);
    let debut = pl.debutSec;
    for (const b of [...internes, pl.finSec]) {
      coupes.push({ ...pl, debutSec: +debut.toFixed(3), finSec: +b.toFixed(3) });
      debut = b;
    }
  }
  return coupes.map((pl) => {
    const p = passages.find((x) => pl.debutSec >= x.debutSec - 1e-6 && pl.finSec <= x.finSec + 1e-6);
    if (!p || pl.type !== "double" || pl.ecranPartage) return pl;
    const premier = Math.abs(pl.debutSec - p.debutSec) < 1e-6;
    const miseEnPage: MiseEnPageScene = {
      mode: p.mode,
      cote: p.cote,
      carte: p.carte.startsWith(PREFIXE_ENTREE) ? p.carte : `${PREFIXE_ENTREE}${p.carte}`,
      entreeImages: premier ? entreeImages : 0,
      carteDebutSec: +(pl.debutSec - p.debutSec).toFixed(3),
      geometrie: p.geometrie,
    };
    // Pas de zoom pendant une mise en page : la colonne et la vignette sont fixées par leur géométrie.
    return { ...pl, cadrage: { ...pl.cadrage, zoom: 1, zoomFin: 1 }, miseEnPage };
  });
}
