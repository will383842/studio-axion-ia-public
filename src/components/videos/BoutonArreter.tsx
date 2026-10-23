"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { arreterFabricationAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { notifier } from "@/components/ui/Toast";
import { LIBELLES_ARGENT } from "@/domaine/libelles";
import type { Montant } from "@/domaine/types";
import { formaterMontant } from "@/lib/montants";

/** Phrase de confirmation après l'arrêt : sans `depense` (format sans prix), aucun montant n'est jamais dit. */
export function phraseArret(depense: Montant | undefined, centimesPayes: number): string | undefined {
  if (!depense) return undefined;
  return centimesPayes ? `${formaterMontant({ centimes: centimesPayes, devise: "EUR" })} payés pour les étapes faites.` : "Rien n'a été payé.";
}

/**
 * « Arrêter » une fabrication (B.9 ter) : confirmation dans une feuille du bas — seules les étapes faites sont payées.
 * La vidéo passe « Arrêtée » ; « Reprendre » la remettra en brouillon. Sans `depense` (format sans prix), aucun montant n'est montré ; `description` remplace la phrase d'en-tête (face caméra : aucun mot d'argent).
 */
export function BoutonArreter({ travailId, videoId, depense, compact, description }: { travailId: string; videoId: string; depense?: Montant; compact?: boolean; description?: string }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [enCours, demarrer] = useTransition();
  return (
    <>
      <Bouton variante={compact ? "fantome" : "secondaire"} icone="fermer" onClick={() => setOuverte(true)}>
        Arrêter
      </Bouton>
      <FeuilleBas
        ouverte={ouverte}
        onOuverteChange={setOuverte}
        titre="Arrêter la fabrication ?"
        description={description ?? "Seules les étapes déjà faites sont payées."}
        pied={
          <div className="flex flex-col gap-2">
            <Bouton
              variante="danger"
              taille="lg"
              pleineLargeur
              chargement={enCours}
              onClick={() =>
                demarrer(async () => {
                  const r = await arreterFabricationAction(travailId, videoId);
                  if (!r.ok) {
                    notifier.erreur(r.message);
                    return;
                  }
                  setOuverte(false);
                  notifier.succes("Fabrication arrêtée", phraseArret(depense, r.donnees.centimes));
                  router.refresh();
                })
              }
            >
              Arrêter
            </Bouton>
            <Bouton variante="fantome" taille="lg" pleineLargeur onClick={() => setOuverte(false)}>
              Continuer la fabrication
            </Bouton>
          </div>
        }
      >
        {depense ? (
          <p className="flex items-baseline justify-between rounded-carte border border-trait bg-surface-2 px-4 py-3 text-sm">
            <span className="text-texte-doux">{LIBELLES_ARGENT.dejaPaye}</span>
            <span className="font-titre text-lg tabular-nums text-texte">{formaterMontant(depense)}</span>
          </p>
        ) : (
          <span />
        )}
      </FeuilleBas>
    </>
  );
}
