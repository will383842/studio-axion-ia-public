/** Réglages de cadence : lecture et écriture dans la table des paramètres. Aucun appel externe. */
import "server-only";
import { CLE_REGLAGES_CADENCE, normaliserReglagesCadence, REGLAGES_CADENCE_DEFAUT, type ReglagesCadence } from "@/domaine/cadence/reglages";
import { ecrireParametre, journaliser, lireParametre } from "@/services/_commun";
import { exigerSession } from "@/services/auth";

export async function lireReglagesCadence(): Promise<ReglagesCadence> {
  try {
    return normaliserReglagesCadence(await lireParametre<unknown>(CLE_REGLAGES_CADENCE, REGLAGES_CADENCE_DEFAUT));
  } catch {
    return REGLAGES_CADENCE_DEFAUT;
  }
}

export async function enregistrerReglagesCadence(brut: unknown): Promise<ReglagesCadence> {
  await exigerSession();
  const propres = normaliserReglagesCadence(brut);
  await ecrireParametre(CLE_REGLAGES_CADENCE, propres);
  await journaliser("reglages", "Cadence de publication : réglages enregistrés");
  return propres;
}
