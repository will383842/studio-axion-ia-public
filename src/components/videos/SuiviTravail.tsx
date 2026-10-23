"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reessayerTravailAction } from "@/app/(studio)/actions";
import { passerDevantAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { SuiviFabrication } from "@/components/creation/SuiviFabrication";
import { ActionsSuivi } from "@/components/fabrication/ActionsSuivi";
import { EnTeteSuivi } from "@/components/fabrication/EnTeteSuivi";
import { versSuiviFabrication } from "@/components/creation/vues-travail";
import { phrasePanneAction } from "@/components/ui/phrasesAction";
import { notifier } from "@/components/ui/Toast";
import { ACTIONS_FABRICATION, LIBELLES_ARGENT } from "@/domaine/libelles";
import { useTravaux } from "@/hooks/useTravaux";
import { formaterMontant } from "@/lib/montants";
import type { VueTravail } from "@/services/vues";
import { BoutonAnnuler } from "./BoutonAnnuler";
import { BoutonArreter } from "./BoutonArreter";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";

/**
 * Progression en direct d'UN travail (fiche vidéo, fin de l'assistant). Rafraîchit la page à la fin.
 * Lot M1b : temps restant en minutes et heure de fin, dépense en direct, rang dans la file (« Passer devant »),
 * bandeau quand un outil est ralenti, et « Arrêter ». Titre par `EnTeteSuivi`, actions rangées par `ActionsSuivi`, rendu par `SuiviFabrication` ;
 * le montant (`pied`, « Déjà payé : x ») reste ici, jamais pour un format sans prix. Une vidéo prête n'a pas de titre en plus (la fiche le dit déjà).
 */
export function SuiviTravail({ initial, compacte, sansPrix }: { initial: VueTravail; compacte?: boolean; sansPrix?: boolean }) {
  const router = useRouter();
  const [relance, setRelance] = useState(false);
  const [devant, passerDevant] = useTransition();
  const [panne, setPanne] = useState<string | null>(null);
  const { travail, actualiser } = useTravaux({
    travailId: initial.id,
    initial: [initial],
    onTermine: () => {
      notifier.succes("Votre vidéo est prête");
      router.refresh();
    },
  });
  const t = travail ?? initial;
  const vue = versSuiviFabrication(t);
  return (
    <div className="space-y-4">
      {vue.etat !== "prete" && <EnTeteSuivi etat={vue.etat} sansTemps />}
      <SuiviFabrication
        vue={vue}
        pied={!sansPrix && t.depense.centimes > 0 ? <>{LIBELLES_ARGENT.dejaPaye} : {formaterMontant(t.depense)}</> : undefined}
        compacte={compacte}
        actions={
          <ActionsSuivi
            etat={vue.etat}
            passerDevant={
              t.rang && !t.urgent ? (
                <Bouton
                  variante="fantome"
                  icone="eclair"
                  chargement={devant}
                  onClick={() =>
                    passerDevant(async () => {
                      setPanne(null);
                      try {
                        const r = await passerDevantAction(t.id);
                        if (!r.ok) notifier.erreur(r.message);
                        else {
                          router.refresh();
                          void actualiser();
                        }
                      } catch (err) {
                        setPanne(phrasePanneAction(err));
                      }
                    })
                  }
                >
                  {ACTIONS_FABRICATION.passerDevant}
                </Bouton>
              ) : undefined
            }
            arreter={<BoutonArreter travailId={t.id} videoId={t.cibleId} depense={sansPrix ? undefined : t.depense} compact={compacte} description={sansPrix ? "Ce qui est déjà fait est gardé." : undefined} />}
            annuler={t.type === "fabrication" ? <BoutonAnnuler videoId={t.cibleId} travailId={vue.etat === "en-cours" ? t.id : undefined} depense={sansPrix ? undefined : t.depense} compact apres="/videos" /> : undefined}
          />
        }
        reessaiEnCours={relance}
        message={panne}
        onReessayer={async () => {
          setPanne(null);
          setRelance(true);
          try {
            let r = await reessayerTravailAction(t.id);
            r = await avecConfirmationPrix(r, (accord) => reessayerTravailAction(t.id, accord));
            if (!r.ok) notifier.erreur(r.message);
            else {
              // Relance acceptée : on relit le suivi tout de suite (sans attendre le prochain tour de la relève).
              router.refresh();
              void actualiser();
            }
          } catch (err) {
            setPanne(phrasePanneAction(err));
          } finally {
            setRelance(false);
          }
        }}
      />
    </div>
  );
}
