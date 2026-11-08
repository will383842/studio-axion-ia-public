/**
 * ZONES DE L'ÉCRAN DU PLAN DE SCÈNES (lot C) — PUR, sans Zod ni React : lu par le validateur ET par le rendu Remotion.
 * Rectangles en % de l'image. En face caméra, aucune scène ne se pose sur la zone du visage.
 */

export const POSITIONS = ["haut", "centre", "bas", "plein", "gauche", "droite"] as const;
export type Position = (typeof POSITIONS)[number];

export const TRANSITIONS = ["fondu", "glisse-haut", "glisse-gauche", "zoom-doux"] as const;
export type Transition = (typeof TRANSITIONS)[number];

export interface Rectangle {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export const ZONES: Record<Position, Rectangle> = {
  haut: { x: 5, y: 3, largeur: 90, hauteur: 11 },
  centre: { x: 5, y: 28, largeur: 90, hauteur: 44 },
  bas: { x: 5, y: 60, largeur: 90, hauteur: 34 },
  plein: { x: 0, y: 0, largeur: 100, hauteur: 100 },
  gauche: { x: 4, y: 20, largeur: 44, hauteur: 60 },
  droite: { x: 52, y: 20, largeur: 44, hauteur: 60 },
};

/** Zone du visage en face caméra (marge comprise), d'après le cadrage habituel du studio. */
export const ZONE_VISAGE: Rectangle = { x: 22, y: 14, largeur: 56, hauteur: 42 };

/** Position sûre en face caméra (sous le visage). */
export const POSITION_SURE_FACECAM: Position = "bas";

export function seChevauchent(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
}

export function devantLeVisage(p: Position): boolean {
  return seChevauchent(ZONES[p], ZONE_VISAGE);
}

/** Sous-zone d'un calque (niveau 2) à l'intérieur de la zone de sa scène. */
export const SOUS_ZONES: Record<Position, Rectangle> = {
  haut: { x: 0, y: 0, largeur: 100, hauteur: 30 },
  centre: { x: 8, y: 20, largeur: 84, hauteur: 60 },
  bas: { x: 0, y: 66, largeur: 100, hauteur: 34 },
  plein: { x: 0, y: 0, largeur: 100, hauteur: 100 },
  gauche: { x: 0, y: 0, largeur: 50, hauteur: 100 },
  droite: { x: 50, y: 0, largeur: 50, hauteur: 100 },
};

/** Bornes des transitions douces (ms). */
export const TRANSITION_MIN_MS = 200;
export const TRANSITION_MAX_MS = 800;
/** Durée minimale d'une scène (ms). */
export const SCENE_MIN_MS = 600;
