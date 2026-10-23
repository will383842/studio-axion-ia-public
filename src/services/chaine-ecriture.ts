/** Réglages › Écriture des scripts : la chaîne qui écrit les PROCHAINS scripts (réglage `generateur.chaine`). Serveur seulement. */
import "server-only";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { PARAM_CHAINE } from "./generation-claude";

export const CHAINES_CHOISIES = ["courte", "equipe"] as const;
export type ChaineChoisie = (typeof CHAINES_CHOISIES)[number];
/** Donnée non sûre : seulement les deux valeurs exactes (jamais « complete », « Equipe », « equipe-v2 »). */
export const estChaineChoisie = (v: unknown): v is ChaineChoisie => v === "courte" || v === "equipe";

/**
 * Ce que l'écran coche, d'accord avec ce qui écrit vraiment (`chaineDeLEcriture`) : réglage ABSENT → « courte » (défaut du
 * code, lot A5) ; « courte » et « equipe » → eux-mêmes ; « complete » ou toute autre valeur → null : rien de coché (la
 * grande chaîne écrit).
 */
export async function lireChaineReglee(): Promise<ChaineChoisie | null> {
  const v = await lireParametre<unknown>(PARAM_CHAINE, null);
  if (v === null || v === undefined) return "courte";
  return estChaineChoisie(v) ? v : null;
}

export async function definirChaineEcriture(valeur: unknown): Promise<ChaineChoisie> {
  await exigerSession();
  if (!estChaineChoisie(valeur)) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
  if ((await lireParametre<unknown>(PARAM_CHAINE, null)) === valeur) return valeur; // double clic : rien de plus
  await ecrireParametre(PARAM_CHAINE, valeur);
  await journaliser("reglages", valeur === "courte" ? "Chaîne d'écriture : Économique" : "Chaîne d'écriture : Premium");
  return valeur;
}
