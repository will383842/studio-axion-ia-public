/**
 * TRANSITIONS SPECTACULAIRES (lot F3) : vitre qui se brise, écran qui se plie, zoom à travers l'écran. PUR,
 * déterministe (tout dépend du temps donné, jamais de l'horloge ni de `Math.random`), sans alias « @/ ».
 *
 * Ce fichier calcule la GÉOMÉTRIE à un instant : une liste de dessins (triangles de l'image figée projetés en
 * perspective, fissures, trous, iris). La composition `EffetTransition` la dessine dans un canevas 2D, plusieurs fois
 * par image (sous-instants pendant l'obturateur) et en fait la moyenne : flou de mouvement exact. Chaque triangle est
 * placé par ses 3 sommets projetés (perspective exacte aux sommets ; les éclats sont petits, le pli est quadrillé).
 *
 * Garde-fous : durée 0,6 à 1,5 s ; point d'impact, de pliure ou de plongée toujours HORS du visage ; les éclats qui
 * tomberaient sur le visage du plan révélé sont poussés de côté ; à la fin, plus rien ne couvre l'image.
 */
import type { BoitePx, PointPx, StyleTransition } from "./types";

export const DUREE_TRANSITION = { minSec: 0.6, maxSec: 1.5, parDefautSec: { "vitre-brisee": 1.2, "ecran-plie": 1.1, "zoom-traversant": 1 } as Record<StyleTransition, number> } as const;

export function bornerDureeTransition(dureeSec: number | null | undefined, style: StyleTransition): number {
  const d = typeof dureeSec === "number" && Number.isFinite(dureeSec) ? dureeSec : DUREE_TRANSITION.parDefautSec[style];
  return Math.min(DUREE_TRANSITION.maxSec, Math.max(DUREE_TRANSITION.minSec, d));
}

export interface ParametresTransition {
  largeur: number;
  hauteur: number;
  dureeSec: number;
  point: PointPx;
  /** Visage du plan révélé (px) : les éclats l'évitent. */
  visageApres?: BoitePx;
  graine: number;
}

type P2 = [number, number];

/** Un dessin à faire dans le canevas (ordre = ordre de la liste). */
export type Dessin =
  /** L'image figée entière, percée des polygones `trous` (éclats déjà partis). */
  | { type: "image"; trous: P2[][] }
  /** Un triangle de l'image figée : sommets source → sommets à l'écran. `ombre` : −1 (sombre) à +1 (reflet). */
  | { type: "triangle"; source: [P2, P2, P2]; ecran: [P2, P2, P2]; ombre: number; verso?: boolean; opacite?: number }
  /** Arête d'un éclat (reflet sur la tranche du verre), dessinée sur son contour projeté. */
  | { type: "contour"; polygone: P2[]; opacite: number }
  /** Ombre portée (polygone flou) sur le plan révélé. */
  | { type: "ombre"; polygone: P2[]; opacite: number; flou: number; decalage: P2 }
  /** Fissures : segments (x1, y1, x2, y2, opacité, épaisseur en px). */
  | { type: "fissures"; segments: [number, number, number, number, number, number][] }
  /** Éclair blanc chaud au point d'impact. */
  | { type: "eclair"; centre: P2; rayon: number; opacite: number }
  /** L'image figée agrandie autour d'un point (zoom traversant), percée d'un iris. */
  | { type: "zoom"; centre: P2; echelle: number; iris: number; anneau: number; lumiere: number };

const borne = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const u01 = (v: number) => borne(v, 0, 1);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - u01(x), 3);
const easeInCubic = (x: number) => Math.pow(u01(x), 3);
const easeInOut = (x: number) => {
  const u = u01(x);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};

/** Hasard déterministe 0-1 (même formule que la brique motion). */
export function hasard(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ */
/* Point d'effet hors du visage                                        */
/* ------------------------------------------------------------------ */

/**
 * Point d'impact par défaut : dans le tiers bas, du côté où il y a le plus de place à côté du visage, jamais dans
 * la boîte du visage (agrandie de 15 %). `souhaite` (ex. la main, ou « en haut à gauche ») est gardé s'il est hors du
 * visage.
 */
export function pointHorsVisage(largeur: number, hauteur: number, visage?: BoitePx, souhaite?: PointPx, style?: StyleTransition): PointPx {
  const dedans = (p: PointPx) => {
    if (!visage) return false;
    const m = visage[2] * 0.15;
    return p.x > visage[0] - m && p.x < visage[0] + visage[2] + m && p.y > visage[1] - m && p.y < visage[1] + visage[3] + m;
  };
  if (souhaite && !dedans(souhaite)) return { x: borne(souhaite.x, 0, largeur), y: borne(souhaite.y, 0, hauteur) };
  // Zoom traversant : plongée dans l'axe, sous le visage (poitrine), si c'est libre.
  if (style === "zoom-traversant") {
    const axe = { x: largeur / 2, y: hauteur * 0.66 };
    if (!dedans(axe)) return axe;
  }
  const cx = visage ? visage[0] + visage[2] / 2 : largeur / 2;
  const x = cx < largeur / 2 ? largeur * 0.72 : largeur * 0.28;
  const candidat = { x, y: hauteur * 0.66 };
  return dedans(candidat) ? { x: cx < largeur / 2 ? largeur * 0.9 : largeur * 0.1, y: hauteur * 0.8 } : candidat;
}

/* ------------------------------------------------------------------ */
/* Perspective                                                         */
/* ------------------------------------------------------------------ */

/** Focale (px) de la caméra virtuelle : perspective douce, comme un 50 mm sur un écran de 1080 px. */
const FOCALE_SUR_LARGEUR = 1.55;

function rotation(rx: number, ry: number, rz: number, p: [number, number, number]): [number, number, number] {
  let [x, y, z] = p;
  // X
  let c = Math.cos(rx);
  let s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  // Y
  c = Math.cos(ry);
  s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  // Z
  c = Math.cos(rz);
  s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

/** Projette un point 3D (px, z vers la caméra) sur l'écran, perspective centrée. */
function projeter(p: [number, number, number], largeur: number, hauteur: number): P2 {
  const f = largeur * FOCALE_SUR_LARGEUR;
  const z = Math.min(p[2], f * 0.85);
  const s = f / (f - z);
  return [largeur / 2 + (p[0] - largeur / 2) * s, hauteur / 2 + (p[1] - hauteur / 2) * s];
}

/** Ombrage d'une facette d'après sa normale (lumière en haut à gauche, devant) : 0 = comme à plat. */
function ombrage(n: [number, number, number]): number {
  const L: [number, number, number] = [-0.42, -0.55, 0.72];
  const nl = Math.hypot(...L);
  const d = (n[0] * L[0] + n[1] * L[1] + Math.abs(n[2]) * L[2]) / nl;
  return borne((d - L[2] / nl) * 1.6, -0.75, 0.75);
}

/* ------------------------------------------------------------------ */
/* Vitre qui se brise                                                  */
/* ------------------------------------------------------------------ */

export interface Eclat {
  /** Polygone d'origine (px, dans l'image), découpé au cadre. */
  polygone: P2[];
  centre: P2;
  /** Distance au point d'impact (px). */
  distance: number;
  /** Tirages propres à l'éclat (vitesses, rotations), 0-1. */
  tirages: number[];
}

/** Découpe un polygone au rectangle [0, l] × [0, h] (Sutherland-Hodgman). */
export function decouperAuCadre(poly: P2[], l: number, h: number): P2[] {
  const plans: [(p: P2) => boolean, (a: P2, b: P2) => P2][] = [
    [(p) => p[0] >= 0, (a, b) => [0, a[1] + ((b[1] - a[1]) * (0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= l, (a, b) => [l, a[1] + ((b[1] - a[1]) * (l - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= 0, (a, b) => [a[0] + ((b[0] - a[0]) * (0 - a[1])) / (b[1] - a[1]), 0]],
    [(p) => p[1] <= h, (a, b) => [a[0] + ((b[0] - a[0]) * (h - a[1])) / (b[1] - a[1]), h]],
  ];
  let sortie = poly;
  for (const [dedans, inter] of plans) {
    const entree = sortie;
    sortie = [];
    entree.forEach((cur, i) => {
      const prec = entree[(i + entree.length - 1) % entree.length];
      if (dedans(cur)) {
        if (!dedans(prec)) sortie.push(inter(prec, cur));
        sortie.push(cur);
      } else if (dedans(prec)) sortie.push(inter(prec, cur));
    });
    if (!sortie.length) return [];
  }
  return sortie;
}

export function airePolygone(p: P2[]): number {
  let a = 0;
  p.forEach((q, i) => {
    const r = p[(i + 1) % p.length];
    a += q[0] * r[1] - r[0] * q[1];
  });
  return Math.abs(a) / 2;
}

const centreDe = (p: P2[]): P2 => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];

/**
 * Éclats de la vitre : rayons depuis le point d'impact (angles irréguliers) et anneaux de plus en plus espacés ;
 * sommets partagés entre voisins (aucun jour entre deux éclats), les grands éclats extérieurs coupés en deux.
 */
export function genererEclats(p: Pick<ParametresTransition, "largeur" | "hauteur" | "point" | "graine">): Eclat[] {
  const { largeur: l, hauteur: h, point: o, graine } = p;
  const rayons = 15;
  const diag = Math.max(...[[0, 0], [l, 0], [0, h], [l, h]].map(([x, y]) => Math.hypot(x - o.x, y - o.y)));
  const anneaux: number[] = [0];
  for (let r = 46; anneaux[anneaux.length - 1] < diag * 1.05; r *= 1.72) anneaux.push(r);
  anneaux[anneaux.length - 1] = diag * 1.3;
  const pasAngle = (2 * Math.PI) / rayons;
  const angles = Array.from({ length: rayons }, (_, i) => i * pasAngle + (hasard(graine * 31 + i) - 0.5) * pasAngle * 0.7 + graine);
  const sommet = (a: number, k: number): P2 => {
    if (k === 0) return [o.x, o.y];
    const r = anneaux[k] * (k === anneaux.length - 1 ? 1 : 1 + (hasard(graine * 97 + a * 13 + k * 7) - 0.5) * 0.36);
    const ang = angles[a % rayons] + (k > 1 ? (hasard(graine * 53 + a * 5 + k * 11) - 0.5) * pasAngle * 0.22 : 0);
    return [o.x + Math.cos(ang) * r, o.y + Math.sin(ang) * r];
  };
  const eclats: Eclat[] = [];
  let n = 0;
  for (let k = 0; k < anneaux.length - 1; k++) {
    for (let a = 0; a < rayons; a++) {
      const quad: P2[] = k === 0 ? [sommet(a, 0), sommet(a, 1), sommet(a + 1, 1)] : [sommet(a, k), sommet(a, k + 1), sommet(a + 1, k + 1), sommet(a + 1, k)];
      const morceaux: P2[][] = k >= 2 && quad.length === 4 ? (hasard(graine * 7 + n) < 0.5 ? [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]] : [[quad[0], quad[1], quad[3]], [quad[1], quad[2], quad[3]]]) : [quad];
      for (const m of morceaux) {
        const poly = decouperAuCadre(m, l, h);
        if (poly.length < 3 || airePolygone(poly) < 30) continue;
        const centre = centreDe(poly);
        eclats.push({ polygone: poly, centre, distance: Math.hypot(centre[0] - o.x, centre[1] - o.y), tirages: Array.from({ length: 8 }, (_, j) => hasard(graine * 1009 + n * 17 + j * 3 + 1)) });
        n++;
      }
    }
  }
  return eclats;
}

/** Calendrier de la vitre (s) pour une durée donnée. */
export function calendrierVitre(dureeSec: number) {
  const fissure = Math.max(0.1, dureeSec * 0.16);
  return {
    /** Le front de fissure part du point d'impact et couvre l'image. */
    fissure,
    /** Les éclats se détachent du centre vers les bords. */
    detacheDebut: fissure * 0.75,
    detacheEtalement: dureeSec * 0.32,
    /** Les derniers éclats encore dans l'image s'effacent sur la fin (petits morceaux, jamais le visage entier). */
    effacementDebut: dureeSec * 0.86,
  };
}

/** Position 3D d'un éclat détaché depuis `tau` secondes. */
function mouvementEclat(e: Eclat, tau: number, p: ParametresTransition): { t: [number, number, number]; r: [number, number, number] } {
  const [a, b, c, d, f, g, i] = e.tirages;
  const dx = e.centre[0] - p.point.x;
  const dy = e.centre[1] - p.point.y;
  const dn = Math.max(1, Math.hypot(dx, dy));
  const proche = 1 - Math.min(1, e.distance / (p.largeur * 1.2));
  // Souffle de l'impact (vers l'extérieur et vers la caméra), puis gravité ; vitesse initiale vers le bas.
  let vx = (dx / dn) * (180 + 520 * proche) * (0.7 + 0.6 * a);
  const vy = (dy / dn) * (140 + 380 * proche) * (0.7 + 0.6 * b) + 520 + 520 * c;
  const vz = (120 + 900 * proche) * (0.5 + d);
  // Les éclats qui tomberaient sur le visage du plan révélé partent de côté (le visage reste dégagé).
  if (p.visageApres) {
    const [vx0, , vl] = p.visageApres;
    const cx = vx0 + vl / 2;
    if (e.centre[0] > vx0 - vl * 0.3 && e.centre[0] < vx0 + vl * 1.3 && e.centre[1] < p.visageApres[1] + p.visageApres[3]) {
      const cote = e.centre[0] >= cx ? 1 : -1;
      vx = cote * Math.max(Math.abs(vx), 900 + 600 * a);
    }
  }
  const gravite = 5200;
  return {
    t: [vx * tau, vy * tau + 0.5 * gravite * tau * tau, vz * tau - 0.5 * 900 * tau * tau],
    r: [(f - 0.5) * 9 * tau, (g - 0.5) * 11 * tau, (i - 0.5) * 7 * tau],
  };
}

/** Dessins de la vitre à l'instant `t` (s depuis le début de l'effet). `eclats` : `genererEclats` (calculé une fois). */
export function dessinVitre(p: ParametresTransition, eclats: Eclat[], t: number): Dessin[] {
  if (t >= p.dureeSec) return [];
  const cal = calendrierVitre(p.dureeSec);
  const diag = Math.hypot(p.largeur, p.hauteur);
  const front = diag * Math.pow(u01(t / cal.fissure), 0.85) * 1.05;
  const maxDist = Math.max(1, ...eclats.map((e) => e.distance));
  const detache = (e: Eclat) => cal.detacheDebut + (e.distance / maxDist) * cal.detacheEtalement * (0.85 + 0.3 * e.tirages[7]);
  const dessins: Dessin[] = [];
  const partis = eclats.filter((e) => t >= detache(e));
  dessins.push({ type: "image", trous: partis.map((e) => e.polygone) });

  // Fissures : arêtes des éclats encore en place, révélées par le front (les premières sont les plus marquées).
  const segments: [number, number, number, number, number, number][] = [];
  const vus = new Set<string>();
  for (const e of eclats) {
    if (t >= detache(e)) continue;
    const pg = e.polygone;
    pg.forEach((a, k) => {
      const b = pg[(k + 1) % pg.length];
      // Arête partagée par deux éclats : dessinée une fois.
      const cle = [a, b].map((q) => `${Math.round(q[0])},${Math.round(q[1])}`).sort().join("|");
      if (vus.has(cle)) return;
      vus.add(cle);
      const da = Math.hypot(a[0] - p.point.x, a[1] - p.point.y);
      const db = Math.hypot(b[0] - p.point.x, b[1] - p.point.y);
      if (Math.max(da, db) > front) return;
      // Les bords du cadre ne sont pas des fissures.
      const surBord = (q: P2) => q[0] <= 0.5 || q[1] <= 0.5 || q[0] >= p.largeur - 0.5 || q[1] >= p.hauteur - 0.5;
      if (surBord(a) && surBord(b)) return;
      // Fissures RADIALES (dans l'axe de l'impact) franches ; fissures en anneau plus fines et plus discrètes.
      const vx = b[0] - a[0];
      const vy = b[1] - a[1];
      const mx = (a[0] + b[0]) / 2 - p.point.x;
      const my = (a[1] + b[1]) / 2 - p.point.y;
      const radial = Math.abs(vx * mx + vy * my) / (Math.hypot(vx, vy) * Math.hypot(mx, my) + 1e-6);
      const loin = Math.pow(1 - Math.min(1, Math.min(da, db) / diag), 1.3);
      const opacite = (0.25 + 0.7 * radial) * (0.35 + 0.65 * loin);
      segments.push([a[0], a[1], b[0], b[1], +opacite.toFixed(3), +(0.7 + 1.3 * radial * loin).toFixed(2)]);
    });
  }
  if (segments.length) dessins.push({ type: "fissures", segments });

  // Éclats détachés, du plus loin au plus près de la caméra.
  const effacement = t > cal.effacementDebut ? 1 - u01((t - cal.effacementDebut) / (p.dureeSec - cal.effacementDebut)) : 1;
  const morceaux: { z: number; tri: Dessin[] }[] = [];
  for (const e of partis) {
    const tau = t - detache(e);
    const m = mouvementEclat(e, tau, p);
    const sommets3 = e.polygone.map((q) => {
      const r = rotation(m.r[0], m.r[1], m.r[2], [q[0] - e.centre[0], q[1] - e.centre[1], 0]);
      return [r[0] + e.centre[0] + m.t[0], r[1] + e.centre[1] + m.t[1], r[2] + m.t[2]] as [number, number, number];
    });
    const ecran = sommets3.map((s) => projeter(s, p.largeur, p.hauteur));
    // Éclat sorti de l'image : on ne le dessine plus.
    if (ecran.every((q) => q[1] > p.hauteur + 40) || ecran.every((q) => q[0] < -40) || ecran.every((q) => q[0] > p.largeur + 40)) continue;
    const n = rotation(m.r[0], m.r[1], m.r[2], [0, 0, 1]);
    const o = ombrage(n);
    const tri: Dessin[] = [];
    for (let k = 1; k < e.polygone.length - 1; k++) {
      tri.push({
        type: "triangle",
        source: [e.polygone[0], e.polygone[k], e.polygone[k + 1]],
        ecran: [ecran[0], ecran[k], ecran[k + 1]],
        ombre: +(o * effacement).toFixed(3),
        verso: n[2] < 0,
        ...(effacement < 1 ? { opacite: +effacement.toFixed(3) } : {}),
      });
    }
    tri.push({ type: "contour", polygone: ecran, opacite: +((0.35 + Math.max(0, o) * 0.9) * effacement).toFixed(3) });
    morceaux.push({ z: m.t[2], tri });
  }
  morceaux.sort((a, b) => a.z - b.z);
  for (const m of morceaux) dessins.push(...m.tri);

  // Éclair à l'impact (premier quart).
  const eclair = 1 - u01(t / (p.dureeSec * 0.28));
  if (eclair > 0) dessins.push({ type: "eclair", centre: [p.point.x, p.point.y], rayon: p.largeur * (0.12 + 0.35 * (1 - eclair)), opacite: +(0.85 * eclair * eclair).toFixed(3) });
  return dessins;
}

/**
 * Part (0-1) de la boîte du visage révélé couverte par des éclats DÉTACHÉS à l'instant t (contrôle : le visage
 * reste dégagé). Mesure par échantillonnage d'une grille de 12 × 12 points.
 */
export function couvertureVisageVitre(p: ParametresTransition, eclats: Eclat[], t: number): number {
  if (!p.visageApres) return 0;
  const tris = dessinVitre(p, eclats, t).filter((d): d is Extract<Dessin, { type: "triangle" }> => d.type === "triangle");
  const [x, y, l, h] = p.visageApres;
  let couverts = 0;
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 12; j++) {
      const q: P2 = [x + ((i + 0.5) / 12) * l, y + ((j + 0.5) / 12) * h];
      if (tris.some((d) => dansTriangle(q, d.ecran))) couverts++;
    }
  return couverts / 144;
}

function dansTriangle(q: P2, [a, b, c]: [P2, P2, P2]): boolean {
  const s = (p1: P2, p2: P2, p3: P2) => (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = s(q, a, b);
  const d2 = s(q, b, c);
  const d3 = s(q, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

/* ------------------------------------------------------------------ */
/* Écran qui se plie                                                   */
/* ------------------------------------------------------------------ */

/**
 * L'écran se plie : les deux bords se replient vers l'ARRIÈRE (comme un dépliant qu'on referme), de part et d'autre
 * du visage, qui reste face caméra ; puis la feuille pliée s'envole vers le bas en s'éloignant et révèle le plan
 * suivant. Les plis passent toujours hors du visage. Quadrillage fin : la perspective reste juste.
 */
export function dessinPli(p: ParametresTransition, t: number): Dessin[] {
  if (t >= p.dureeSec) return [];
  const { largeur: l, hauteur: h } = p;
  const v = p.visageApres;
  const marge = l * 0.04;
  const axeG = Math.min(l * 0.26, v ? v[0] - marge : l * 0.26);
  const axeD = Math.max(l * 0.74, v ? v[0] + v[2] + marge : l * 0.74);
  const d = p.dureeSec;
  const theta = Math.PI * 0.94 * easeInOut(t / (d * 0.5));
  const envol = easeInCubic((t - d * 0.38) / (d * 0.62));
  const recul = easeInOut(t / (d * 0.4));
  const colonnes = 16;
  const lignes = 22;
  const sommet3 = (u: number, vv: number): [number, number, number] => {
    let x = u;
    let z = 0;
    if (u < axeG || u > axeD) {
      const axe = u < axeG ? axeG : axeD;
      const r = u - axe;
      x = axe + r * Math.cos(theta);
      z = -Math.abs(r) * Math.sin(theta);
    }
    // Légère courbure de la feuille pendant le pli (papier, pas carton), et la feuille recule un peu : une marge
    // apparaît autour d'elle, on lit « l'écran » comme un objet.
    z -= Math.sin(Math.PI * (vv / h)) * 30 * Math.sin(theta) + 320 * recul;
    // Envol : bascule vers l'arrière, rotation légère, chute et recul.
    const cx = (axeG + axeD) / 2;
    const cy = h / 2;
    const r = rotation(envol * 0.75, envol * 0.18, envol * -0.22, [x - cx, vv - cy, z]);
    return [r[0] + cx - envol * l * 0.08, r[1] + cy + envol * h * 1.05, r[2] - envol * 1400];
  };
  const tris: { z: number; d: Dessin }[] = [];
  const coupesU = [0, axeG, axeD, l];
  for (let i = 0; i < colonnes; i++) {
    for (let j = 0; j < lignes; j++) {
      const u0 = (i / colonnes) * l;
      const u1 = ((i + 1) / colonnes) * l;
      const v0 = (j / lignes) * h;
      const v1 = ((j + 1) / lignes) * h;
      // Une colonne qui contient un pli est coupée au pli (pli net).
      const bornes = [u0, ...coupesU.filter((c) => c > u0 && c < u1), u1];
      for (let k = 0; k < bornes.length - 1; k++) {
        const a = bornes[k];
        const b = bornes[k + 1];
        const s = [sommet3(a, v0), sommet3(b, v0), sommet3(b, v1), sommet3(a, v1)];
        const e = s.map((q) => projeter(q, l, h));
        const src: P2[] = [[a, v0], [b, v0], [b, v1], [a, v1]];
        const ux = s[1][0] - s[0][0], uy = s[1][1] - s[0][1], uz = s[1][2] - s[0][2];
        const wx = s[3][0] - s[0][0], wy = s[3][1] - s[0][1], wz = s[3][2] - s[0][2];
        let n: [number, number, number] = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx];
        const nn = Math.hypot(...n) || 1;
        n = [n[0] / nn, n[1] / nn, n[2] / nn];
        const verso = n[2] < 0;
        // Les bords qui tournent s'assombrissent (ils quittent la lumière).
        const bord = a < axeG || b > axeD ? Math.sin(theta) * 0.55 : 0;
        const o = Math.max(-0.75, ombrage(verso ? [-n[0], -n[1], -n[2]] : n) - bord);
        const z = (s[0][2] + s[1][2] + s[2][2] + s[3][2]) / 4;
        tris.push({ z, d: { type: "triangle", source: [src[0], src[1], src[2]], ecran: [e[0], e[1], e[2]], ombre: +o.toFixed(3), verso } });
        tris.push({ z, d: { type: "triangle", source: [src[0], src[2], src[3]], ecran: [e[0], e[2], e[3]], ombre: +o.toFixed(3), verso } });
      }
    }
  }
  tris.sort((a, b) => a.z - b.z);
  // Liseré crème sur le panneau central (les deux plis et ses bords) : la feuille se détache du plan révélé.
  const bordure = (u: number, vv: number) => projeter(sommet3(u, vv), l, h);
  const liseres: Dessin[] = [{ type: "contour", polygone: [bordure(axeG, 0), bordure(axeD, 0), bordure(axeD, h), bordure(axeG, h)], opacite: +(0.55 * Math.sin(theta) * (1 - envol * 0.5)).toFixed(3) }];
  // Ombre portée de la feuille sur le plan révélé (elle grandit quand la feuille se décolle).
  const contour: P2[] = ([[axeG, 0], [axeD, 0], [axeD, h], [axeG, h]] as P2[]).map(([u, vv]) => projeter(sommet3(u, vv), l, h));
  const ombre: Dessin = { type: "ombre", polygone: contour, opacite: +(0.6 * Math.min(1, envol * 2.5 + recul * 0.8)).toFixed(3), flou: 46, decalage: [18, 34] };
  return [ombre, ...tris.map((x) => x.d), ...liseres];
}

/* ------------------------------------------------------------------ */
/* Zoom à travers l'écran                                              */
/* ------------------------------------------------------------------ */

/** Échelle du plan révélé (la composition l'applique au calque vidéo) : il arrive de plus près et se pose. */
export function echelleApres(style: StyleTransition, t: number, dureeSec: number): number {
  if (style !== "zoom-traversant") return 1;
  return 1 + 0.45 * (1 - easeOutCubic((t - dureeSec * 0.3) / (dureeSec * 0.7)));
}

/** La caméra plonge vers le point (l'image grandit très vite), puis l'image s'ouvre en iris sur le plan suivant. */
export function dessinZoom(p: ParametresTransition, t: number): Dessin[] {
  if (t >= p.dureeSec) return [];
  const d = p.dureeSec;
  const echelle = 1 + 11 * easeInCubic(t / (d * 0.8));
  const diag = Math.hypot(p.largeur, p.hauteur);
  const ouverture = easeOutCubic((t - d * 0.3) / (d * 0.62));
  const iris = ouverture * diag * 1.15;
  return [{ type: "zoom", centre: [p.point.x, p.point.y], echelle: +echelle.toFixed(4), iris: +iris.toFixed(2), anneau: +(ouverture > 0 && ouverture < 1 ? 1 - ouverture : 0).toFixed(3), lumiere: +(0.14 * Math.sin(Math.PI * u01(t / (d * 0.7)))).toFixed(3) }];
}

/** Dessins d'une transition à l'instant t. */
export function dessinTransition(style: StyleTransition, p: ParametresTransition, t: number, eclats?: Eclat[]): Dessin[] {
  if (t < 0) return [{ type: "image", trous: [] }];
  if (style === "vitre-brisee") return dessinVitre(p, eclats ?? genererEclats(p), t);
  if (style === "ecran-plie") return dessinPli(p, t);
  return dessinZoom(p, t);
}
