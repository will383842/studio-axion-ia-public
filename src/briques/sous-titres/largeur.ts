/**
 * LARGEUR ET POSITIONS depuis les ZONES PROTÉGÉES du registre des réseaux (B.5). PUR.
 * La ligne est centrée : sa largeur libre = 100 % − 2 × la plus grande marge latérale des réseaux visés
 * (TikTok : droite 18 % → 64 % ≈ 691 px sur 1080). Les positions haut / bas restent hors des zones protégées.
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import { zoneProtegeeCombinee, type ZoneProtegee } from "@/reseaux";

/** Réseaux visés par défaut (vertical) : la zone libre la plus étroite des quatre. */
export const RESEAUX_VERTICAUX_PAR_DEFAUT: IdReseau[] = ["tiktok", "instagram", "facebook", "youtube-shorts"];

const LARGEURS: Record<Ratio, number> = { "9:16": 1080, "4:5": 1080, "1:1": 1080, "16:9": 1920 };
const HAUTEURS: Record<Ratio, number> = { "9:16": 1920, "4:5": 1350, "1:1": 1080, "16:9": 1080 };

export function dimensions(ratio: Ratio): { largeur: number; hauteur: number } {
  return { largeur: LARGEURS[ratio], hauteur: HAUTEURS[ratio] };
}

export function zoneDe(ratio: Ratio, reseaux: IdReseau[]): ZoneProtegee {
  return zoneProtegeeCombinee(ratio, reseaux.length ? reseaux : RESEAUX_VERTICAUX_PAR_DEFAUT) ?? { haut: 8, droite: 8, bas: 14, gauche: 8 };
}

/** Largeur libre d'une ligne centrée, en % de la largeur de l'image. */
export function largeurLibrePct(ratio: Ratio, reseaux: IdReseau[]): number {
  const z = zoneDe(ratio, reseaux);
  return 100 - 2 * Math.max(z.gauche, z.droite);
}

/** Largeur libre d'une ligne centrée, en px. */
export function largeurLibrePx(ratio: Ratio, reseaux: IdReseau[]): number {
  return Math.floor((largeurLibrePct(ratio, reseaux) / 100) * LARGEURS[ratio]);
}

/**
 * Centres verticaux (% de la hauteur) : milieu à 48 % (B.5), plan poitrine à 51 %, haut et bas à 5 % à l'intérieur
 * des zones protégées (un accent déplacé n'est jamais caché par l'interface du réseau).
 */
export function positionsVerticales(ratio: Ratio, reseaux: IdReseau[], milieuPct = 48): { milieuPct: number; hautPct: number; basPct: number; poitrinePct: number } {
  const z = zoneDe(ratio, reseaux);
  return { milieuPct, hautPct: z.haut + 5, basPct: 100 - z.bas - 5, poitrinePct: Math.min(52, milieuPct + 3) };
}
