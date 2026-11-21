import "server-only";
import { lireArtefactsTutoriel } from "@/moteurs/montage-tutoriel-outil/artefacts-retouche";
import { capturesDuVolet } from "@/briques/plan-scenes-objets/captures-volet";
import { poserCapturesVolet } from "@/briques/plan-scenes/poser-captures-volet";
import type { PlanValide } from "@/briques/plan-scenes/schema";

/**
 * N-05-VOLET-f : copie de rendu du plan, volet avant/après avec les 2 captures du tutoriel signées à l'instant.
 * À appeler au moment de remettre le plan au rendu, JAMAIS avant un `validerPlan` ni pour stocker : la copie contient
 * des adresses signées que `validerVoletPlan` refuse. Ne lève jamais ; aucun appelant pour l'instant.
 */
export async function copieDeRenduAvecVolet(plan: PlanValide, projetTutoriel: unknown, deps: { signer: (cle: string) => Promise<string> }): Promise<PlanValide> {
  const sansVolet = poserCapturesVolet(plan, null);
  if (sansVolet === plan) return plan;
  try {
    const captures = capturesDuVolet(lireArtefactsTutoriel(projetTutoriel).captures ?? []);
    if (!captures) return sansVolet;
    const [avant, apres] = await Promise.all([deps.signer(captures.avant), deps.signer(captures.apres)]);
    if (!avant || !apres || avant === apres) return sansVolet;
    return poserCapturesVolet(plan, { avant, apres });
  } catch {
    return sansVolet;
  }
}
