/**
 * BR-POIDS-PALIERS-v19c : paliers de graisse du mot dit, pour limiter les images en plus (surcoût ≤ + 50 %).
 * PUR : aucune horloge, aucun hasard, import relatif seulement, importable par Remotion.
 * ÉTEINT : rien ne l'importe ; branchement = BR-POIDS-VARIABLE-IV-b.
 */
import { GRAISSE_MAX, GRAISSE_MIN, graisseAuTemps } from "./poids-variable";

export type NombrePaliers = 1 | 2 | 4;
export const PALIERS_GRAISSE = [500, 600, 700, 800] as const;
export const DUREE_MIN_PROGRESSION_SEC = 0.3;
export const PLAFOND_SURCOUT = 0.5;

/** Graisse du mot à l'instant `t`, ramenée à l'un des `paliers` (1 : le mot ne bouge pas, 500). */
export function graisseAuPalier(t: number, debutMot: number, finMot: number, paliers: NombrePaliers): number {
  if (paliers === 1) return GRAISSE_MIN;
  const g = graisseAuTemps(t, debutMot, finMot);
  const pas = (GRAISSE_MAX - GRAISSE_MIN) / (paliers - 1);
  return GRAISSE_MIN + pas * Math.round((g - GRAISSE_MIN) / pas);
}

/** 4 paliers si le mot dure au moins 0,3 s, sinon 1 (figé). */
export function paliersDuMot(debutSec: number, finSec: number): NombrePaliers {
  return finSec - debutSec >= DUREE_MIN_PROGRESSION_SEC ? 4 : 1;
}

/** Nombre d'images en plus au pire : Σ (paliers − 1). */
export function changementsDuPlan(plan: readonly NombrePaliers[]): number {
  return plan.reduce<number>((s, p) => s + (p - 1), 0);
}

/** Paliers de chaque mot sous un budget d'images en plus (`instantsDeBase` × `plafond`, arrondi par le bas). */
export function planDesPaliers(
  mots: readonly { debutSec: number; finSec: number }[],
  instantsDeBase: number,
  plafond = PLAFOND_SURCOUT,
): NombrePaliers[] {
  const brut = Math.floor(Math.max(0, instantsDeBase) * plafond);
  let reste = Number.isFinite(brut) ? brut : 0;
  const plan: NombrePaliers[] = mots.map(() => 1);
  const longs = mots
    .map((m, i) => ({ i, duree: m.finSec - m.debutSec }))
    .filter((x) => paliersDuMot(mots[x.i].debutSec, mots[x.i].finSec) === 4)
    .sort((a, b) => b.duree - a.duree || a.i - b.i);
  for (const { i } of longs) {
    if (reste < 1) break;
    plan[i] = 2;
    reste -= 1;
  }
  for (const { i } of longs) {
    if (reste < 2) break;
    if (plan[i] !== 2) continue;
    plan[i] = 4;
    reste -= 2;
  }
  return plan;
}
