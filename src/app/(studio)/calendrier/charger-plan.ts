import "server-only";
import type { IdReseau } from "@/domaine/types";

/** Un créneau du plan éditorial d'un jour, montré à part dans la vue Jour. */
export type CreneauDuJour = { id: string; jourVise: string; reseaux: IdReseau[]; heure?: string; titre: string };

/**
 * Créneaux du plan pour ce jour (pont CAL-14P0 : version vide, la fiche CAL-14B la remplit).
 * Ne lève jamais : en cas de panne, la liste est vide.
 */
export async function chargerPlanDuJour(jour: string, aujourdhui: string): Promise<CreneauDuJour[]> {
  void jour;
  void aujourdhui;
  try {
    return [];
  } catch {
    return [];
  }
}
