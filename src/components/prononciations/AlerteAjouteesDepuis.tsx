"use client";

import { useState } from "react";
import { BoutonIcone, Icone } from "@/components/ui";
import type { PrononciationAjouteeDepuis } from "@/domaine/prononciations";
import { plansDuMot, RefairePhrase, type PlanPhrase } from "./RefairePhrase";

/**
 * Contrôle de la fiche vidéo (n° 9) : « Prononciation ajoutée depuis : refaire la phrase ? » quand la vidéo a été
 * fabriquée AVANT l'ajout (ou le changement) d'un mot qu'elle contient. Un geste par mot ; « Plus tard » masque
 * l'alerte pour cette visite seulement (rien n'est perdu).
 */
export function AlerteAjouteesDepuis({ videoId, ajoutees, plans }: { videoId: string; ajoutees: PrononciationAjouteeDepuis[]; plans: PlanPhrase[] }) {
  const [masquee, setMasquee] = useState(false);
  if (!ajoutees.length || masquee) return null;
  return (
    <section aria-label="Prononciations ajoutées depuis la fabrication" className="mt-4 rounded-carte border border-ambre/30 bg-ambre-doux p-4">
      <div className="flex items-start gap-3">
        <Icone nom="son" size={18} className="mt-0.5 shrink-0 text-ambre" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-texte">Prononciation ajoutée depuis</p>
          <p className="text-sm text-texte-doux">Cette vidéo a été faite avant. Refaire la phrase ?</p>
        </div>
        <BoutonIcone icone="fermer" libelle="Plus tard" onClick={() => setMasquee(true)} />
      </div>
      <ul className="mt-3 grid gap-2">
        {ajoutees.map((a) => (
          <li key={a.id} className="grid gap-2 rounded-xl bg-surface-1 p-3">
            <span className="min-w-0 text-sm text-texte">
              <span className="font-semibold">{a.mot}</span> <span className="text-texte-faible">« {a.prononciation} »</span>
            </span>
            <RefairePhrase videoId={videoId} plans={plansDuMot(plans, a.mot)} mot={a.mot} prononciation={a.prononciation} compacte className="w-full" />
          </li>
        ))}
      </ul>
    </section>
  );
}
