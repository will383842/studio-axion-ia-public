"use server";

/**
 * CAL-18 : action serveur du bouton « Proposer la semaine ». Elle commence par exigerSession(), puis appelle l'usine par la porte
 * (services/proposer-semaine : plafond d'appels par jour compté ici, côté serveur, sans aucun montant). Rien n'est programmé ni validé d'ici ;
 * sans USINE_URL et clé, aucun appel ne part. Les phrases d'erreur sont celles du service, en français.
 */
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { proposerSemaine, type SemaineProposee } from "@/services/proposer-semaine";

export async function proposerSemaineAction(debutSemaine: string): Promise<Resultat<SemaineProposee>> {
  await exigerSession();
  return essayer(() => proposerSemaine({ debut: String(debutSemaine) }));
}
