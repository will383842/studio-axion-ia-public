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
 * zone, le nombre de lignes qui la touchent. Un bord qui touche la zone ne compte pas. Sans cadre : rien. PUR.
 */
export function compterIntrusions(lignes: readonly Boite[], cadre: Cadre | undefined, index: number): { total: number; parZone: Record<string, number> } {
  const parZone: Record<string, number> = {};
  if (!cadre) return { total: 0, parZone };
  const zones = zonesInterdites(cadre, index);
  let total = 0;
  for (const l of lignes) {
    const rect = { x: l.gauche, y: l.haut, largeur: l.droite - l.gauche, hauteur: l.bas - l.haut };
    const touchees = zones.filter((z) => intersecte(rect, z));
    if (touchees.length) total++;
    for (const z of touchees) parZone[z.nom] = (parZone[z.nom] ?? 0) + 1;
  }
  return { total, parZone };
}
