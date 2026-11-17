/**
 * C11-E3 · Géométrie PURE des cinq mises en page d'archive (grille élue, mur défilant, catalogue de formats, triptyque,
 * frise de montage). Aucune importation de `src/domaine` ni d'alias « @/ » : lu tel quel par le rendu.
 * `t` : avancement de 0 à 1 (grille, triptyque, catalogue, frise) ; secondes pour le mur (il boucle).
 * Les pièces ne choisissent jamais leurs vidéos : elles reçoivent des adresses.
 */
import { lineaire, mixer, progres } from "../courbes";

/** Aucun branchement : éteint par défaut, seul `true` allume. */
export const ECRANS_ARCHIVE_ACTIFS = false;

export type RatioArchive = "9:16" | "4:5" | "1:1" | "16:9";
export const BORNES_ARCHIVE = { grille: 9, mur: 12, triptyque: 3, catalogue: 4, frise: 8 } as const;

export type Rect = { x: number; y: number; largeur: number; hauteur: number; opacite: number; rotation: number; source: number; colonne?: number };

const borner = (n: number, max: number, defaut: number) => (!Number.isFinite(n) || n <= 0 ? defaut : Math.min(Math.floor(n), max));
const cadre = (x: number, y: number, largeur: number, hauteur: number, source: number, extra: Partial<Rect> = {}): Rect => ({ x, y, largeur, hauteur, opacite: 1, rotation: 0, source, ...extra });

/** Grille 2×2 (jusqu'à 4 vignettes) ou 3×3 ; la vignette `elue` grandit jusqu'à la carte centrale, les autres passent à 30 %. */
export function grilleElue(largeur: number, hauteur: number, n: number, t: number, elue = 0): Rect[] {
  const nb = borner(n, BORNES_ARCHIVE.grille, 4);
  const cote = nb <= 4 ? 2 : 3;
  const marge = largeur * 0.05;
  const ecart = largeur * 0.03;
  const w = (largeur - 2 * marge - (cote - 1) * ecart) / cote;
  const h = Math.min(w * (16 / 9), (hauteur - 2 * marge - (cote - 1) * ecart) / cote);
  const haut = (hauteur - (cote * h + (cote - 1) * ecart)) / 2;
  const e = Math.min(Math.max(Math.floor(elue) || 0, 0), nb - 1);
  const p = progres(t, 0.15, 0.6);
  const cw = largeur * 0.8;
  const ch = Math.min(cw * (16 / 9), hauteur * 0.8);
  return Array.from({ length: nb }, (_, i) => {
    const cx = marge + (i % cote) * (w + ecart);
    const cy = haut + Math.floor(i / cote) * (h + ecart);
    if (i !== e) return cadre(cx, cy, w, h, i, { opacite: mixer(1, 0.3, p) });
    return cadre(mixer(cx, (largeur - cw) / 2, p), mixer(cy, (hauteur - ch) / 2, p), mixer(w, cw, p), mixer(h, ch, p), i);
  });
}

const VITESSES_MUR = [1, 1.4, 0.8] as const;
const VITESSE_DE_BASE = 160; // px par seconde pour la vitesse 1
function geometrieMur(largeur: number, hauteur: number) {
  const marge = largeur * 0.04;
  const ecart = largeur * 0.03;
  const w = (largeur - 2 * marge - 2 * ecart) / 3;
  const h = w * (16 / 9);
  const pas = h + ecart;
  const k = Math.ceil(hauteur / pas) + 1; // cartes par colonne : le cadre est toujours couvert
  return { marge, ecart, w, h, pas, k, cycle: k * pas };
}
/** Période (s) de la colonne `c` : la position de ses cartes à t et t + période est identique. */
export function periodeColonneMur(largeur: number, hauteur: number, _n: number, c: number): number {
  return geometrieMur(largeur, hauteur).cycle / (VITESSE_DE_BASE * VITESSES_MUR[c]);
}
/** Mur de 3 colonnes aux vitesses 1 / 1,4 / 0,8, défilant vers le haut en boucle (position modulo la hauteur de colonne). Les cartes sortent du cadre en haut et en bas (le cadre rogne). */
export function murDefilant(largeur: number, hauteur: number, n: number, t: number) {
  const g = geometrieMur(largeur, hauteur);
  const nb = borner(n, BORNES_ARCHIVE.mur, 6);
  const colonnes = VITESSES_MUR.map((vitesse, c) => ({ x: g.marge + c * (g.w + g.ecart), largeur: g.w, vitesse, decalage: (((VITESSE_DE_BASE * vitesse * t) % g.cycle) + g.cycle) % g.cycle }));
  const cartes: Rect[] = [];
  colonnes.forEach((col, c) => {
    for (let j = 0; j < g.k; j++) {
      const y = ((((j * g.pas - col.decalage + g.pas) % g.cycle) + g.cycle) % g.cycle) - g.pas;
      cartes.push(cadre(col.x, y, g.w, g.h, (j * 3 + c) % nb, { colonne: c }));
    }
  });
  return { colonnes, cartes };
}

const RATIOS: { libelle: RatioArchive; rapport: number }[] = [
  { libelle: "9:16", rapport: 9 / 16 },
  { libelle: "4:5", rapport: 4 / 5 },
  { libelle: "1:1", rapport: 1 },
  { libelle: "16:9", rapport: 16 / 9 },
];
/** Catalogue : une case par ratio, libellé sous la case, le tout dans le cadre. Apparition échelonnée (opacité). */
export function catalogueFormats(largeur: number, hauteur: number, n: number, t: number) {
  const marge = largeur * 0.05;
  const cw = (largeur - 3 * marge) / 2;
  const ch = (hauteur - 3 * marge) / 2;
  const libelleH = Math.round(largeur * 0.05);
  return RATIOS.map(({ libelle, rapport }, i) => {
    const maxW = cw;
    const maxH = ch - libelleH;
    const w = Math.min(maxW, maxH * rapport);
    const h = w / rapport;
    const ox = marge + (i % 2) * (cw + marge) + (cw - w) / 2;
    const oy = marge + Math.floor(i / 2) * (ch + marge) + (maxH - h) / 2;
    const opacite = progres(t, i * 0.08, 0.25);
    return { libelle, rect: cadre(ox, oy, w, h, i < borner(n, BORNES_ARCHIVE.catalogue, 4) ? i : -1, { opacite }), etiquette: cadre(ox, oy + h, w, libelleH, i, { opacite }) };
  });
}

/**
 * Triptyque concave : 3 cartes, celles des bords tournées de −18 / +18° (rotateY), centre de face.
 * Convention : `rotation` = angle signé d'ouverture vers le spectateur (bords extérieurs devant) ; la pièce applique rotateY(−rotation) car, en CSS, rotateY(+θ) recule le bord droit.
 */
export function triptyque(largeur: number, hauteur: number, n: number, t: number) {
  void n; // toujours 3 cartes
  const w = largeur * 0.28;
  const h = Math.min(w * (16 / 9), hauteur * 0.7);
  const marge = largeur * 0.04;
  const y = (hauteur - h) / 2;
  const xs = [marge, (largeur - w) / 2, largeur - marge - w];
  const cartes = [-18, 0, 18].map((rotation, i) => cadre(xs[i], y, w, h, i, { rotation, opacite: progres(t, i * 0.1, 0.3) }));
  return { cartes, perspective: Math.round(largeur * 1.5) };
}

/** Frise : bande de vignettes en bas de cadre, tête de lecture qui avance de gauche à droite (linéaire). */
export function friseMontage(largeur: number, hauteur: number, n: number, t: number) {
  const nb = borner(n, BORNES_ARCHIVE.frise, 4);
  const marge = largeur * 0.05;
  const utile = largeur - 2 * marge;
  const ecart = largeur * 0.01;
  const w = (utile - (nb - 1) * ecart) / nb;
  const h = Math.min(w * (16 / 9), hauteur * 0.14);
  const y = hauteur - marge - h;
  const vignettes = Array.from({ length: nb }, (_, i) => cadre(marge + i * (w + ecart), y, w, h, i));
  const avance = utile * lineaire(t, 0, 1);
  const epaisseur = largeur * 0.006;
  const tete = { avance, rect: cadre(marge + avance - epaisseur / 2, y - h * 0.15, epaisseur, h * 1.3, -1) };
  return { vignettes, tete, utile };
}
