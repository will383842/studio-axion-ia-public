import type { CreneauDuJour } from "@/app/(studio)/calendrier/charger-plan";

/** Créneaux du plan d'un jour, à part de la grille (pont CAL-14P0 : rien à montrer tant que la liste est vide). */
export function PlanDuJour({ creneaux, aujourdhui }: { creneaux: readonly CreneauDuJour[]; aujourdhui: string }) {
  void aujourdhui;
  if (creneaux.length === 0) return null;
  return null;
}
