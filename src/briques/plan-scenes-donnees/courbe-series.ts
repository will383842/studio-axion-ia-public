/**
 * Courbe à plusieurs séries : validation des paramètres et géométrie PURES (aucun React, aucune dépense).
 * Pièce NON inscrite au catalogue du plan de scènes (l'inscription est G4-11b) : rien ne l'appelle.
 */
import { TOILES } from "../plan-scenes/toiles";

export interface SerieCourbe {
  nom: string;
  valeurs: number[];
}

export interface ParametresCourbeSeries {
  titre: string;
  abscisses: string[];
  series: SerieCourbe[];
  /** Indice de la série mise en avant (accent). */
  enAvant?: number;
}

export const SERIES_MIN = 2;
export const SERIES_MAX = 4;
export const POINTS_MIN = 3;
export const POINTS_MAX = 12;

/** Image (depuis le début de la pièce) où le tracé de la première série commence, et durée du tracé d'une série. */
export const DEBUT_TRACE = 6;
export const DUREE_TRACE = 40;

/** Marges de la zone de tracé dans la toile (px). */
export const MARGES = { gauche: 60, droite: 60, haut: 120, bas: 100 } as const;

export type ResultatValidation = { ok: true; parametres: ParametresCourbeSeries } | { ok: false; erreurs: string[] };

export function valider(entree: ParametresCourbeSeries): ResultatValidation {
  const erreurs: string[] = [];
  if (typeof entree.titre !== "string" || entree.titre.trim() === "") erreurs.push("titre vide");
  const n = Array.isArray(entree.abscisses) ? entree.abscisses.length : 0;
  if (n < POINTS_MIN || n > POINTS_MAX) erreurs.push(`il faut de ${POINTS_MIN} à ${POINTS_MAX} points`);
  const nb = Array.isArray(entree.series) ? entree.series.length : 0;
  if (nb < SERIES_MIN || nb > SERIES_MAX) erreurs.push(`il faut de ${SERIES_MIN} à ${SERIES_MAX} séries`);
  for (const [i, s] of (entree.series ?? []).entries()) {
    if (typeof s.nom !== "string" || s.nom.trim() === "") erreurs.push(`série ${i} : nom vide`);
    if (!Array.isArray(s.valeurs) || s.valeurs.length !== n) erreurs.push(`série ${i} : autant de valeurs que d'abscisses attendu`);
    else if (!s.valeurs.every((v) => typeof v === "number" && Number.isFinite(v))) erreurs.push(`série ${i} : nombres finis attendus`);
  }
  if (entree.enAvant !== undefined && (!Number.isInteger(entree.enAvant) || entree.enAvant < 0 || entree.enAvant >= nb)) {
    erreurs.push("enAvant hors des séries");
  }
  return erreurs.length === 0 ? { ok: true, parametres: entree } : { ok: false, erreurs };
}

const arrondir = (v: number) => Math.round(v * 100) / 100;

export interface GeometrieCourbe {
  haut: number;
  axeY: number;
  gauche: number;
  droite: number;
  max: number;
  /** Abscisse (px) de chaque point. */
  xs: number[];
  series: { nom: string; points: { x: number; y: number; valeur: number }[]; longueur: number }[];
}

/** Points en pixels dans la toile `graphique`. Le maximum de toutes les séries touche le haut ; 0 est sur l'axe. */
export function geometrie(p: ParametresCourbeSeries): GeometrieCourbe {
  const { largeur, hauteur } = TOILES.graphique;
  const haut = MARGES.haut;
  const axeY = hauteur - MARGES.bas;
  const gauche = MARGES.gauche;
  const droite = largeur - MARGES.droite;
  const toutes = p.series.flatMap((s) => s.valeurs);
  const max = Math.max(...toutes, 0) || 1;
  const n = p.abscisses.length;
  const xs = p.abscisses.map((_, i) => arrondir(gauche + ((droite - gauche) * i) / Math.max(1, n - 1)));
  const series = p.series.map((s) => {
    const points = s.valeurs.map((valeur, i) => ({ x: xs[i]!, y: arrondir(axeY - (Math.max(valeur, 0) / max) * (axeY - haut)), valeur }));
    const longueur = points.slice(1).reduce((a, pt, i) => a + Math.hypot(pt.x - points[i]!.x, pt.y - points[i]!.y), 0);
    return { nom: s.nom, points, longueur: arrondir(longueur) };
  });
  return { haut, axeY, gauche, droite, max, xs, series };
}
