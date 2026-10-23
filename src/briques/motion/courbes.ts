/**
 * COURBES D'ANIMATION de la brique `motion` : Bézier cubiques (courbes signature), ressort amorti (chute), progrès
 * d'une animation dans le temps et vitesse pour le flou de mouvement. PUR et déterministe (aucun état, aucune
 * horloge) : chaque image se calcule depuis le seul instant `t` (s), comme l'exige un rendu image par image.
 */
import { COURBES, DUREES, RESSORTS, type NomCourbe, type NomRessort } from "./jetons";

const borne = (x: number, min = 0, max = 1) => Math.min(max, Math.max(min, x));

/** Bézier cubique CSS (x1, y1, x2, y2) → fonction de [0, 1] dans ℝ (Newton puis dichotomie, précision 1e-6). */
export function bezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const courbeX = (s: number) => ((ax * s + bx) * s + cx) * s;
  const courbeY = (s: number) => ((ay * s + by) * s + cy) * s;
  const deriveeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  const resoudre = (x: number) => {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const e = courbeX(s) - x;
      if (Math.abs(e) < 1e-6) return s;
      const d = deriveeX(s);
      if (Math.abs(d) < 1e-6) break;
      s -= e / d;
    }
    let bas = 0;
    let haut = 1;
    s = x;
    while (bas < haut) {
      const v = courbeX(s);
      if (Math.abs(v - x) < 1e-6) return s;
      if (x > v) bas = s;
      else haut = s;
      s = (bas + haut) / 2;
      if (haut - bas < 1e-7) break;
    }
    return s;
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : courbeY(resoudre(x)));
}

const CACHE = new Map<NomCourbe, (x: number) => number>();
/** Courbe signature nommée (jetons). */
export function courbe(nom: NomCourbe): (x: number) => number {
  let f = CACHE.get(nom);
  if (!f) {
    const [a, b, c, d] = COURBES[nom];
    f = bezier(a, b, c, d);
    CACHE.set(nom, f);
  }
  return f;
}

/**
 * Ressort amorti partant de 0 vers 1 (solution exacte de m·x'' + c·x' + k·(x − 1) = 0, x(0) = 0, x'(0) = 0), au temps
 * `t` (s). Sous-amorti : petit dépassement puis repos (la « chute » du correctif).
 */
export function ressort(t: number, nom: NomRessort = "chute"): number {
  if (t <= 0) return 0;
  const { raideur: k, amortissement: c, masse: m } = RESSORTS[nom];
  const w0 = Math.sqrt(k / m);
  const zeta = c / (2 * Math.sqrt(k * m));
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}

/** Durée (s) au bout de laquelle le ressort reste à moins de 0,2 % de sa cible. */
export function dureeRessort(nom: NomRessort = "chute"): number {
  for (let t = 0.05; t < 4; t += 0.01) {
    let calme = true;
    for (let u = t; u < t + 0.6; u += 0.02) if (Math.abs(1 - ressort(u, nom)) > 0.002) calme = false;
    if (calme) return +t.toFixed(2);
  }
  return 4;
}

/** Progrès (0-1, courbé) d'une animation qui commence à `debut` et dure `duree` (s), à l'instant `t`. */
export function progres(t: number, debut: number, duree: number = DUREES.entree, nom: NomCourbe = "signature"): number {
  if (duree <= 0) return t >= debut ? 1 : 0;
  return courbe(nom)(borne((t - debut) / duree));
}

/** Progrès linéaire (0-1) non courbé. */
export function lineaire(t: number, debut: number, duree: number): number {
  return duree <= 0 ? (t >= debut ? 1 : 0) : borne((t - debut) / duree);
}

/** Interpolation : `a` → `b` selon `k` (non borné : un ressort peut dépasser). */
export const mixer = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Entrée puis chute d'un élément : 0 avant `debut`, monte à 1 (courbe ou ressort), puis redescend à 0 pendant la
 * chute finale qui commence à `debutChute`. Renvoie l'état d'entrée (`e`) et de sortie (`s`), chacun de 0 à 1.
 */
export function cycle(t: number, debut: number, debutChute: number, opts: { duree?: number; ressort?: NomRessort; courbe?: NomCourbe } = {}): { e: number; s: number } {
  const e = opts.ressort ? (t <= debut ? 0 : ressort(t - debut, opts.ressort)) : progres(t, debut, opts.duree ?? DUREES.entree, opts.courbe ?? "signature");
  const s = progres(t, debutChute, DUREES.sortie, "sortie");
  return { e, s };
}

/**
 * Flou de mouvement : déplacement (px) pendant l'obturateur (180°, 1/50 s) d'une grandeur animée `f(t)`. Utilisé
 * pour un flou DIRECTIONNEL (écart-type ≈ moitié du déplacement) sur l'élément qui bouge.
 */
export function deplacementObturateur(f: (t: number) => number, t: number): number {
  return f(t) - f(t - DUREES.obturateur);
}

/** Écart-type du flou directionnel pour un déplacement pendant l'obturateur (px), plafonné. */
export function flouDeplacement(deplacementPx: number, plafond = 28): number {
  const v = Math.abs(deplacementPx) * 0.5;
  return v < 0.35 ? 0 : Math.min(plafond, v);
}

/** Bruit déterministe 1D lisse (somme de sinus incommensurables), de −1 à 1 : dérive, respiration, scintillement. */
export function derive(t: number, graine = 0): number {
  const g = graine * 12.9898;
  return (Math.sin(t * 0.73 + g) * 0.5 + Math.sin(t * 1.37 + g * 1.7) * 0.3 + Math.sin(t * 2.11 + g * 0.6) * 0.2) / 1;
}

/** Hasard déterministe (0-1) d'après un entier : positions des particules, graines. */
export function hasard(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
