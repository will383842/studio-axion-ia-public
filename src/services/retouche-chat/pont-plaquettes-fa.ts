/**
 * S-15-b3 : pont (SANS appelant à la livraison) entre l'écran du chat et `lancerRetouche` pour la face caméra animée :
 * les opérations sur les plaquettes (pièce b1, relues par le moteur) partent dans UNE opération `plaquettesV4`. Gratuit
 * (re-rendu de la version gardée). Un refus ne renvoie jamais le message d'origine (il peut porter un montant).
 * L'appel par l'écran / la porte unique et l'allumage restent à S-14-c3 et à Williams.
 */
import type { OperationMontage } from "@/moteurs/types";

/** Consigne fixe écrite dans la retouche (la demande lue par le chat est dans les opérations). */
export const CONSIGNE_PLAQUETTES_FA = "Changements des plaquettes demandés dans la conversation.";
export const PHRASE_REFUS_PLAQUETTES_FA = "La retouche des plaquettes n'a pas pu être lancée. Réessayez dans un instant.";

export interface DepsPlaquettesFA {
  lancerRetouche: (videoId: string, planIds: string[], consigne: string, options: { operations: OperationMontage[] }) => Promise<{ travailId?: unknown } | null | undefined>;
}

export type IssuePlaquettesFA = { statut: "lancee"; travailId: string } | { statut: "refusee"; phrase: string };

export async function lancerRetouchePlaquettesFA(videoId: string, operations: unknown, dep: DepsPlaquettesFA): Promise<IssuePlaquettesFA> {
  const refus: IssuePlaquettesFA = { statut: "refusee", phrase: PHRASE_REFUS_PLAQUETTES_FA };
  try {
    const r = await dep.lancerRetouche(videoId, [], CONSIGNE_PLAQUETTES_FA, { operations: [{ type: "plaquettesV4", operations }] });
    if (!r || typeof r.travailId !== "string" || !r.travailId) return refus;
    return { statut: "lancee", travailId: r.travailId };
  } catch {
    // Le message d'origine peut porter un montant : il n'est jamais renvoyé à l'écran.
    return refus;
  }
}

/** Dépendances du studio (import dynamique : rien n'est chargé tant que le pont n'est pas appelé). */
export function depsPlaquettesStudio(): DepsPlaquettesFA {
  return { lancerRetouche: (videoId, planIds, consigne, options) => import("../fabrication").then((f) => f.lancerRetouche(videoId, planIds, consigne, options)) };
}
