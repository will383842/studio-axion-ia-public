"use client";

/**
 * ATTENTE DU MONTAGE FACE CAMÉRA (plan facecam v4, § C.4 et B.25 ; lot D ; harmonisation F3). Remplace le suivi détaillé des étapes :
 * - 4 étapes parlantes (Le son, Les coupes, L'image, Les sous-titres et cartes), rendues par `SuiviFabrication` (aucun montant) ;
 * - titre et phrase communs (`EnTeteSuivi`) : « Prête vers 14 h 20 » et « Vous pouvez fermer » ;
 * - notifications du téléphone allumées UNE fois (prête comme échec) ;
 * - actions rangées par `ActionsSuivi` : « Arrêter » (jamais de montant, pas de passe-droit dans la file) ; un échec propose « Reprendre ».
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reessayerTravailAction } from "@/app/(studio)/actions";
import { ActionsSuivi } from "@/components/fabrication/ActionsSuivi";
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { PrevenirTelephone } from "@/components/fabrication/PrevenirTelephone";
import { SuiviFabrication } from "@/components/creation/SuiviFabrication";
import { versSuiviParlant } from "@/components/creation/vues-travail";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import { BoutonArreter } from "@/components/videos/BoutonArreter";
import { ACTIONS_FABRICATION } from "@/domaine/libelles";
import { heurePrete } from "@/domaine/facecam-parcours";
import { useTravaux } from "@/hooks/useTravaux";
import type { VueTravail } from "@/services/vues";

export function AttenteFacecam({ initial }: { initial: VueTravail }) {
  const router = useRouter();
  const { travail } = useTravaux({
    travailId: initial.id,
    initial: [initial],
    onTermine: () => {
      notifier.succes("Votre vidéo est prête");
      router.refresh();
    },
  });
  const t = travail ?? initial;
  const vue = versSuiviParlant(t.etapes, t.statut);
  const actif = vue.etat === "en-cours";

  return (
    <section aria-label="Montage en cours" className="space-y-4">
      <EnTeteSuivi etat={vue.etat} pret={heurePrete(t.finEstimee)} message={t.erreur?.messagePourWill} />

      <SuiviFabrication vue={vue} compacte />

      {actif && <PrevenirTelephone />}

      <ActionsSuivi
        etat={vue.etat}
        arreter={
          <BoutonArreter
            travailId={t.id}
            videoId={t.cibleId}
            compact
            description="Votre vidéo d'origine est gardée : vous pourrez reprendre le montage."
          />
        }
        reprendre={vue.etat === "coincee" ? <Reessayer travailId={t.id} /> : undefined}
        annuler={t.type === "fabrication" ? <BoutonAnnuler videoId={t.cibleId} travailId={vue.etat === "en-cours" ? t.id : undefined} compact apres="/videos" /> : undefined}
      />
    </section>
  );
}

function Reessayer({ travailId }: { travailId: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  return (
    <Bouton
      icone="reessayer"
      chargement={enCours}
      onClick={() =>
        demarrer(async () => {
          const r = await reessayerTravailAction(travailId, true);
          if (!r.ok) notifier.erreur(r.message);
          else router.refresh();
        })
      }
    >
      {ACTIONS_FABRICATION.reprendreEtape}
    </Bouton>
  );
}
