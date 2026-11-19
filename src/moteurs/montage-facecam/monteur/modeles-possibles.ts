/**
 * S-09b-v19b : la liste des modèles d'animation où les textes d'une carte tiennent.
 * Fonction pure, utilisée plus tard par le bouton « Changer l'animation » ; rien ne l'appelle encore.
 * Même test que `modifierCarte` (appliquer.ts) : un modèle rendu ici n'est jamais refusé pour « textes qui ne tiennent pas ».
 */
import { carteDepuisTextesTous } from "@/briques/motion";
import type { IdModeleMotionTous } from "@/briques/motion/types-etendus";
import { MODELES_CARTE } from "./operations";

export function modelesPossibles(textes: readonly string[], actuel?: string | null): (typeof MODELES_CARTE)[number][] {
  if (textes.length === 0) return [];
  return MODELES_CARTE.filter((m) => m !== actuel && carteDepuisTextesTous(m as IdModeleMotionTous, [...textes]) !== null);
}
