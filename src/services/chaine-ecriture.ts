/** Réglages › Écriture des scripts : la chaîne qui écrit les PROCHAINS scripts (réglage `generateur.chaine`). Serveur seulement. */
import "server-only";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { PARAM_CHAINE } from "./generation-claude";

/** Depuis le 23/10/2026 (décision de Will : « on garde l'Économique »), seule la chaîne courte se choisit ; équipe (Premium) et grande sont verrouillées. */
export const CHAINES_CHOISIES = ["courte"] as const;
export type ChaineChoisie = (typeof CHAINES_CHOISIES)[number];
/** Donnée non sûre : seulement la valeur exacte « courte » (jamais « equipe », « complete », « Equipe »). */
export const estChaineChoisie = (v: unknown): v is ChaineChoisie => v === "courte";

/**
 * Ce que l'écran coche, d'accord avec ce qui écrit vraiment (`chaineDeLEcriture`) : toujours « courte » (réglage absent,
 * « equipe », « complete » ou inconnu en base : la courte écrit).
 */
export async function lireChaineReglee(): Promise<ChaineChoisie> {
  return "courte";
}

export async function definirChaineEcriture(valeur: unknown): Promise<ChaineChoisie> {
  await exigerSession();
  if (!estChaineChoisie(valeur)) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
  if ((await lireParametre<unknown>(PARAM_CHAINE, null)) === valeur) return valeur; // double clic : rien de plus
  await ecrireParametre(PARAM_CHAINE, valeur);
  await journaliser("reglages", "Chaîne d'écriture : Économique");
  return valeur;
}
