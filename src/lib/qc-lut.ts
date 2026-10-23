/**
 * CONTRÔLE D'UNE LUT 3D (lot M4 ; plan B.7 LUT, `luts/A-INTEGRER-DANS-LE-STUDIO.md`). Même calcul que `outils/lut/qc.py` :
 *  - la taille est LUE DANS L'EN-TÊTE (65 pour les LUT Axion Buffer, 33 accepté pour une LUT importée) ;
 *  - gris monotone : sur la diagonale (r = v = b), chaque canal ne redescend jamais (tolérance 1e-6) ;
 *  - cassure : plus grande différence seconde le long d'un axe, ramenée au pas d'une LUT de 65 points
 *    (`× (n−1)² / 64²`, pour comparer 33 et 65 points). Une LUT saine reste sous 0,02.
 * Sert au test de chaque `.cube` livré, à l'import par Will (refus clair si cassé, avertissement au-delà de 0,02),
 * dans le navigateur comme sur le serveur. PUR.
 */
import { ErreurLisible } from "./erreur-lisible";
import { lireCube, type Lut3D } from "./lut3d";

/** Cassure au-delà de laquelle une LUT est signalée (jamais refusée pour autant). */
export const CASSURE_MAX = 0.02;
/** Tailles acceptées à l'import. */
export const TAILLES_ACCEPTEES = [17, 32, 33, 64, 65] as const;

export interface RapportLut {
  taille: number;
  titre?: string;
  grisMonotone: boolean;
  cassureMax: number;
  noir: [number, number, number];
  blanc: [number, number, number];
}

/** Mesures de contrôle d'une LUT déjà lue. */
export function controlerLut(lut: Lut3D): RapportLut {
  const n = lut.taille;
  const d = lut.donnees;
  // Index du format `.cube` : rouge le plus rapide, puis vert, puis bleu.
  const v = (r: number, g: number, b: number, c: number) => d[(r + g * n + b * n * n) * 3 + c];
  let grisMonotone = true;
  for (let i = 1; i < n && grisMonotone; i++) for (let c = 0; c < 3; c++) if (v(i, i, i, c) - v(i - 1, i - 1, i - 1, c) < -1e-6) grisMonotone = false;
  let cassure = 0;
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++)
        for (let c = 0; c < 3; c++) {
          const x = v(r, g, b, c);
          if (r >= 2) cassure = Math.max(cassure, Math.abs(x - 2 * v(r - 1, g, b, c) + v(r - 2, g, b, c)));
          if (g >= 2) cassure = Math.max(cassure, Math.abs(x - 2 * v(r, g - 1, b, c) + v(r, g - 2, b, c)));
          if (b >= 2) cassure = Math.max(cassure, Math.abs(x - 2 * v(r, g, b - 1, c) + v(r, g, b - 2, c)));
        }
  const facteur = (n - 1) ** 2 / 64 ** 2;
  const coin = (k: number): [number, number, number] => [v(k, k, k, 0), v(k, k, k, 1), v(k, k, k, 2)];
  return { taille: n, titre: lut.titre, grisMonotone, cassureMax: +(cassure * facteur).toFixed(5), noir: coin(0), blanc: coin(n - 1) };
}

export type ValidationCube = { ok: true; taille: number; avertissement?: string; rapport: RapportLut } | { ok: false; erreur: string };

/**
 * Validation d'un `.cube` à l'import (navigateur et serveur, mêmes règles) : fichier illisible, LUT 1D, taille
 * hors liste ou incomplète, gris qui redescend → refus clair ; cassure > 0,02 → accepté avec un avertissement.
 */
export function validerCube(contenu: string): ValidationCube {
  let lut: Lut3D;
  try {
    lut = lireCube(contenu);
  } catch (e) {
    return { ok: false, erreur: e instanceof ErreurLisible ? e.message : "Ce fichier de couleur est illisible." };
  }
  return validerLut(lut);
}

/** Mêmes règles que `validerCube`, sur une LUT déjà lue (lecture en flux côté serveur, relecture sécurité R45). PUR. */
export function validerLut(lut: Lut3D): ValidationCube {
  if (!(TAILLES_ACCEPTEES as readonly number[]).includes(lut.taille)) return { ok: false, erreur: `Ce fichier de couleur a ${lut.taille} points par côté : le studio lit ceux de 17, 32, 33, 64 ou 65 points.` };
  const rapport = controlerLut(lut);
  if (!rapport.grisMonotone) return { ok: false, erreur: "Ce fichier de couleur est abîmé : les gris s'inversent (un gris clair devient plus sombre)." };
  const avertissement = rapport.cassureMax > CASSURE_MAX ? "Ce fichier de couleur a des transitions dures : des marches peuvent se voir dans les dégradés." : undefined;
  return { ok: true, taille: lut.taille, avertissement, rapport };
}

/**
 * LUT mélangée à l'identité selon l'intensité (0-1) : `identité × (1 − k) + lut × k`, point par point.
 * Le mélange étant linéaire, appliquer cette table revient exactement à mélanger l'image d'origine et l'image
 * passée dans la LUT (interpolation linéaire par morceaux). Sert au rendu (une table par LUT et par intensité).
 */
export function melangerAvecIdentite(lut: Lut3D, intensite: number): Lut3D {
  const k = Math.min(1, Math.max(0, intensite));
  const n = lut.taille;
  const donnees = new Float32Array(lut.donnees.length);
  for (let b = 0; b < n; b++)
    for (let g = 0; g < n; g++)
      for (let r = 0; r < n; r++) {
        const i = (r + g * n + b * n * n) * 3;
        const id = [lut.domaineMin[0] + ((lut.domaineMax[0] - lut.domaineMin[0]) * r) / (n - 1), lut.domaineMin[1] + ((lut.domaineMax[1] - lut.domaineMin[1]) * g) / (n - 1), lut.domaineMin[2] + ((lut.domaineMax[2] - lut.domaineMin[2]) * b) / (n - 1)];
        for (let c = 0; c < 3; c++) donnees[i + c] = id[c] * (1 - k) + lut.donnees[i + c] * k;
      }
  return { ...lut, donnees };
}

/** Écrit une LUT au format `.cube` (6 décimales, en-tête complet). */
export function ecrireCube(lut: Lut3D, titre = lut.titre ?? "LUT"): string {
  const lignes = [`TITLE "${titre.replace(/"/g, "'")}"`, `LUT_3D_SIZE ${lut.taille}`, `DOMAIN_MIN ${lut.domaineMin.join(" ")}`, `DOMAIN_MAX ${lut.domaineMax.join(" ")}`];
  for (let i = 0; i < lut.donnees.length; i += 3) lignes.push(`${lut.donnees[i].toFixed(6)} ${lut.donnees[i + 1].toFixed(6)} ${lut.donnees[i + 2].toFixed(6)}`);
  return lignes.join("\n") + "\n";
}
