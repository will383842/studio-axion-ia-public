// Aiguillage d'un mot commenté : PUR. Un mot inconnu (ou une liste illisible) ne déclenche JAMAIS d'envoi : il va dans « À traiter ».
import { RESEAUX_REPONSE_PUBLIQUE_SEULE, type Canal } from "./origine-v3";

export type Decision = { action: "reponse_publique" } | { action: "message_prive" } | { action: "a_traiter"; motif: "mot_inconnu" };

/**
 * `mots` : liste des mots connus (majuscules), ou `null` si elle n'a pas pu être lue. Liste absente ou vide = tout mot est inconnu.
 * LinkedIn et TikTok : réponse publique seule, même si le canal demandé est le message privé.
 */
export function decisionPourMot(e: { mot: string | null; reseau: string; canal: Canal; mots: readonly string[] | null }): Decision {
  const mot = e.mot?.trim().toUpperCase() ?? "";
  if (!mot || !e.mots || !e.mots.some((m) => m.toUpperCase() === mot)) return { action: "a_traiter", motif: "mot_inconnu" };
  if (e.canal === "message_prive" && !RESEAUX_REPONSE_PUBLIQUE_SEULE.includes(e.reseau)) return { action: "message_prive" };
  return { action: "reponse_publique" };
}
