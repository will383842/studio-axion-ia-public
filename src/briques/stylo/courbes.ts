/**
 * Courbes des six gestes : temps → position de la pointe. Fonctions PURES et DÉTERMINISTES (aucun hasard, aucune
 * horloge) : deux rendus donnent la même image. Communes à tous les stylos (le stylo décide de l'image, pas du geste).
 * Chaque geste suit un chemin en segments ; la vitesse suit une courbe douce (`adoucir`), exacte en 0 et en 1.
 */
import type { Cible, CourbeGeste, GestesStylo, Point } from "./types";

const borne = (u: number) => (Number.isFinite(u) ? Math.min(1, Math.max(0, u)) : 0);

/** Démarrage et arrivée doux (3u² − 2u³) : vaut exactement 0 en 0 et 1 en 1. */
export const adoucir = (u: number) => {
  const v = borne(u);
  return v * v * (3 - 2 * v);
};

const melange = (a: Point, b: Point, k: number): Point => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/** Position le long d'une ligne brisée, à vitesse constante sur la longueur (extrémités exactes). */
function surChemin(points: readonly Point[], k: number): Point {
  if (k <= 0) return points[0];
  if (k >= 1) return points[points.length - 1];
  const longueurs: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    longueurs.push(d);
    total += d;
  }
  let reste = k * total;
  for (let i = 0; i < longueurs.length; i++) {
    if (reste <= longueurs[i] || i === longueurs.length - 1) {
      return melange(points[i], points[i + 1], longueurs[i] === 0 ? 1 : Math.min(1, reste / longueurs[i]));
    }
    reste -= longueurs[i];
  }
  return points[points.length - 1];
}

/* Points de départ et d'arrivée, exportés : les tests et les composants s'y réfèrent. */

/** Écrire : la ligne de base (80 % de la hauteur de la cible), de gauche à droite. */
export const cheminEcrire = (c: Cible): Point[] => [
  { x: c.x, y: c.y + c.hauteur * 0.8 },
  { x: c.x + c.largeur, y: c.y + c.hauteur * 0.8 },
];

/** Souligner : sous la cible (à 4 % de sa hauteur), de gauche à droite. */
export const cheminSouligner = (c: Cible): Point[] => [
  { x: c.x, y: c.y + c.hauteur * 1.04 },
  { x: c.x + c.largeur, y: c.y + c.hauteur * 1.04 },
];

/** Barrer : un trait au milieu de la cible, qui dépasse de 3 % de chaque côté. */
export const cheminBarrer = (c: Cible): Point[] => [
  { x: c.x - c.largeur * 0.03, y: c.y + c.hauteur * 0.52 },
  { x: c.x + c.largeur * 1.03, y: c.y + c.hauteur * 0.48 },
];

/** Cocher : petit trait descendant puis grand trait montant. */
export const cheminCocher = (c: Cible): Point[] => [
  { x: c.x + c.largeur * 0.1, y: c.y + c.hauteur * 0.55 },
  { x: c.x + c.largeur * 0.38, y: c.y + c.hauteur * 0.9 },
  { x: c.x + c.largeur * 0.95, y: c.y + c.hauteur * 0.1 },
];

/**
 * Entourer : ellipse AJUSTÉE à la cible (super-ellipse |x/a|ⁿ + |y/b|ⁿ = 1, n de 4 pour une ligne à 8 pour un grand
 * bloc) qui passe au large des quatre coins de la cible avec un dégagement, à la même distance des bords en largeur et
 * en hauteur : elle ne mord jamais sur la cible et déborde peu (une ellipse ordinaire déborderait de 41 % de chaque
 * côté). Départ en haut, un tour et 8 % de recouvrement, sens horaire ; le trait s'élargit à peine en finissant.
 */
export const ENTOURER = Object.freeze({ depart: -Math.PI / 2, balayage: 2 * Math.PI * 1.08, exposantMin: 4, exposantMax: 8, degagement: 0.08, degagementMin: 4, degagementMax: 12, croissance: 0.015 });

/** Exposant de la super-ellipse : 4 pour une cible basse (une ligne), jusqu'à 6 pour une cible haute (un bloc). */
export const exposantEntourer = (c: Cible) => ENTOURER.exposantMin + (ENTOURER.exposantMax - ENTOURER.exposantMin) * Math.min(1, Math.max(0, (c.hauteur - 120) / 280));

/** Demi-axes (px) de la courbe d'entourage d'une cible, avant croissance. */
export function axesEntourer(c: Cible): { a: number; b: number } {
  const n = exposantEntourer(c);
  const d = Math.min(ENTOURER.degagementMax, Math.max(ENTOURER.degagementMin, ENTOURER.degagement * Math.min(c.largeur, c.hauteur)));
  const w = Math.max(1, c.largeur / 2 + d);
  const h = Math.max(1, c.hauteur / 2 + d);
  // Marge m, la même en largeur et en hauteur, pour que la courbe passe par les coins dégagés : (w/(w+m))ⁿ + (h/(h+m))ⁿ = 1.
  let bas = 0;
  let haut = w + h;
  for (let i = 0; i < 60; i++) {
    const m = (bas + haut) / 2;
    if ((w / (w + m)) ** n + (h / (h + m)) ** n > 1) bas = m;
    else haut = m;
  }
  return { a: w + haut, b: h + haut };
}

export function pointEntourer(c: Cible, k: number): Point {
  const cx = c.x + c.largeur / 2;
  const cy = c.y + c.hauteur / 2;
  const echelle = 1 + ENTOURER.croissance * k;
  const { a, b } = axesEntourer(c);
  const e = 2 / exposantEntourer(c);
  const ang = ENTOURER.depart + ENTOURER.balayage * k;
  // Les quarts de tour tombent juste (cos(−π/2) vaut 6e-17, dont la racine ne serait pas nulle).
  const net = (v: number) => (Math.abs(v) < 1e-12 ? 0 : v);
  const cos = net(Math.cos(ang));
  const sin = net(Math.sin(ang));
  return { x: cx + a * echelle * Math.sign(cos) * Math.abs(cos) ** e, y: cy + b * echelle * Math.sign(sin) * Math.abs(sin) ** e };
}

/** Rectangle occupé par le tracé « entourer » d'une cible (croissance comprise), épaissi d'un demi-trait. */
export function encombrementEntourer(c: Cible, demiTrait = 0): Cible {
  const { a, b } = axesEntourer(c);
  const f = 1 + ENTOURER.croissance;
  const ra = a * f + demiTrait;
  const rb = b * f + demiTrait;
  return { x: c.x + c.largeur / 2 - ra, y: c.y + c.hauteur / 2 - rb, largeur: 2 * ra, hauteur: 2 * rb };
}

/** Pointer : la pointe arrive du bas à droite, hors de la cible, et se pose sur son centre. */
export const cheminPointer = (c: Cible): Point[] => [
  { x: c.x + c.largeur * 1.4, y: c.y + c.hauteur * 1.6 },
  { x: c.x + c.largeur / 2, y: c.y + c.hauteur / 2 },
];

const parChemin = (chemin: (c: Cible) => Point[]): CourbeGeste => (u, cible) => surChemin(chemin(cible), adoucir(u));

export const COURBES_GESTES: GestesStylo = Object.freeze({
  ecrire: parChemin(cheminEcrire),
  souligner: parChemin(cheminSouligner),
  entourer: (u, cible) => {
    return pointEntourer(cible, adoucir(u));
  },
  barrer: parChemin(cheminBarrer),
  cocher: parChemin(cheminCocher),
  pointer: parChemin(cheminPointer),
});

/**
 * Tracé laissé par la pointe de 0 à `u` : `n + 1` points échantillonnés sur la courbe elle-même (le trait dessiné suit
 * exactement le stylo). `u = 0` donne un seul point.
 */
export function trace(courbe: CourbeGeste, cible: Cible, u: number, n = 48): Point[] {
  const fin = borne(u);
  if (fin === 0) return [courbe(0, cible)];
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) pts.push(courbe((fin * i) / n, cible));
  return pts;
}
