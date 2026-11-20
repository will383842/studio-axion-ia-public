/**
 * CHAT DE LA DÉMO FACE CAMÉRA (N-26-b) : « lancer la retouche » gratuit, avec deux gardes, refus FERMÉ (rien lancé) :
 *  - « sans Claude » : sans reprise de la version d'avant (ou sans plan), la retouche referait toute la fabrication
 *    et l'étape plan appellerait Claude : on rend « plan-pret » ;
 *  - argent : l'estimation du moteur, avec les MÊMES opérations que celles que `lancerRetouche` réservera, doit
 *    valoir exactement 0 ; autre chose (ou erreur) : « plan-pret ».
 * Aucune version écrite ici, aucun réglage lu, aucun importeur pour l'instant. Tout arrive par injection.
 */
import "server-only";
import type { RepriseDemo } from "@/moteurs/montage-demo-facecam/chaine";
import type { OperationMontage } from "@/moteurs/types";
import type { Id } from "@/domaine/types";
import type { Montant } from "@/domaine/types";
import type { lancerRetouche } from "../fabrication";

export type DemandeRetoucheDemo = { videoId: Id; plan: unknown; consigne: string };
export type DepsRetoucheDemo = {
  lancer: typeof lancerRetouche;
  estimer: (operations: OperationMontage[]) => Promise<{ total: Montant }>;
  reprise: () => Promise<RepriseDemo | null>;
};
export type ResultatRetoucheDemo = { statut: "lancee"; travailId: Id } | { statut: "plan-pret"; raison: string };

const pret = (raison: string): ResultatRetoucheDemo => ({ statut: "plan-pret", raison });

export async function lancerRetoucheDemo(d: DemandeRetoucheDemo, deps: DepsRetoucheDemo): Promise<ResultatRetoucheDemo> {
  try {
    if (!d.plan || typeof d.plan !== "object") return pret("Le plan de scènes est absent : il reste prêt, rien n'est lancé.");
    // Garde « sans Claude ».
    let reprise: RepriseDemo | null = null;
    try {
      reprise = await deps.reprise();
    } catch {
      reprise = null;
    }
    if (!reprise) return pret("La version d'avant ne permet pas une retouche sans Claude : le plan reste prêt, rien n'est lancé.");
    // Garde d'argent : l'estimation réelle du moteur, mêmes opérations que le lancement.
    const operations: OperationMontage[] = [{ type: "planScenes", plan: d.plan }];
    const estimation = await deps.estimer(operations);
    if (estimation?.total?.centimes !== 0) return pret("Cette retouche ne serait pas gratuite : le plan reste prêt, rien n'est lancé.");
    const r = await deps.lancer(d.videoId, [], d.consigne, { operations });
    return { statut: "lancee", travailId: r.travailId };
  } catch {
    return pret("La retouche n'a pas pu être lancée : le plan reste prêt.");
  }
}
