"use client";

/**
 * Bouton « Fabriquer la vidéo » : le montant est affiché à titre d'information, aucune confirmation n'est demandée.
 * Si le serveur répond qu'il faut un autre montant, `onFabriquer` rend `{ centimes }` et UNE seule relance part avec lui.
 */
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { formaterMontant } from "@/lib/montants";
import { fabriquerAvecUneRelance, montantApresControle } from "./avant-prix";

const euros = (centimes: number) => formaterMontant({ centimes: Math.max(0, Math.ceil(centimes)), devise: "EUR" });

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
  /** Texte du bouton ; absent : « Fabriquer la vidéo (≈ prix) ». */
  libelle?: string;
  /**
   * Contrôle fait AVANT la fenêtre de prix (ex. image déjà traitée) : `false` arrête (rien n'est demandé), `true` continue,
   * `{ centimes }` continue avec ce montant. Absent : comportement d'origine.
   */
  avantPrix?: () => Promise<boolean | { centimes: number }>;
}) {
  const [enCours, setEnCours] = useState(false);
  const verrou = useRef(false);

  async function cliquer() {
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    try {
      const montant = await montantApresControle(montantCentimes, avantPrix);
      if (montant === null) return;
      await fabriquerAvecUneRelance(montant, onFabriquer);
    } finally {
      verrou.current = false;
      setEnCours(false);
    }
  }

  return (
    <Bouton icone="film" taille="lg" pleineLargeur chargement={enCours} disabled={desactive || enCours} onClick={() => void cliquer()}>
      {libelle ?? `Fabriquer la vidéo (≈ ${euros(montantCentimes)})`}
    </Bouton>
  );
}
