"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Pastille } from "@/components/ui/Pastille";
import { extraitLisible, type CarteATraiter as Donnees } from "@/services/a-traiter-types";

/** Résultat d'une demande de copie (type écrit ici : un composant client n'importe aucun module serveur). */
export type ResultatCopieCarte = { ok: true; texte: string } | { ok: false; phrase: string };
export interface ServicesCopie {
  reponse(id: string): Promise<ResultatCopieCarte>;
  message(id: string): Promise<ResultatCopieCarte>;
}
const ContexteCopie = createContext<ServicesCopie | null>(null);
/** Pose les gestes de copie (actions serveur de la page) pour les cartes affichées dessous. */
export function FournisseurCopie({ services, children }: { services: ServicesCopie; children: ReactNode }) {
  return <ContexteCopie.Provider value={services}>{children}</ContexteCopie.Provider>;
}

export const LIBELLE_MOTIF: Record<Donnees["motif"], string> = {
  echec_envoi: "L’envoi automatique a échoué",
  mot_dans_phrase: "Le mot est dans une phrase",
  mot_inconnu: "Mot inconnu",
  mot_manuel: "Ce réseau se traite à la main",
};

/** Une carte. Tout le texte passe par React (échappé) : jamais de HTML brut. */
export function CarteATraiter({ carte }: { carte: Donnees }) {
  const services = useContext(ContexteCopie);
  const [phrase, setPhrase] = useState<string | null>(null);
  const copier = async (f: (id: string) => Promise<ResultatCopieCarte>) => {
    setPhrase(null);
    try {
      const r = await f(carte.idEvenement);
      if (!r.ok) return setPhrase(r.phrase);
      await navigator.clipboard.writeText(r.texte);
      setPhrase("Texte copié : collez-le à la main.");
    } catch {
      setPhrase("Copie impossible. Rien n’a été envoyé.");
    }
  };
  const peutMessage = carte.reseau === "linkedin" && carte.message === "a_fabriquer" && !carte.opposee;
  return (
    <Carte data-carte="a-traiter" data-motif={carte.motif}>
      <div className="flex flex-wrap items-center gap-2">
        <Pastille ton="neutre">{carte.reseau}</Pastille>
        <span className="text-sm font-semibold text-texte">{LIBELLE_MOTIF[carte.motif]}</span>
        {carte.mot ? <span className="text-sm text-texte-doux" data-mot>Mot : {carte.mot}</span> : null}
      </div>
      <p className="mt-3 text-sm text-texte" data-extrait>{extraitLisible(carte.extrait)}</p>
      <p className="mt-1 text-xs text-texte-doux">Reçu le {carte.creeLe.slice(0, 10)}</p>
      {carte.opposee ? (
        <p className="mt-3 text-sm font-semibold text-texte" data-opposee>Cette personne a demandé l’arrêt : ne rien envoyer.</p>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-semibold text-texte">Réponse proposée</p>
          {carte.kit ? <pre className="whitespace-pre-wrap text-sm text-texte-doux" data-kit>{carte.kit}</pre> : <p className="text-sm text-texte-doux">Pas de réponse proposée : écrivez-la vous-même.</p>}
          {services && peutMessage ? (
            <div className="mt-3 flex flex-wrap gap-2" data-copie>
              <Bouton variante="secondaire" data-copier-message onClick={() => copier(services.message)}>Copier le message</Bouton>
            </div>
          ) : null}
        </div>
      )}
      {phrase ? <p className="mt-2 text-sm text-texte" data-phrase-copie>{phrase}</p> : null}
      <p className="mt-2 text-xs text-texte-doux" data-a-la-main>À la main : aucun envoi automatique sur LinkedIn ni TikTok</p>
    </Carte>
  );
}
