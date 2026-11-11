"use client";

import { useRouter } from "next/navigation";
import { activerMotLocalAction, mettreEnPauseAction, mettreEnPauseLocalAction, reactiverAction, refermerDisjoncteurAction, reglerPlafondsAction, validerMotGuideAction, validerAdresseRefuseeAction } from "@/app/(studio)/mots/actions";
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
  validerGuide: validerMotGuideAction,
  validerAdresseRefusee: validerAdresseRefuseeAction,
};

export function EcranMotsConnecte({ vue, branchement, comptes }: { vue: VueMots; comptes: readonly string[]; branchement: EtatBranchement | null }) {
  const router = useRouter();
  return <EcranMots vue={vue} services={SERVICES_MOTS} branchement={branchement} comptes={comptes} onChange={() => router.refresh()} />;
}
