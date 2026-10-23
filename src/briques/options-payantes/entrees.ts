/**
 * ACCORDS PORTÉS PAR UNE VERSION (lot J). PUR.
 *
 * Quand Will confirme, la nouvelle version porte le jeton dans ses entrées (`entrees.optionsPayantes.accords`). Au
 * moment de l'appel payant, le serveur lit le jeton DANS LA VERSION qui dépense et le consomme. Une version suivante
 * qui recopie ses entrées recopie un jeton déjà utilisé : refusé, il faudra une nouvelle confirmation.
 */
import { estOptionPayante } from "./registre";
import type { IdOptionPayante } from "./types";

export const CLE_ENTREES_OPTIONS = "optionsPayantes";

export interface EntreesOptionsPayantes {
  /** Jeton confirmé, option par option. */
  accords: Partial<Record<IdOptionPayante, string>>;
  /** Options demandées pour cette version (le moteur les traite comme allumées pour elle seule). */
  demandees: IdOptionPayante[];
}

export function lireEntreesOptions(entrees: Record<string, unknown> | undefined): EntreesOptionsPayantes {
  const brut = (entrees?.[CLE_ENTREES_OPTIONS] ?? {}) as { accords?: unknown; demandees?: unknown };
  const accords: EntreesOptionsPayantes["accords"] = {};
  if (brut.accords && typeof brut.accords === "object") {
    for (const [k, v] of Object.entries(brut.accords as Record<string, unknown>)) if (estOptionPayante(k) && typeof v === "string" && v.length >= 16 && v.length <= 200) accords[k] = v;
  }
  const demandees = Array.isArray(brut.demandees) ? [...new Set(brut.demandees.filter(estOptionPayante))] : [];
  return { accords, demandees };
}

export function avecAccord(entrees: Record<string, unknown>, optionId: IdOptionPayante, jeton: string): Record<string, unknown> {
  const o = lireEntreesOptions(entrees);
  return { ...entrees, [CLE_ENTREES_OPTIONS]: { accords: { ...o.accords, [optionId]: jeton }, demandees: [...new Set([...o.demandees, optionId])] } satisfies EntreesOptionsPayantes };
}

/** Vrai si cette version demande l'option (après une confirmation). */
export function optionDemandeePourVersion(entrees: Record<string, unknown> | undefined, optionId: IdOptionPayante): boolean {
  return lireEntreesOptions(entrees).demandees.includes(optionId);
}
