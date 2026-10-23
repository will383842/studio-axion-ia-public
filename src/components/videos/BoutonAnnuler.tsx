"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { annulerVideoAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { notifier } from "@/components/ui/Toast";
import { messageCorbeille } from "@/domaine/corbeille";
import { ANNULER_VIDEO } from "@/domaine/libelles";
import type { Montant } from "@/domaine/types";
import { formaterMontant } from "@/lib/montants";

/**
 * « Annuler cette vidéo » : LE bouton unique de tous les suivis et listes (même libellé, même promesse). Il met la vidéo
 * à la corbeille (restaurable 30 jours), jamais un effacement. Fabrication en cours (`travailId`) : elle est arrêtée
 * d'abord, avec le montant déjà payé comme `BoutonArreter` ; sans `depense` (face caméra, format sans prix), aucun
 * montant n'est montré. Vidéo non terminée seulement : une prête n'a pas ce bouton.
 */
export function BoutonAnnuler({
  videoId,
  travailId,
  depense,
  compact,
  apres,
}: {
  videoId: string;
  /** Fabrication en cours : le travail à arrêter avant de mettre la vidéo à la corbeille. */
  travailId?: string;
  depense?: Montant;
  compact?: boolean;
  /** Où aller une fois la vidéo partie (la fiche d'une vidéo à la corbeille n'a plus de suivi à montrer). */
  apres?: string;
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <Bouton variante={compact ? "fantome" : "secondaire"} icone="corbeille" onClick={() => setOuverte(true)}>
        {ANNULER_VIDEO.libelle}
      </Bouton>
      <FeuilleBas
        ouverte={ouverte}
        onOuverteChange={setOuverte}
        titre={`${ANNULER_VIDEO.libelle} ?`}
        description={travailId ? ANNULER_VIDEO.arretEtConfirmation : ANNULER_VIDEO.confirmation}
        pied={
          <div className="flex flex-col gap-2">
            <Bouton
              variante="danger"
              taille="lg"
              pleineLargeur
              chargement={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await annulerVideoAction(videoId, travailId);
                  if (!r.ok) {
                    notifier.erreur(r.message);
                    return;
                  }
                  setOuverte(false);
                  const { mises, centimes, brouillonsBuffer, pagesRetirees, refus } = r.donnees;
                  const montant = depense && centimes ? ` (${formaterMontant({ centimes, devise: "EUR" })} payés)` : "";
                  if (!mises) {
                    // Fabrication arrêtée, mais la corbeille a refusé : on le dit, la vidéo reste là.
                    notifier.erreur(`Fabrication arrêtée${montant}, la vidéo n'a pas pu aller à la corbeille : ${refus ?? "elle n'a pas pu être mise de côté."}`);
                    router.refresh();
                    return;
                  }
                  const paye = centimes ? ` ${formaterMontant({ centimes, devise: "EUR" })} payés pour les étapes faites.` : "";
                  notifier.succes("Vidéo annulée", `${messageCorbeille(mises, brouillonsBuffer, pagesRetirees)}${depense ? paye : ""}`);
                  if (apres) router.push(apres);
                  else router.refresh();
                })
              }
            >
              {ANNULER_VIDEO.libelle}
            </Bouton>
            <Bouton variante="fantome" taille="lg" pleineLargeur onClick={() => setOuverte(false)}>
              Garder la vidéo
            </Bouton>
          </div>
        }
      >
        {depense ? (
          <p className="flex items-baseline justify-between rounded-carte border border-trait bg-surface-2 px-4 py-3 text-sm">
            <span className="text-texte-doux">Déjà dépensé</span>
            <span className="font-titre text-lg tabular-nums text-texte">{formaterMontant(depense)}</span>
          </p>
        ) : (
          <span />
        )}
      </FeuilleBas>
    </>
  );
}
