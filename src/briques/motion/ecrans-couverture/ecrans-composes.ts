/**
 * C11-E4 : géométries PURES des six écrans composés (aucun React, imports relatifs seulement). Pièces neuves, non branchées.
 * Tout tient dans la zone sûre (marges de 6 %) ; aucun résultat ne dépend de l'horloge.
 */
import { progres } from "../courbes";
import { DUREES } from "../jetons";
import { MARGE_CARTE, type RectCarte } from "./carte-video";

type Rect = RectCarte;
/** Éteint : rien ne branche ces pièces. Seul `true` (lu par `lireParametre`) les allumera. */
export const ECRANS_COMPOSES_ACTIFS = false;

export const MAX_CRITERES_DUEL = 4;
export const MAX_CARTES_FIL = 6;
const ZOOM_MIN = 1.6;
const ZOOM_MAX = 2.4;
const FLOU_MAX_PX = 12;
const RATIO_TABLETTE = 16 / 10;

const borne = (v: number, a: number, b: number, defaut = a) => (Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : defaut);
const zone = (L: number, H: number): Rect => ({ x: L * MARGE_CARTE, y: H * MARGE_CARTE, w: L * (1 - 2 * MARGE_CARTE), h: H * (1 - 2 * MARGE_CARTE) });

export function geometrieEcranHaut(p: { largeur: number; hauteur: number; partEcran?: number }): { ecran: Rect & { rayon: number }; intervenant: Rect & { rayon: number }; separation: number } {
  const z = zone(p.largeur, p.hauteur);
  const separation = p.hauteur * 0.03;
  const dispo = z.h - separation;
  const hEcran = dispo * borne(p.partEcran ?? 0.55, 0.3, 0.7, 0.55);
  const rayon = z.w * 0.04;
  return {
    ecran: { x: z.x, y: z.y, w: z.w, h: hEcran, rayon },
    intervenant: { x: z.x, y: z.y + hEcran + separation, w: z.w, h: dispo - hEcran, rayon },
    separation,
  };
}

export function geometrieTelephoneRecadre(p: { largeur: number; hauteur: number; echelle?: number }): { cadre: Rect & { rayon: number }; bordPx: number; video: Rect } {
  const z = zone(p.largeur, p.hauteur);
  let h = z.h * borne(p.echelle ?? 0.62, 0.3, 1, 0.62);
  let w = (h * 9) / 16;
  if (w > z.w) { w = z.w; h = (w * 16) / 9; }
  const cadre = { x: (p.largeur - w) / 2, y: (p.hauteur - h) / 2, w, h, rayon: w * 0.1 };
  const bordPx = Math.round(w * 0.025);
  return { cadre, bordPx, video: { x: cadre.x + bordPx, y: cadre.y + bordPx, w: w - 2 * bordPx, h: h - 2 * bordPx } };
}

export function geometrieMacro(p: { largeur: number; hauteur: number; foyer: { x: number; y: number }; zoom?: number }): { zoom: number; origine: { x: number; y: number }; flouMaxPx: number } {
  const fx = borne(p.foyer?.x, 0, 1, 0.5);
  const fy = borne(p.foyer?.y, 0, 1, 0.5);
  return { zoom: borne(p.zoom ?? 2, ZOOM_MIN, ZOOM_MAX, 2), origine: { x: fx * p.largeur, y: fy * p.hauteur }, flouMaxPx: FLOU_MAX_PX };
}

/** Indice de la diapo affichée à `t` (s) : -1 avant le premier instant, ou si les instants ne sont pas croissants. */
export function diapoAuTemps(instants: readonly number[], t: number): number {
  if (!Array.isArray(instants) || instants.length === 0 || !Number.isFinite(t)) return -1;
  for (let i = 0; i < instants.length; i++) {
    if (!Number.isFinite(instants[i]) || (i > 0 && instants[i] < instants[i - 1])) return -1;
  }
  let idx = -1;
  for (let i = 0; i < instants.length; i++) if (instants[i] <= t) idx = i;
  return idx;
}

export function geometrieTablette(p: { largeur: number; hauteur: number }): { cadre: Rect & { rayon: number }; bordPx: number; ecran: Rect } {
  const z = zone(p.largeur, p.hauteur);
  let w = z.w;
  let h = w / RATIO_TABLETTE;
  if (h > z.h) { h = z.h; w = h * RATIO_TABLETTE; }
  const cadre = { x: (p.largeur - w) / 2, y: (p.hauteur - h) / 2, w, h, rayon: h * 0.06 };
  const bordPx = Math.round(h * 0.03);
  return { cadre, bordPx, ecran: { x: cadre.x + bordPx, y: cadre.y + bordPx, w: w - 2 * bordPx, h: h - 2 * bordPx } };
}

/** Deux colonnes strictement égales (taille, fond, poids) : la géométrie ne désigne aucun gagnant. */
export function geometrieDuel(p: { largeur: number; hauteur: number; criteres: number }): {
  colonnes: [Rect & { rayon: number }, Rect & { rayon: number }];
  entetes: [Rect, Rect];
  lignes: { gauche: Rect; droite: Rect }[];
} {
  const z = zone(p.largeur, p.hauteur);
  const n = Math.floor(borne(p.criteres, 0, MAX_CRITERES_DUEL, 0));
  const ecart = z.w * 0.04;
  const w = (z.w - ecart) / 2;
  const hEntete = p.hauteur * 0.12;
  const hLigne = p.hauteur * 0.14;
  const h = hEntete + n * hLigne;
  const y = (p.hauteur - h) / 2;
  const rayon = w * 0.06;
  const xs = [z.x, z.x + w + ecart];
  const col = (x: number) => ({ x, y, w, h, rayon });
  const entete = (x: number): Rect => ({ x, y, w, h: hEntete });
  return {
    colonnes: [col(xs[0]), col(xs[1])],
    entetes: [entete(xs[0]), entete(xs[1])],
    lignes: Array.from({ length: n }, (_, i) => ({
      gauche: { x: xs[0], y: y + hEntete + i * hLigne, w, h: hLigne },
      droite: { x: xs[1], y: y + hEntete + i * hLigne, w, h: hLigne },
    })),
  };
}

/** Cartes empilées qui défilent vers le haut à vitesse constante (px/s ; 8 % de la hauteur par seconde par défaut). La pièce rogne à `zone`. */
export function geometrieFil(p: { largeur: number; hauteur: number; cartes: number; t: number; vitesse?: number }): { zone: Rect; cartes: (Rect & { rayon: number })[] } {
  const z = zone(p.largeur, p.hauteur);
  const n = Math.floor(borne(p.cartes, 0, MAX_CARTES_FIL, 0));
  const hCarte = z.h * 0.2;
  const ecart = z.h * 0.04;
  const decalage = (Number.isFinite(p.vitesse) ? (p.vitesse as number) : p.hauteur * 0.08) * Math.max(0, Number.isFinite(p.t) ? p.t : 0);
  return {
    zone: z,
    cartes: Array.from({ length: n }, (_, i) => ({ x: z.x, y: z.y + z.h * 0.5 + i * (hCarte + ecart) - decalage, w: z.w, h: hCarte, rayon: z.w * 0.05 })),
  };
}

/** Entrée d'une pièce à `t` (s) pour un début `debut` (s) : opacité 0 avant, 1 après, échelle douce, sans rebond. */
export function entreeEcranCompose(t: number, debut: number): { echelle: number; opacite: number } {
  const k = progres(t, debut, DUREES.entree);
  return { echelle: 0.94 + 0.06 * k, opacite: k };
}
