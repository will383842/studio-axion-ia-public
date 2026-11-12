"use client";

/**
 * Bouton « Fabriquer la vidéo » : aucun montant n'est affiché, aucune confirmation n'est demandée.
 * Si le serveur répond qu'il faut un autre montant, `onFabriquer` rend `{ centimes }` et UNE seule relance part avec lui.
 */
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { fabriquerAvecUneRelance, montantApresControle } from "./avant-prix";


export function BoutonFabriquer({
  montantCentimes,
  onFabriquer,
  desactive,
  libelle,
  avantPrix,
}: {
  montantCentimes: number;
  /** Envoie l'accord (montant confirmé). Rend `{ centimes }` si le serveur demande un autre montant. */
  onFabriquer: (accord: number) => Promise<{ centimes: number } | void>;
  desactive?: boolean;
  /** Gardé pour les appelants existants : plus aucune fenêtre ne l'affiche. */
  message?: string;
  /** Texte du bouton ; absent : « Fabriquer la vidéo ». */
  libelle?: string;
  /**
   * Contrôle fait AVANT l'envoi (ex. image déjà traitée) : `false` arrête (rien n'est demandé), `true` continue,
   * `{ centimes }` continue avec ce montant. Absent : comportement d'origine.
   */
  avantPrix?: () => Promise<boolean | { centimes: number }>;
}) {
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);
  const [phrase, setPhrase] = useState<string | null>(null);

  async function cliquer() {
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    setPhrase(null);
    try {
      const montant = await montantApresControle(montantCentimes, avantPrix);
      if (montant === null) return;
      setPhrase(await fabriquerAvecUneRelance(montant, onFabriquer));
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }

  return (
    <>
      <Bouton icone="film" taille="lg" pleineLargeur chargement={enCours} disabled={desactive || enCours} onClick={() => void cliquer()}>
        {libelle ?? "Fabriquer la vidéo"}
      </Bouton>
      {phrase && (
        <p role="alert" className="mt-2 text-sm text-brique">
          {phrase}
        </p>
      )}
    </>
  );
}
