/**
 * CADRE D'UNE ZONE D'ÉCRAN DU TUTORIEL (G5-03) — géométrie PURE, sans React ni import `@/…`.
 * Le dessin du cadre est C9-10 : ici seulement le rectangle en pixels et le NOM du jeton de couleur.
 * Dossier lu par le rendu (déjà copié : `src/briques/plan-scenes/`).
 */
import type { Rectangle } from "../zones";

/** Zone en % de l'écran capturé (même forme que `SurlignageEcran` de la démo, sans l'importer). */
export type ZoneEcran = Rectangle;

export interface ToilePx {
  largeur: number;
  hauteur: number;
}

export interface RectanglePx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface OptionsCadre {
  /** Marge en px autour de la zone (défaut 8). */
  marge?: number;
  /** Épaisseur du trait en px (défaut 4). */
  epaisseur?: number;
}

export interface CadreZone extends RectanglePx {
  epaisseur: number;
  /** Nom du jeton de charte (terracotta en clair), résolu par le dessin de C9-10. */
  couleur: "accent";
}

export const MARGE_CADRE_DEFAUT = 8;
export const EPAISSEUR_CADRE_DEFAUT = 4;

function fini(...n: number[]): boolean {
  return n.every((v) => Number.isFinite(v));
}

function positifOuDefaut(v: number | undefined, defaut: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : defaut;
}

/** Cadre d'une zone en % d'un écran qui occupe `rectEcran` (px) ; borné à `rectEcran`, arrondi au pixel. */
export function cadreDansEcran(zone: ZoneEcran, rectEcran: RectanglePx, options?: OptionsCadre): CadreZone | null {
  if (!fini(zone.x, zone.y, zone.largeur, zone.hauteur, rectEcran.x, rectEcran.y, rectEcran.largeur, rectEcran.hauteur)) return null;
  if (rectEcran.largeur <= 0 || rectEcran.hauteur <= 0 || zone.largeur <= 0 || zone.hauteur <= 0) return null;
  const marge = positifOuDefaut(options?.marge, MARGE_CADRE_DEFAUT);
  const epaisseur = positifOuDefaut(options?.epaisseur, EPAISSEUR_CADRE_DEFAUT);

  const gauche = rectEcran.x + (zone.x / 100) * rectEcran.largeur;
  const haut = rectEcran.y + (zone.y / 100) * rectEcran.hauteur;
  const droite = gauche + (zone.largeur / 100) * rectEcran.largeur;
  const bas = haut + (zone.hauteur / 100) * rectEcran.hauteur;

  const minX = rectEcran.x;
  const minY = rectEcran.y;
  const maxX = rectEcran.x + rectEcran.largeur;
  const maxY = rectEcran.y + rectEcran.hauteur;
  // Zone entièrement hors de l'écran : rien à encadrer.
  if (droite <= minX || gauche >= maxX || bas <= minY || haut >= maxY) return null;

  const x0 = Math.max(minX, Math.round(gauche - marge));
  const y0 = Math.max(minY, Math.round(haut - marge));
  const x1 = Math.min(maxX, Math.round(droite + marge));
  const y1 = Math.min(maxY, Math.round(bas + marge));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0, epaisseur, couleur: "accent" };
}

/** Cadre d'une zone en % de l'écran quand l'écran capturé occupe toute la toile. */
export function cadreDeZone(zone: ZoneEcran, toile: ToilePx, options?: OptionsCadre): CadreZone | null {
  return cadreDansEcran(zone, { x: 0, y: 0, largeur: toile.largeur, hauteur: toile.hauteur }, options);
}
