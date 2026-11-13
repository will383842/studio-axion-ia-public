"use client";

import { useRouter } from "next/navigation";
import { activerMotLocalAction, mettreEnPauseAction, mettreEnPauseLocalAction, reactiverAction, refermerDisjoncteurAction, reglerPlafondsAction, validerMotGuideAction, validerFormulationAction } from "@/app/(studio)/mots/actions";
import type { VueMots } from "@/services/mots-service";
import type { EtatBranchement } from "@/services/branchements-zernio";
import { EcranMots, type ServicesMots } from "./EcranMots";
import type { TableauSuivi } from "./suivi-affichage";

/** Les services de l'écran = les actions serveur de /mots (session exigée côté serveur). */
export const SERVICES_MOTS: ServicesMots = {
  mettreEnPause: mettreEnPauseAction,
  reactiver: reactiverAction,
  activerLocal: activerMotLocalAction,
  mettreEnPauseLocal: mettreEnPauseLocalAction,
  refermerDisjoncteur: refermerDisjoncteurAction,
  reglerPlafonds: reglerPlafondsAction,
  validerGuide: validerMotGuideAction,
  validerFormulation: validerFormulationAction,
};

export function EcranMotsConnecte({ vue, branchement, comptes, suivi, suiviIndisponible }: { vue: VueMots; comptes: readonly string[]; branchement: EtatBranchement | null; suivi?: TableauSuivi | null; suiviIndisponible?: boolean }) {
  const router = useRouter();
  return <EcranMots vue={vue} services={SERVICES_MOTS} branchement={branchement} comptes={comptes} suivi={suivi} suiviIndisponible={suiviIndisponible} onChange={() => router.refresh()} />;
}
