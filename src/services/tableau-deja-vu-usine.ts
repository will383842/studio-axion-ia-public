import "server-only";
/**
 * FIX-TABLEAU-CASE-PREMIERE-PAGE : pour une commande de l'USINE seulement, et seulement si le réglage
 * `tableau.deja_vu_usine.actif` vaut exactement `true` (éteint par défaut), les outils du tableau fournissent la case
 * « pas en première page d'une recherche » (`par: "usine"`). Lecture seule, aucun appel payant. La création à la main
 * garde la case de Will.
 */
import type { CaseDejaVu } from "@/moteurs/montage-tableau/controles";
import type { CommandeFabrication } from "@/domaine/types";
import { lireParametre } from "./_commun";

export const REGLAGE_DEJA_VU_USINE = "tableau.deja_vu_usine.actif";

const DATE_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** `creeLe` : date de création de la version en cours (stable d'une reprise à l'autre) ; à défaut, aujourd'hui. */
export async function dejaVuUsine(
  commande: Pick<CommandeFabrication, "origine">,
  creeLe: string,
  dependances: { lire?: (id: string) => Promise<unknown>; aujourdhui?: string } = {},
): Promise<CaseDejaVu | undefined> {
  if (commande.origine !== "usine") return undefined;
  try {
    const valeur = await (dependances.lire ?? ((id: string) => lireParametre<unknown>(id, false)))(REGLAGE_DEJA_VU_USINE);
    if (valeur !== true) return undefined;
  } catch {
    return undefined;
  }
  const jour = creeLe.slice(0, 10);
  return { coche: true, le: DATE_JOUR.test(jour) ? jour : (dependances.aujourdhui ?? new Date().toISOString().slice(0, 10)), par: "usine" };
}
