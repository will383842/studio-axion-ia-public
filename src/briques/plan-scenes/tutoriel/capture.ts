/**
 * CAPTURE D'ÉCRAN DANS UNE FAUSSE FENÊTRE (G5-04) — géométrie PURE, sans React ni import `@/…`, sans réseau.
 * L'image arrive en propriété `src` : adresse DÉJÀ signée par le Studio ; ni ce fichier ni le rendu ne signent ni ne téléchargent.
 * Sans `src` : fenêtre vide neutre et une remarque, jamais d'exception. Dossier lu par le rendu (déjà copié).
 */
import type { RectanglePx, ToilePx } from "./cadre-zone";

/** Noms de jetons de la charte (résolus par le dessin) : jamais de couleur en dur ici. */
export type CouleurPointFenetre = "terracotta" | "gris" | "noir";

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const MARGE_FENETRE = 40;
export const HAUTEUR_BARRE = 64;

export interface OptionsCapture {
  /** Adresse déjà signée de l'image (propriété, jamais calculée au rendu). */
  src?: string;
  /** Zoom sur l'image, borné à [ZOOM_MIN, ZOOM_MAX] (défaut 1). */
  zoom?: number;
  /** Position du curseur en % de l'image ; bornée à l'image. */
  curseur?: { x: number; y: number };
  toile: ToilePx;
}

export interface PointBarre {
  cx: number;
  cy: number;
  rayon: number;
  couleur: CouleurPointFenetre;
}

export interface GeometrieCapture {
  fenetre: RectanglePx;
  barre: { hauteur: number; points: PointBarre[] };
  /** Zone d'image (sous la barre, dans la fenêtre). */
  image: RectanglePx;
  src: string | null;
  zoom: number;
  /** Origine du zoom en % de l'image (le curseur s'il existe, sinon le centre). */
  origineZoom: { x: number; y: number };
  /** Curseur en px dans la toile, toujours dans `image`. */
  curseur: { x: number; y: number } | null;
  remarque?: string;
}

const COULEURS_POINTS: CouleurPointFenetre[] = ["terracotta", "gris", "noir"];

function fini(...n: number[]): boolean {
  return n.every((v) => Number.isFinite(v));
}

function borner(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Géométrie de la fenêtre dans la toile ; `null` seulement si la toile est inutilisable. */
export function captureEcran(options: OptionsCapture): GeometrieCapture | null {
  const { toile } = options;
  if (!toile || !fini(toile.largeur, toile.hauteur) || toile.largeur <= 0 || toile.hauteur <= 0) return null;

  const marge = Math.min(MARGE_FENETRE, Math.floor(Math.min(toile.largeur, toile.hauteur) / 4));
  const fenetre: RectanglePx = {
    x: marge,
    y: marge,
    largeur: Math.round(toile.largeur - 2 * marge),
    hauteur: Math.round(toile.hauteur - 2 * marge),
  };
  const hauteurBarre = Math.min(HAUTEUR_BARRE, Math.floor(fenetre.hauteur / 4));
  const rayon = Math.max(1, Math.floor(hauteurBarre / 6));
  const points: PointBarre[] = COULEURS_POINTS.map((couleur, i) => ({
    cx: fenetre.x + hauteurBarre / 2 + i * rayon * 3,
    cy: fenetre.y + hauteurBarre / 2,
    rayon,
    couleur,
  }));
  const image: RectanglePx = {
    x: fenetre.x,
    y: fenetre.y + hauteurBarre,
    largeur: fenetre.largeur,
    hauteur: fenetre.hauteur - hauteurBarre,
  };

  const src = typeof options.src === "string" && options.src.trim() !== "" ? options.src.trim() : null;

  const c = options.curseur;
  const pc = c && fini(c.x, c.y) ? { x: borner(c.x, 0, 100), y: borner(c.y, 0, 100) } : null;
  const curseur = pc ? { x: image.x + (pc.x / 100) * image.largeur, y: image.y + (pc.y / 100) * image.hauteur } : null;

  const zoom = typeof options.zoom === "number" && Number.isFinite(options.zoom) ? borner(options.zoom, ZOOM_MIN, ZOOM_MAX) : 1;

  return {
    fenetre,
    barre: { hauteur: hauteurBarre, points },
    image,
    src,
    zoom,
    origineZoom: pc ?? { x: 50, y: 50 },
    curseur: src ? curseur : null,
    ...(src ? {} : { remarque: "Aucune image fournie : fenêtre vide." }),
  };
}
