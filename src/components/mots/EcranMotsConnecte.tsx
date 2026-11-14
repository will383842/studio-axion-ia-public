"use client";

import { useRouter } from "next/navigation";
import { activerMotAction, apercuTextesMotAction, changerCibleAction, creerMotAction, pauseMotAction, validerTextesMotAction, activerMotLocalAction, mettreEnPauseAction, mettreEnPauseLocalAction, reactiverAction, refermerDisjoncteurAction, reglerPlafondsAction, reglerParcoursAction, validerMotGuideAction, validerFormulationAction } from "@/app/(studio)/mots/actions";
import type { VueMots } from "@/services/mots-service";
import type { EtatBranchement } from "@/services/branchements-zernio";
import { EnTetePage } from "@/components/ui/EnTetePage";
import type { ServicesMotsCibles, VueMotsCibles } from "@/domaine/guide-reseau/vue-mots-cibles";
import { EcranMotsCibles } from "./EcranMotsCibles";
import { EcranMots, type ServicesMots } from "./EcranMots";
import type { EtatReglagesParcours } from "@/services/parcours-reglages";
import type { TableauSuivi } from "./suivi-affichage";

/** Les services de l'écran = les actions serveur de /mots (session exigée côté serveur). */
export const SERVICES_MOTS: ServicesMots = {
  mettreEnPause: mettreEnPauseAction,
  reactiver: reactiverAction,
  activerLocal: activerMotLocalAction,
  mettreEnPauseLocal: mettreEnPauseLocalAction,
  refermerDisjoncteur: refermerDisjoncteurAction,
  reglerPlafonds: reglerPlafondsAction,
  reglerParcours: reglerParcoursAction,
  validerGuide: validerMotGuideAction,
  validerFormulation: validerFormulationAction,
};

/** Les services de l'écran « mots et cibles » = les actions serveur de /mots (session exigée dans chaque geste). */
export const SERVICES_MOTS_CIBLES: ServicesMotsCibles = {
  creerMot: creerMotAction,
  changerCible: changerCibleAction,
  apercuTextes: apercuTextesMotAction,
  validerTextes: validerTextesMotAction,
  activer: activerMotAction,
  mettreEnPause: pauseMotAction,
};

export function EcranMotsConnecte({ vue, branchement, comptes, suivi, suiviIndisponible, reglages, motsCibles = null }: { motsCibles?: VueMotsCibles | null; reglages?: EtatReglagesParcours | null; vue: VueMots; comptes: readonly string[]; branchement: EtatBranchement | null; suivi?: TableauSuivi | null; suiviIndisponible?: boolean }) {
  const router = useRouter();
  const rafraichir = () => router.refresh();
  return (
    <div className="flex flex-col gap-8">
      <EnTetePage titre="Réponses automatiques" />
      {/* Sans le catalogue du site (aucune copie récente), cet écran est absent : l'écran des mots d'avant s'affiche seul. */}
      {motsCibles !== null && <EcranMotsCibles vue={motsCibles} services={SERVICES_MOTS_CIBLES} onChange={rafraichir} />}
      <EcranMots vue={vue} services={SERVICES_MOTS} branchement={branchement} comptes={comptes} suivi={suivi} suiviIndisponible={suiviIndisponible} reglages={reglages} onChange={rafraichir} />
    </div>
  );
}
