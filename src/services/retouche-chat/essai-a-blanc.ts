/**
 * Essai à blanc du chat de retouche : double du port `appeler`, sans réseau, sans clé, sans dépense.
 * Tous les tests du chat l'utilisent (règle R-7). Aucun import d'argent ni de `generation-claude`.
 */
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { ErreurClaude, type ReponseClaude, type RequeteClaude } from "@/fournisseurs/claude/client";

export const MODELE_ESSAI_A_BLANC = "essai-a-blanc";

/** Réponse simulée : `string` = texte rendu, `Error` = panne simulée (levée). */
export type ReponseEssai = string | Error;
export type ReponsesEssai = readonly ReponseEssai[] | ((requete: RequeteClaude, rang: number) => ReponseEssai);

export interface AppelEssai {
  appeler: AppelClaude;
  /** Copies des requêtes reçues, dans l'ordre des appels. */
  appels: RequeteClaude[];
}

export function creerAppelEssai(reponses: ReponsesEssai): AppelEssai {
  const appels: RequeteClaude[] = [];
  const appeler: AppelClaude = async (requete) => {
    const rang = appels.length;
    appels.push(structuredClone(requete));
    const r = typeof reponses === "function" ? reponses(requete, rang) : reponses[rang];
    if (r === undefined) throw new ErreurClaude("requete", "Essai à blanc : plus de réponse prévue");
    if (r instanceof Error) throw r;
    const reponse: ReponseClaude = {
      texte: r,
      modeleDemande: MODELE_ESSAI_A_BLANC,
      modele: MODELE_ESSAI_A_BLANC,
      replis: [],
      stopReason: "end_turn",
      jetons: { entree: 0, cacheLu: 0, cacheEcrit: 0, sortie: 0 },
    };
    return reponse;
  };
  return { appeler, appels };
}
