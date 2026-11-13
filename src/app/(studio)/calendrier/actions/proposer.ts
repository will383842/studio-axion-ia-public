"use server";

/**
 * Action serveur du bouton « Proposer le texte et le premier commentaire » (CAL-27).
 * Elle PROPOSE seulement : rien n'est écrit ni envoyé. Sans appel à l'assistant branché ici, le texte est le texte
 * automatique de repli (jamais d'appel réel, jamais de dépense) : chaque proposition porte `source: "repli"` et
 * l'écran (ProposerTexte) le dit comme « texte automatique à réécrire », jamais comme une proposition de l'assistant.
 */
import { exigerSession } from "@/services/auth";
import { proposerTexteImporte, type DemandeTexteImporte, type ResultatProposition } from "@/services/texte-post";

export async function proposerTexteAction(demande: Pick<DemandeTexteImporte, "type" | "description" | "texteDesPages" | "reseaux">): Promise<ResultatProposition> {
  await exigerSession();
  const { type, description, texteDesPages, reseaux } = demande;
  return proposerTexteImporte({ type, reseaux, ...(description ? { description } : {}), ...(texteDesPages ? { texteDesPages } : {}) });
}
