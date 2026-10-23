/**
 * Interrupteurs des visuels (carrousels, infographies) : lus dans la table des paramètres du studio, comme les autres
 * interrupteurs. Éteints par défaut ; seul le booléen exact `true` allume. Aucun appel payant.
 */
import "server-only";
import { ErreurStudio, ecrireParametre, journaliser, lireParametre } from "@/services/_commun";
import { exigerSession } from "@/services/auth";

export const CLES_INTERRUPTEURS_VISUELS = ["carrousels.actif", "infographies.actif"] as const;
export type FamilleVisuelle = "carrousels" | "infographies";

export const PHRASE_GENERATEUR_ETEINT = "Le générateur est éteint (Réglages › Carrousels)";

const cleDe = (famille: FamilleVisuelle) => `${famille}.actif` as (typeof CLES_INTERRUPTEURS_VISUELS)[number];

export async function generateurAllume(famille: FamilleVisuelle): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(cleDe(famille), false)) === true;
  } catch {
    return false;
  }
}

/** À appeler tout au début d'une génération, AVANT toute réservation de crédit. */
export async function exigerGenerateurAllume(famille: FamilleVisuelle): Promise<void> {
  if (!(await generateurAllume(famille))) throw new ErreurStudio("GENERATEUR_ETEINT", PHRASE_GENERATEUR_ETEINT);
}

export async function definirGenerateur(famille: FamilleVisuelle, valeur: boolean): Promise<void> {
  await exigerSession();
  await ecrireParametre(cleDe(famille), valeur);
  await journaliser("reglages", `${famille === "carrousels" ? "Carrousels" : "Infographies"} : ${valeur ? "allumé" : "éteint"}`);
}
