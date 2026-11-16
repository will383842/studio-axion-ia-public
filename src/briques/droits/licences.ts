/**
 * LICENCES SANS CRÉDIT (C6-H16). PUR, SANS alias « @/ » : lisible par `studio-rendu`.
 * Une pièce n'entre automatiquement que si sa licence n'exige aucun crédit.
 */
import type { EntreeDroit } from "./types";

/** Libellés exacts du registre (champ `licence`). */
export const LICENCES_SANS_CREDIT = [
  "Création interne Axion-IA",
  "ISC",
  "SIL OFL 1.1",
  "ISC + MIT (Feather)",
  "CC0 1.0",
  "MIT",
  "Apache-2.0",
] as const;

/** Identifiants SPDX admis (ne sert qu'aux imports d'icônes et d'animations). */
export const SPDX_ADMIS = ["MIT", "ISC", "Apache-2.0", "CC0-1.0", "Unlicense", "OFL-1.1"] as const;

/** Vrai si l'entrée peut entrer au registre sans validation humaine. Refuse CC-BY, BY-SA, NC, ND, GPL, MPL, LicenseRef-*, inconnu. */
export function admissibleEnAutomatique(entree: EntreeDroit): boolean {
  if (!(LICENCES_SANS_CREDIT as readonly string[]).includes(entree.licence)) return false;
  if ((entree.creditRequis as boolean | undefined) === true) return false;
  if (entree.type === "icone" || entree.type === "animation") {
    if (!entree.spdx || !(SPDX_ADMIS as readonly string[]).includes(entree.spdx)) return false;
    if (!entree.fichierLicence || entree.fichierLicence.trim() === "") return false;
  }
  return true;
}
