"use client";

import { useRouter } from "next/navigation";
import { activerMotAction, apercuTextesMotAction, changerCibleAction, creerMotAction, pauseMotAction, validerTextesMotAction, activerMotLocalAction, mettreEnPauseAction, mettreEnPauseLocalAction, reactiverAction, refermerDisjoncteurAction, reglerPlafondsAction, reglerParcoursAction, validerMotGuideAction, validerFormulationAction } from "@/app/(studio)/mots/actions";
import type { VueMots } from "@/services/mots-service";
import type { EtatBranchement } from "@/services/branchements-zernio";
import { EnTetePage } from "@/components/ui/EnTetePage";
import { Onglets } from "@/components/ui/Onglets";
import { fabriquerPdfAction, lireGuideAction, rattacherGuideAction, redigerGuideAction, validerGuideAction } from "@/app/(studio)/mots/actions-guides";
import { EcranGuides, type ServicesGuides } from "./EcranGuides";
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

/** Les services de l'onglet « Guides » = les actions serveur (session exigée ; éteintes, elles refusent). */
export const SERVICES_GUIDES: ServicesGuides = {
  lire: lireGuideAction,
  rediger: redigerGuideAction,
  valider: validerGuideAction,
  fabriquer: fabriquerPdfAction,
  rattacher: rattacherGuideAction,
};

export function EcranMotsConnecte({ guidesActif = false, vue, branchement, comptes, suivi, suiviIndisponible, reglages, motsCibles = null }: { guidesActif?: boolean; motsCibles?: VueMotsCibles | null; reglages?: EtatReglagesParcours | null; vue: VueMots; comptes: readonly string[]; branchement: EtatBranchement | null; suivi?: TableauSuivi | null; suiviIndisponible?: boolean }) {
  const router = useRouter();
  const rafraichir = () => router.refresh();
  const reponses = (
    <>
      {/* Sans le catalogue du site (aucune copie récente), cet écran est absent : l'écran des mots d'avant s'affiche seul. */}
      {motsCibles !== null && <EcranMotsCibles vue={motsCibles} services={SERVICES_MOTS_CIBLES} onChange={rafraichir} />}
      <EcranMots vue={vue} services={SERVICES_MOTS} branchement={branchement} comptes={comptes} suivi={suivi} suiviIndisponible={suiviIndisponible} reglages={reglages} onChange={rafraichir} />
    </>
  );
  // Interrupteur GUIDES_FABRIQUE_ECRAN éteint : l'écran est exactement celui d'avant, sans onglet.
  if (!guidesActif)
    return (
      <div className="flex flex-col gap-8">
        <EnTetePage titre="Réponses automatiques" />
        {reponses}
      </div>
    );
  const mots = [...new Set(vue.lignes.map((l) => l.mot))];
  return (
    <div className="flex flex-col gap-8">
      <EnTetePage titre="Mots" />
      <Onglets
        libelle="Mots"
        valeurParDefaut="reponses"
        onglets={[
          { valeur: "reponses", libelle: "Réponses automatiques", contenu: <div className="flex flex-col gap-8">{reponses}</div> },
          { valeur: "guides", libelle: "Guides", contenu: <EcranGuides mots={mots} services={SERVICES_GUIDES} onChange={rafraichir} /> },
        ]}
      />
    </div>
  );
}
