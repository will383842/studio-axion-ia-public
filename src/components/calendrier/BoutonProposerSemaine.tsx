"use client";

/**
 * Bouton « Proposer la semaine » (CAL-18). Il demande à l'usine une semaine de propositions (appel serveur fourni par l'hôte) et les AFFICHE
 * en cartes pointillées « Proposée ». Il ne programme, ne valide ni ne refuse rien : un seul lien mène à l'écran « À valider », où vous
 * validez. Le bouton est discret (jamais orange plein : le bouton principal de l'écran reste unique) ; l'ajout à la main n'est jamais bloqué.
 */
import { useRef, useState } from "react";
import type { Resultat } from "@/services/_commun";
import type { SemaineProposee } from "@/services/proposer-semaine";
import { CarteProposition } from "./CarteProposition";

export interface PropsBoutonProposerSemaine {
  /** Lundi de la semaine à proposer (AAAA-MM-JJ). */
  debutSemaine: string;
  /** Fournie par l'hôte (action serveur). Jamais un appel direct depuis le navigateur. */
  proposer: (debutSemaine: string) => Promise<Resultat<SemaineProposee>>;
  /** Écran « À valider » de l'usine : l'unique lieu de validation. */
  lienAValider?: string;
}

const BOUTON = "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-trait-fort bg-surface-1 px-4 text-sm font-bold text-texte hover:bg-surface-2 disabled:opacity-60";
export const PHRASE_PANNE_SEMAINE = "La semaine n'a pas pu être proposée pour le moment. Vous pouvez ajouter vos contenus à la main : rien n'est bloqué.";

export function BoutonProposerSemaine({ debutSemaine, proposer, lienAValider }: PropsBoutonProposerSemaine) {
  const [enCours, setEnCours] = useState(false);
  // Garde synchrone : deux clics rapides arrivent avant que l'état se mette à jour.
  const occupe = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [semaine, setSemaine] = useState<SemaineProposee | null>(null);

  async function demander() {
    if (occupe.current) return;
    occupe.current = true;
    setEnCours(true);
    setMessage(null);
    setSemaine(null);
    try {
      const r = await proposer(debutSemaine);
      if (!r.ok) {
        setMessage(r.message);
        return;
      }
      setSemaine(r.donnees);
      const phrase = r.donnees.propositions.length ? (lienAValider ? "Voici la semaine proposée. Rien n'est programmé : validez ce qui vous convient dans « À valider »." : "Voici la semaine proposée. Rien n'est programmé.") : "Aucune proposition pour cette semaine. Vous pouvez ajouter vos contenus à la main.";
      // La phrase de l'Usine (réponse partielle) vient en premier, telle quelle.
      setMessage(r.donnees.message ? `${r.donnees.message} ${phrase}` : phrase);
    } catch {
      setMessage(PHRASE_PANNE_SEMAINE);
    } finally {
      occupe.current = false;
      setEnCours(false);
    }
  }

  return (
    <section aria-label="Proposer la semaine" className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BOUTON} disabled={enCours} aria-busy={enCours} onClick={() => void demander()}>
          {enCours ? "Proposition en cours…" : "Proposer la semaine"}
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-texte-doux">
          {message}
        </p>
      )}
      {semaine && semaine.propositions.length > 0 && (
        <ul className="grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
          {semaine.propositions.map((p) => (
            <li key={p.cle} className="min-w-0">
              <CarteProposition entree={p} debut={debutSemaine} {...(lienAValider ? { lienAValider } : {})} {...(p.sujet ? { sujet: p.sujet } : {})} {...(p.pourquoi ? { pourquoi: p.pourquoi } : {})} {...(p.ressembleA ? { ressembleA: p.ressembleA } : {})} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
