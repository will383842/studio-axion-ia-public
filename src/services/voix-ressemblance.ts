/**
 * Réglage global « ressemblance de la voix » (14/10, voix de référence) : lu ici, une fois, par le prix (tableau
 * animé, cas concret) et par le lancement, qui le fige dans la commande (`ressemblanceVoix`). Absent : ACTIF, deux
 * relances au plus (`RESSEMBLANCE_VOIX_PAR_DEFAUT`). Le moteur ne lit jamais les réglages.
 */
import { lecturesVoixMax, lireReglageRessemblance, PARAM_RESSEMBLANCE_VOIX, type ReglageRessemblanceVoix } from "@/briques/voix-maitre/reference";
import { lireParametre } from "./_commun";

export async function reglageRessemblanceVoix(): Promise<ReglageRessemblanceVoix> {
  return lireReglageRessemblance(await lireParametre<unknown>(PARAM_RESSEMBLANCE_VOIX, null));
}

/** Lectures payées au plus pour un texte (prix annoncé = ce maximum). */
export async function lecturesVoixMaxDuReglage(): Promise<number> {
  return lecturesVoixMax(await reglageRessemblanceVoix());
}
