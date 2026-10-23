/**
 * VOIX DU FORMAT « CAS CONCRET MD » (tâche X1, X8) : la voix lue est la voix effective du format de l'avocat
 * (Personnages › Voix › Par format, sinon la voix habituelle), prête et de HeyGen. La feuille « Votre vidéo » montre la consigne et le lien AVANT le clic sur
 * « Fabriquer » ; un refus « Votre voix n'est pas prête. » du lancement devient cette consigne.
 *
 * Une seule règle : `voixDeReference` de `cas-concret.ts` (X4 : la copie de X1 est retirée).
 */
import "server-only";
import { CONSIGNE_VOIX_CAS_CONCRET } from "@/moteurs/montage-cas-concret/avant-prix";
import { voixDeReference, type IssueCasConcret } from "./cas-concret";
import { trouverMoi } from "./moi";

export interface EtatVoixCasConcret {
  prete: boolean;
  /** L'onglet « Voix » de votre fiche personnage (ou la liste des personnages). */
  lien: string;
}

/** Une voix prête de HeyGen est-elle disponible pour l'avocat (désignée, sinon habituelle) ? */
export async function etatVoixCasConcret(): Promise<EtatVoixCasConcret> {
  const moi = await trouverMoi();
  if (!moi) return { prete: false, lien: "/personnages" };
  return { prete: !!(await voixDeReference()), lien: `/personnages/${moi.id}?onglet=voix` };
}

/** Le refus « Votre voix n'est pas prête. » du lancement dit quoi faire. */
export function avecConsigneVoix(issue: IssueCasConcret): IssueCasConcret {
  return issue.statut === "refusee" && issue.phrase === "Votre voix n'est pas prête." ? { ...issue, phrase: CONSIGNE_VOIX_CAS_CONCRET } : issue;
}
