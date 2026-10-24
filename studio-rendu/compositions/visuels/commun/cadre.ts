/**
 * Cadre du réseau visé (H2) : LinkedIn ou Meta (Instagram et Facebook). Fonctions PURES et contexte React : VisuelPage le pose,
 * le pied (`Swipe`) le lit, la mesure (`mesure/MesureVisuelPage.tsx`) compte les textes posés dans une zone interdite du cadre.
 * Sans cadre, tout reste comme avant : marges habituelles, flèche du pied, aucune intrusion comptée.
 */
import { createContext } from "react";
import { intersecte, retraitCouverture, zonesInterdites, type Cadre } from "../../../../src/briques/visuels/reseaux";
import { MARGE } from "./constantes";
import type { Boite } from "./zones";

export type { Cadre };

/** Tolérance (px) de la mesure : un débordement ou une intrusion de moins d'un pixel (arrondi du navigateur) ne compte pas. */
export const TOLERANCE_PX = 1;

/** Cadre de la page en cours de dessin (`undefined` : aucun). */
export const ContexteCadre = createContext<Cadre | undefined>(undefined);

/** Retraits (px) du haut et du bas d'une couverture : ceux du cadre, ou la marge habituelle sans cadre. PUR. */
export function retraitPage(cadre: Cadre | undefined): { haut: number; bas: number } {
  return cadre ? retraitCouverture(cadre) : { haut: MARGE, bas: MARGE };
}

/** Flèche vers la page suivante : jamais sur la dernière page, jamais pour LinkedIn (sa propre flèche recouvre ce coin). PUR. */
export function flecheVisible(index: number, total: number, cadre: Cadre | undefined): boolean {
  return index < total - 1 && cadre !== "linkedin";
}

/**
 * Lignes de texte qui entrent dans une zone interdite du cadre pour la page `index` (0 = couverture) : `total` lignes en cause et, par
 * zone, le nombre de lignes qui la touchent. Chaque ligne est rétrécie de `TOLERANCE_PX` de chaque côté : un bord qui touche la zone, ou
 * qui y mord de moins d'un pixel, ne compte pas. Sans cadre : rien. PUR.
 */
export function compterIntrusions(lignes: readonly Boite[], cadre: Cadre | undefined, index: number): { total: number; parZone: Record<string, number> } {
  const parZone: Record<string, number> = {};
  if (!cadre) return { total: 0, parZone };
  const zones = zonesInterdites(cadre, index);
  let total = 0;
  for (const l of lignes) {
    const rect = { x: l.gauche + TOLERANCE_PX, y: l.haut + TOLERANCE_PX, largeur: l.droite - l.gauche - 2 * TOLERANCE_PX, hauteur: l.bas - l.haut - 2 * TOLERANCE_PX };
    const touchees = zones.filter((z) => intersecte(rect, z));
    if (touchees.length) total++;
    for (const z of touchees) parZone[z.nom] = (parZone[z.nom] ?? 0) + 1;
  }
  return { total, parZone };
}
