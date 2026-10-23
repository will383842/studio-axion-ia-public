/**
 * GÉOMÉTRIE DE L'OUTIL des trois styles du tableau (feutre « AXION », bâton de craie, marqueur « ATELIER ») : longueur,
 * diamètre, inclinaison. PUR (lu par le rendu et par les contrôles). L'outil se redresse quand il écrit bas : jamais il
 * n'entre dans la bande des sous-titres.
 */
import type { StyleTableau } from "./styles";

export function dimensionsOutil(style: StyleTableau, k: number): { L: number; D: number } {
  return { L: (style === "ardoise" ? 160 : style === "paperboard" ? 330 : 320) * k, D: (style === "ardoise" ? 30 : style === "paperboard" ? 50 : 42) * k };
}

/**
 * Ce que l'outil occupe SOUS sa pointe au plus bas (redressé, levé, avec son ombre : `boiteOutil`) : l'air à laisser sous
 * le contenu pour qu'il n'entre jamais dans la bande des sous-titres en écrivant la dernière ligne.
 */
export function airOutil(style: StyleTableau, k: number): number {
  return dimensionsOutil(style, k).D / 2 + (8 + 14) * k + 14 * k + 1;
}

/** Inclinaison (radians) de l'outil dont la pointe est à `y` : de 0,42 (il descend vers la droite) à −0,56 (il remonte). */
export function angleOutil(y: number, basContenu: number, k: number): number {
  const yRef = basContenu - 560 * k;
  return 0.42 - Math.max(0, Math.min(1, (y - yRef) / (330 * k))) * 0.98;
}

/** Boîte (px) occupée par l'outil et son ombre, pointe en (x, y), levé de `lev` (0 posé, 1 en l'air). */
export function boiteOutil(style: StyleTableau, x: number, y: number, lev: number, basContenu: number, k: number): { x0: number; y0: number; x1: number; y1: number } {
  const { L, D } = dimensionsOutil(style, k);
  const a = angleOutil(y, basContenu, k);
  const ex = x + Math.cos(a) * L;
  const ey = y + Math.sin(a) * L;
  const ox = (10 + 18 * lev) * k;
  const oy = (8 + 14 * lev) * k;
  return { x0: Math.min(x, ex) - D, y0: Math.min(y, ey) - D, x1: Math.max(x, ex) + D + ox + 12 * k, y1: Math.max(y, ey) + D / 2 + oy + 14 * k };
}

/** Où l'outil se pose pendant les pauses : sur le côté, en bas de la zone du contenu (jamais sur la bande). */
export function reposOutil(geo: { contenu: { x: number; y: number; largeur: number; hauteur: number } }, k: number): [number, number] {
  return [geo.contenu.x + geo.contenu.largeur - 40 * k, geo.contenu.y + geo.contenu.hauteur - 150 * k];
}

/**
 * Rythme de l'outil (critique #291) : jamais plus de `libreMaxSec` dans l'image sans tracer (au-delà, il sort par la
 * droite en `sortieSec` et revient de même) ; chaque page reste finie, l'outil hors de l'image, `calmeFinSec` avant le
 * changement de page (`calmeMinSec` au moins, contrôlé). Sa couleur (craie ivoire ou terracotta, capuchon) est choisie
 * à chaque entrée dans l'image et ne change jamais tant qu'il y est.
 */
export const OUTIL_TABLEAU = Object.freeze({ libreMaxSec: 0.6, sortieSec: 0.3, calmeFinSec: 0.65, calmeMinSec: 0.6 });
