/**
 * POIDS VARIABLE (X1-01) : le mot dit passe de la graisse 500 à 800 pendant sa prononciation, taille inchangée.
 * PUR, sans horloge ni hasard (même entrée = même sortie), importable par Remotion (import relatif seulement).
 * Police : Manrope Variable (`polices/Manrope-Variable.ttf`, licence OFL copiée dans `polices/OFL-Manrope.txt`).
 * ÉTEINT : rien ne l'importe en production ; le branchement dans `texte-instants.ts` viendra plus tard (file K2).
 */
import { largeurMot } from "./mesure";

export const GRAISSE_MIN = 500;
export const GRAISSE_MAX = 800;

/** Graisse (500..800) du mot à l'instant `t` (s) : 500 avant `debutMot`, 800 à `finMot` et après, croissante entre les deux. */
export function graisseAuTemps(t: number, debutMot: number, finMot: number): number {
  if (!(finMot > debutMot)) return t < debutMot ? GRAISSE_MIN : GRAISSE_MAX;
  const p = Math.min(1, Math.max(0, (t - debutMot) / (finMot - debutMot)));
  return Math.round((GRAISSE_MIN + (GRAISSE_MAX - GRAISSE_MIN) * p) * 100) / 100;
}

/** Largeur (px à `taillePx`, 1 = em) réservée au mot : mesurée à la graisse 800, la plus large, pour que la ligne ne bouge pas. */
export function largeurReservee(mot: string, taillePx = 1): number {
  return largeurMot(mot, "Manrope ExtraBold", taillePx);
}
