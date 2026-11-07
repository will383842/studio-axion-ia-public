"use client";

import { useRouter } from "next/navigation";
import { activerMotLocalAction, mettreEnPauseAction, mettreEnPauseLocalAction, reactiverAction, refermerDisjoncteurAction, reglerPlafondsAction } from "@/app/(studio)/mots/actions";
import type { VueMots } from "@/services/mots-service";
import type { EtatBranchement } from "@/services/branchements-zernio";
import { EcranMots, type ServicesMots } from "./EcranMots";

/** Les services de l'écran = les actions serveur de /mots (session exigée côté serveur). */
export const SERVICES_MOTS: ServicesMots = {
  mettreEnPause: mettreEnPauseAction,
  reactiver: reactiverAction,
  activerLocal: activerMotLocalAction,
  mettreEnPauseLocal: mettreEnPauseLocalAction,
  refermerDisjoncteur: refermerDisjoncteurAction,
  reglerPlafonds: reglerPlafondsAction,
};

export function EcranMotsConnecte({ vue, branchement }: { vue: VueMots; branchement: EtatBranchement | null }) {
  const router = useRouter();
  return <EcranMots vue={vue} services={SERVICES_MOTS} branchement={branchement} onChange={() => router.refresh()} />;
}
