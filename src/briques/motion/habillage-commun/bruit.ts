/**
 * BRUIT MAISON À GRAINE FIXE (N-09), pour le grain et la fumée (C11-H4). PUR : aucun paquet, aucun alias d'import,
 * aucun hasard non déterministe, aucune date. Même graine = mêmes valeurs, toujours. Valeurs dans [0, 1].
 * Rien ne l'appelle encore (éteint). Le hachage entier (FNV-1a puis mélange) est recopié, pas importé.
 */

/** Plafond d'octaves du bruit fractal (coût de rendu, AM-05). */
export const OCTAVES_MAX = 4;

/** Graine quelconque (nombre fini) → entier 32 bits non signé ; une valeur non finie vaut 0. */
function graineEntiere(graine: number): number {
  return Number.isFinite(graine) ? Math.floor(graine) >>> 0 : 0;
}

/** Hachage d'un point entier de la grille et d'une graine → [0, 1). FNV-1a sur 3 entiers, puis avalanche. */
function hacher(ix: number, iy: number, graine: number): number {
  let h = 0x811c9dc5;
  for (const v of [graineEntiere(graine), ix >>> 0, iy >>> 0]) {
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

const lisse = (t: number) => t * t * (3 - 2 * t);

/** Bruit de valeur lissé en 2D, dans [0, 1]. Coordonnées non finies : traitées comme 0. */
export function bruitValeur2D(x: number, y: number, graine: number): number {
  const px = Number.isFinite(x) ? x : 0;
  const py = Number.isFinite(y) ? y : 0;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const fx = lisse(px - x0);
  const fy = lisse(py - y0);
  const a = hacher(x0, y0, graine);
  const b = hacher(x0 + 1, y0, graine);
  const c = hacher(x0, y0 + 1, graine);
  const d = hacher(x0 + 1, y0 + 1, graine);
  const haut = a + (b - a) * fx;
  const bas = c + (d - c) * fx;
  return Math.min(1, Math.max(0, haut + (bas - haut) * fy));
}

/** Somme d'octaves (fréquence ×2, amplitude ×0,5), normalisée dans [0, 1]. `octaves` borné à 1..OCTAVES_MAX. */
export function bruitFractal(x: number, y: number, graine: number, octaves = 3): number {
  const n = Number.isFinite(octaves) ? Math.min(OCTAVES_MAX, Math.max(1, Math.floor(octaves))) : 1;
  let somme = 0;
  let amplitude = 1;
  let total = 0;
  let freq = 1;
  for (let o = 0; o < n; o++) {
    somme += amplitude * bruitValeur2D(x * freq, y * freq, graineEntiere(graine) + o * 101);
    total += amplitude;
    amplitude *= 0.5;
    freq *= 2;
  }
  return Math.min(1, Math.max(0, somme / total));
}

/** Grille `largeur × hauteur` (rangée par rangée) de bruit de valeur ; `echelle` = taille d'une cellule en pixels. */
export function grilleBruit(largeur: number, hauteur: number, graine: number, echelle: number): Float32Array {
  const l = Number.isFinite(largeur) ? Math.max(0, Math.floor(largeur)) : 0;
  const h = Number.isFinite(hauteur) ? Math.max(0, Math.floor(hauteur)) : 0;
  const e = Number.isFinite(echelle) && echelle > 0 ? echelle : 1;
  const sortie = new Float32Array(l * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < l; i++) sortie[j * l + i] = bruitValeur2D(i / e, j / e, graine);
  return sortie;
}
