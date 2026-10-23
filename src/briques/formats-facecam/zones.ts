/**
 * ZONES SÛRES PAR FORMAT (lot F1). PUR. Ce que l'interface des réseaux recouvre (boutons, légende, barre de lecture)
 * et ce que le texte, les cartes et le visage ne doivent jamais toucher.
 *
 * Chaque zone est l'UNION la plus stricte de deux sources, bord par bord :
 *  - les zones protégées du registre des réseaux qui publient ce format (`src/reseaux`, via la brique `declinaison`) ;
 *  - le plancher du registre des réseaux (`PLANCHER_ZONE_SURE` : charte motion, 6 % / 12 % en bas en 4:5 et 1:1) ; en
 *    16:9, le « titre sûr » de la télévision et de YouTube : 5 % sur les côtés, 12 % en bas (barre de lecture).
 * Le 9:16 garde ses zones d'aujourd'hui (rien ne change pour lui).
 */
import type { IdReseau } from "@/domaine/types";
import { zonesProtegeesUnion } from "@/briques/declinaison";
import { listerReseaux } from "@/reseaux";
import { PLANCHER_ZONE_SURE } from "@/reseaux/sorties";
import { DIMENSIONS_FACECAM, RATIOS_FACECAM, type RatioFacecam } from "./ratios";

/** Marges sûres en FRACTION de l'image (0-1), bord par bord. */
export interface ZoneSure {
  haut: number;
  droite: number;
  bas: number;
  gauche: number;
}

/** Plancher par format, en fraction : celui du registre (`PLANCHER_ZONE_SURE`, en pourcentages ; charte motion, 16:9 titre sûr). */
export const PLANCHER_ZONES: Record<RatioFacecam, ZoneSure> = Object.fromEntries(
  RATIOS_FACECAM.map((r) => {
    const p = PLANCHER_ZONE_SURE[r];
    return [r, { haut: p.haut / 100, droite: p.droite / 100, bas: p.bas / 100, gauche: p.gauche / 100 }];
  }),
) as Record<RatioFacecam, ZoneSure>;

/** Réseaux qui publient ce format (ceux dont le registre connaît une zone protégée pour lui). */
export function reseauxDuFormat(ratio: RatioFacecam): IdReseau[] {
  return listerReseaux()
    .filter((r) => r.ratios.includes(ratio) && !!r.zonesProtegees[ratio])
    .map((r) => r.id);
}

/** Zone sûre d'un format : union des réseaux qui le publient (ou de ceux donnés) et du plancher. */
export function zoneSure(ratio: RatioFacecam, reseaux: IdReseau[] = reseauxDuFormat(ratio)): ZoneSure {
  const p = PLANCHER_ZONES[ratio];
  const z = zonesProtegeesUnion(reseaux.length ? reseaux : reseauxDuFormat(ratio), ratio);
  if (!z) return { ...p };
  return { haut: Math.max(p.haut, z.haut / 100), droite: Math.max(p.droite, z.droite / 100), bas: Math.max(p.bas, z.bas / 100), gauche: Math.max(p.gauche, z.gauche / 100) };
}

/** Rectangle libre (px) d'un format : ce qui reste une fois les marges sûres retirées. */
export interface RectanglePx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export function rectangleSur(ratio: RatioFacecam, zone: ZoneSure = zoneSure(ratio)): RectanglePx {
  const { largeur: W, hauteur: H } = DIMENSIONS_FACECAM[ratio];
  const x = Math.round(zone.gauche * W);
  const y = Math.round(zone.haut * H);
  return { x, y, largeur: Math.round(W * (1 - zone.gauche - zone.droite)), hauteur: Math.round(H * (1 - zone.haut - zone.bas)) };
}

/** Un rectangle est-il entièrement dans un autre (tolérance d'un pixel) ? */
export function contenuDans(a: RectanglePx, b: RectanglePx, tolerance = 1): boolean {
  return a.x >= b.x - tolerance && a.y >= b.y - tolerance && a.x + a.largeur <= b.x + b.largeur + tolerance && a.y + a.hauteur <= b.y + b.hauteur + tolerance;
}

/** Les deux rectangles se recouvrent-ils (plus d'un pixel) ? */
export function seRecouvrent(a: RectanglePx, b: RectanglePx): boolean {
  return Math.min(a.x + a.largeur, b.x + b.largeur) - Math.max(a.x, b.x) > 1 && Math.min(a.y + a.hauteur, b.y + b.hauteur) - Math.max(a.y, b.y) > 1;
}
