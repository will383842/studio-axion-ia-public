"use client";

import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { notifier } from "@/components/ui/Toast";
import { compterParOnglet, filtrerParOnglet, LIBELLE_RESEAU_A_TRAITER, ONGLETS_A_TRAITER, type CarteDejaTraitee, type OngletATraiter } from "@/services/a-traiter-onglets";
import { extraitLisible } from "@/services/a-traiter-types";
import type { ResultatChangement, VueATraiter } from "@/services/a-traiter-types";
import { CarteATraiter } from "./CarteATraiter";

/** Ce que l'écran appelle : en production les gestes de `a-traiter-gestes`, dans les tests un faux. */
export interface ServicesATraiter {
  fait(id: string): Promise<ResultatChangement>;
  ignorer(id: string): Promise<ResultatChangement>;
  stop(id: string, compte: string): Promise<ResultatChangement>;
}

/** Écran « À traiter à la main » : une carte à la fois, la plus prioritaire d’abord. */
export function EcranATraiter({ vue, services, compte, onChange, dejaTraitees }: { vue: VueATraiter; services: ServicesATraiter; compte: string; onChange?: () => void; dejaTraitees?: readonly CarteDejaTraitee[] }) {
  const [enCours, demarrer] = useTransition();
  const [fait, setFait] = useState<readonly string[]>([]);
  const [onglet, setOnglet] = useState<OngletATraiter>("tous");
  const restantes = vue.cartes.filter((c) => !fait.includes(c.idEvenement));
  const compteurs = compterParOnglet(restantes);
  const visibles = filtrerParOnglet(restantes, onglet);

  if (vue.etat === "desactive") return <EtatVide compact icone="envoyer" titre="Désactivé" phrase="Cet écran est éteint pour le moment." />;
  if (vue.etat === "illisible") return <EtatVide compact icone="envoyer" titre="Source non lisible" phrase="Nous n’arrivons pas à lire la liste. Réessayez plus tard." />;
  const carte = visibles[0];
  if (!restantes.length)
    return (
      <div className="flex flex-col gap-4" data-ecran="a-traiter">
        <EtatVide compact icone="envoyer" titre="Rien à traiter" phrase="Les commentaires à traiter à la main arrivent ici." />
        {dejaTraitees ? <DejaTraitees cartes={dejaTraitees} /> : null}
      </div>
    );

  const agir = (f: () => Promise<ResultatChangement>) =>
    demarrer(async () => {
      const r = await f();
      if (r.issue === "refuse") notifier.erreur("Ça n’a pas marché. Réessayez.");
      else {
        if (r.issue === "simule") notifier.essai("rien n’a été envoyé.");
        else notifier.succes("C’est fait.");
        setFait((l) => [...l, carte.idEvenement]);
        onChange?.();
      }
    });
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(carte.kit ?? "");
      notifier.succes("Réponse copiée.");
    } catch {
      notifier.erreur("Copie impossible. Sélectionnez le texte à la main.");
    }
  };

  return (
    <div className="flex flex-col gap-4" data-ecran="a-traiter">
      <div role="tablist" aria-label="Réseaux" className="flex flex-wrap gap-2">
        {ONGLETS_A_TRAITER.map((o) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            id={`onglet-a-traiter-${o.id}`}
            aria-selected={onglet === o.id}
            aria-controls="panneau-a-traiter"
            className={`min-h-11 rounded-full border px-4 text-sm ${onglet === o.id ? "border-texte bg-texte font-semibold text-fond" : "border-surface-3 bg-surface-3 text-texte-doux"}`}
            onClick={() => setOnglet(o.id)}
          >
            {o.libelle} ({compteurs[o.id]})
          </button>
        ))}
      </div>
      <p className="text-sm text-texte-doux" data-restantes>{visibles.length} à traiter</p>
      <div role="tabpanel" id="panneau-a-traiter" aria-labelledby={`onglet-a-traiter-${onglet}`} className="flex flex-col gap-4">
      {!carte ? (
        <EtatVide compact icone="envoyer" titre="Rien à traiter" phrase="Aucun commentaire à traiter pour ce réseau." />
      ) : (
      <>
      <CarteATraiter carte={carte} />
      {carte.opposee ? (
        <div className="flex flex-wrap gap-2" data-actions="opposee">
          <Bouton variante="fantome" disabled={enCours} onClick={() => agir(() => services.ignorer(carte.idEvenement))}>Classer la carte</Bouton>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Bouton variante="secondaire" disabled={!carte.kit} onClick={copier}>Copier la réponse</Bouton>
          {carte.lienPost ? (
            <Bouton variante="secondaire" asChild>
              <a href={carte.lienPost} target="_blank" rel="noopener noreferrer">Ouvrir le post</a>
            </Bouton>
          ) : null}
          <Bouton disabled={enCours} onClick={() => agir(() => services.fait(carte.idEvenement))}>Fait</Bouton>
          <Bouton variante="fantome" disabled={enCours} onClick={() => agir(() => services.ignorer(carte.idEvenement))}>Ignorer</Bouton>
          <Bouton variante="danger" disabled={enCours} onClick={() => agir(() => services.stop(carte.idEvenement, compte))}>STOP</Bouton>
        </div>
      )}
      </>
      )}
      </div>
      {dejaTraitees ? <DejaTraitees cartes={filtrerParOnglet(dejaTraitees, onglet)} /> : null}
    </div>
  );
}

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Bloc replié, lecture seule : rien n'est supprimé ni renvoyé. */
function DejaTraitees({ cartes }: { cartes: readonly CarteDejaTraitee[] }) {
  return (
    <details className="rounded-lg border border-surface-3 p-3" data-deja-traitees>
      <summary className="cursor-pointer text-sm font-semibold">Déjà traitées ({cartes.length})</summary>
      <ul className="mt-2 flex flex-col gap-2">
        {cartes.map((c) => (
          <li key={c.idEvenement} className="break-words text-sm text-texte-doux">
            <span className="font-semibold">{LIBELLE_RESEAU_A_TRAITER[c.reseau]}</span> · {c.statut === "fait" ? "Fait" : "Ignorée"} · {DATE.format(new Date(c.creeLe))}
            <br />
            {extraitLisible(c.extrait)}
          </li>
        ))}
      </ul>
    </details>
  );
}
