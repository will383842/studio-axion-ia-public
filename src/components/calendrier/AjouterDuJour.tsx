"use client";

import { useId, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import type { IdReseau } from "@/domaine/types";
import { AjouterEntreeProposant } from "./AjouterEntreeProposant";
import { nomReseau } from "./CarteEntreeCalendrier";

const COMPTE_PAR_DEFAUT = "compte-studio";

/**
 * Ajout d'un créneau dans la vue Jour : bouton « + Ajouter ce jour-là », choix du réseau parmi les réseaux allumés, puis le formulaire.
 * Le créneau naît « Proposée » : rien ne part d'ici. Le bouton n'est pas orange plein (un seul principal par écran).
 */
export function AjouterDuJour({ jour, aujourdhui, reseaux, comptes }: { jour: string; aujourdhui: string; reseaux: IdReseau[]; comptes: Partial<Record<IdReseau, string>> }) {
  const [ouvert, setOuvert] = useState(false);
  const [choix, setChoix] = useState<IdReseau | null>(null);
  const idZone = useId();
  if (jour < aujourdhui || reseaux.length === 0) return null;
  const reseau = choix && reseaux.includes(choix) ? choix : reseaux[0];
  return (
    <section aria-label="Ajouter un créneau" className="mt-4">
      <Bouton type="button" variante="contour" aria-expanded={ouvert} aria-controls={idZone} onClick={() => setOuvert((o) => !o)}>
        + Ajouter ce jour-là
      </Bouton>
      {ouvert && (
        <div id={idZone} className="mt-3">
          <fieldset className="mb-3 flex flex-wrap gap-2">
            <legend className="mb-1 text-sm font-semibold text-texte-doux">Réseau</legend>
            {reseaux.map((r) => (
              <label key={r} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-trait-fort px-3 text-sm">
                <input type="radio" name={`reseau-${idZone}`} value={r} checked={r === reseau} onChange={() => setChoix(r)} className="accent-accent" />
                {nomReseau(r)}
              </label>
            ))}
          </fieldset>
          <AjouterEntreeProposant key={reseau} jour={jour} compteCible={comptes[reseau] ?? COMPTE_PAR_DEFAUT} reseau={reseau} />
        </div>
      )}
    </section>
  );
}
