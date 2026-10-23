/**
 * CHOIX DU FOURNISSEUR HIGGSFIELD (lot L10 « Décor IA »). Par défaut : le DOUBLE DE SIMULATION (aucune dépense).
 *
 * Comme `fournisseurFacecam` (lot A), le vrai client n'est pris que si l'APPELANT le demande (`{ reel: true }`) ET
 * que le serveur a :
 *  - `HIGGSFIELD_API_KEY` (la clé, jamais renvoyée ni écrite) ;
 *  - `HIGGSFIELD_API_URL` en https (aucune adresse par défaut : l'API publique n'est pas encore vérifiée, voir API.md).
 * L'interrupteur « Décor IA » de Réglages (désactivé par défaut) décide en plus si la passe tourne du tout.
 */
import { garderHiggsfield, type GardeOptionPayante } from "@/briques/options-payantes/garde";
import { creerHiggsfieldHttp } from "./client";
import { creerHiggsfieldSimule } from "./simulation";
import type { FournisseurHiggsfield } from "./types";

export type * from "./types";
export { CREDITS_PAR_SECONDE, DUREE_MAX_PASSAGE_SEC, IMAGE_REFERENCE_EXIGEE, MODELES_HIGGSFIELD, creditsPourPassage, verifierDemande } from "./types";
export { CONTRAT_SUPPOSE, creerHiggsfieldHttp, type ContratApiHiggsfield } from "./client";
export { creerHiggsfieldSimule, SOLDE_SIMULE_PAR_DEFAUT, type HiggsfieldSimule, type OptionsHiggsfieldSimule } from "./simulation";

export const VARIABLE_CLE_HIGGSFIELD = "HIGGSFIELD_API_KEY";

/**
 * Lot J : le client réel est TOUJOURS enveloppé par la garde des options payantes (Décor IA, effets main « ultra
 * réaliste ») ; sans `garde`, chaque lancement est refusé (aucun crédit dépensé).
 */
export function fournisseurHiggsfield(options: { reel?: boolean; garde?: GardeOptionPayante } = {}, env: Record<string, string | undefined> = process.env): FournisseurHiggsfield {
  const cle = env[VARIABLE_CLE_HIGGSFIELD]?.trim();
  const url = env.HIGGSFIELD_API_URL?.trim();
  if (options.reel && cle && url && /^https:\/\//.test(url)) return garderHiggsfield(creerHiggsfieldHttp(url, cle), options.garde);
  return creerHiggsfieldSimule();
}
