/** Zones interdites aux petits objets, en % du cadre. Copies pures (aucun import de v4). */
import { SURFACE_MAX, type ZoneObjet } from "./contrat";

/** Copie de `ZONE_VISAGE` (`src/briques/plan-scenes/zones.ts`) ; test d'égalité dans `tests/petits-objets/`. */
export const ZONE_VISAGE_OBJETS: ZoneObjet = { x: 22, y: 14, largeur: 56, hauteur: 42 };

/** Bande basse des sous-titres : copie de `Y_ST_MAX ± DEMI_HAUTEUR_ST` (0,632 à 0,700) ; test d'égalité dans `tests/petits-objets/`. */
export const BANDE_SOUS_TITRES: ZoneObjet = { x: 0, y: 63.2, largeur: 100, hauteur: 6.8 };

function seChevauchent(a: ZoneObjet, b: ZoneObjet): boolean {
  return a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
}

/** Refus motivé, jamais de déplacement en silence. */
export function verifierZone(zone: ZoneObjet, contexte?: { visage?: ZoneObjet }): "ok" | { refus: string } {
  const { x, y, largeur, hauteur } = zone;
  if (![x, y, largeur, hauteur].every(Number.isFinite) || largeur <= 0 || hauteur <= 0) return { refus: "zone invalide" };
  if (x < 0 || y < 0 || x + largeur > 100 || y + hauteur > 100) return { refus: "la zone sort du cadre" };
  if ((largeur * hauteur) / 10000 > SURFACE_MAX) return { refus: "la zone dépasse 60 % de la surface du cadre" };
  if (seChevauchent(zone, contexte?.visage ?? ZONE_VISAGE_OBJETS)) return { refus: "la zone touche le visage" };
  if (seChevauchent(zone, BANDE_SOUS_TITRES)) return { refus: "la zone touche la bande des sous-titres" };
  return "ok";
}
