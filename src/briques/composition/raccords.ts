/**
 * C6-H24b-a · raccords permis entre plans (fonction pure, NON branchée : rien n'importe ce fichier).
 * Un raccord (fondu ou glissement) n'existe qu'entre deux illustrations voisines. Jamais un côté qui montre
 * la personne (double, écran partagé, mise en page facecam) : Q7. Jamais si l'un des deux plans dure moins de 0,6 s.
 */
import type { PlanScene } from "./scene";
import { EPS } from "../../lib/tolerance";

export type StyleMontage = "coupe" | "fondu" | "glissement";
export interface RaccordMontage {
  /** Indice du plan qui précède le raccord (le raccord est entre `indexAvant` et `indexAvant + 1`). */
  indexAvant: number;
  type: "fondu" | "glissement";
}

/** Durée minimale (s) de chacun des deux plans d'un raccord. */
export const DUREE_MIN_RACCORD_SEC = 0.6;
// Tolérance flottante : 0,6 s exactement reste permis.

const illustrationSansVisage = (p: PlanScene): boolean =>
  p.type === "illustration" && p.ecranPartage === undefined && p.miseEnPage === undefined;

const assezLong = (p: PlanScene): boolean => p.finSec - p.debutSec >= DUREE_MIN_RACCORD_SEC - EPS;

export function raccordsStyleMontage(plans: readonly PlanScene[], style: StyleMontage): RaccordMontage[] {
  if (style !== "fondu" && style !== "glissement") return [];
  const sortie: RaccordMontage[] = [];
  for (let i = 0; i + 1 < plans.length; i++) {
    const a = plans[i]!;
    const b = plans[i + 1]!;
    if (!illustrationSansVisage(a) || !illustrationSansVisage(b)) continue;
    if (!assezLong(a) || !assezLong(b)) continue;
    sortie.push({ indexAvant: i, type: style });
  }
  return sortie;
}
