"use client";

import { useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { notifier } from "@/components/ui/Toast";
import type { ResultatChangement, VueATraiter } from "@/services/a-traiter-types";
import { CarteATraiter } from "./CarteATraiter";

/** Ce que l'écran appelle : en production les gestes de `a-traiter-gestes`, dans les tests un faux. */
export interface ServicesATraiter {
  fait(id: string): Promise<ResultatChangement>;
  ignorer(id: string): Promise<ResultatChangement>;
  stop(id: string, compte: string): Promise<ResultatChangement>;
}

/** Écran « À traiter à la main » : une carte à la fois, la plus prioritaire d’abord. */
export function EcranATraiter({ vue, services, compte, onChange }: { vue: VueATraiter; services: ServicesATraiter; compte: string; onChange?: () => void }) {
  const [enCours, demarrer] = useTransition();
  const [fait, setFait] = useState<readonly string[]>([]);
  const restantes = vue.cartes.filter((c) => !fait.includes(c.idEvenement));

  if (vue.etat === "desactive") return <EtatVide compact icone="envoyer" titre="Désactivé" phrase="Cet écran est éteint pour le moment." />;
  if (vue.etat === "illisible") return <EtatVide compact icone="envoyer" titre="Source non lisible" phrase="Nous n’arrivons pas à lire la liste. Réessayez plus tard." />;
  const carte = restantes[0];
  if (!carte) return <EtatVide compact icone="envoyer" titre="Rien à traiter" phrase="Les commentaires à traiter à la main arrivent ici." />;

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
      <p className="text-sm text-texte-doux" data-restantes>{restantes.length} à traiter</p>
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
    </div>
  );
}
