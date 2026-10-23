"use client";

/**
 * Bouton « Fabriquer la vidéo » : le montant est affiché, Will le confirme (`confirmerPrix`), puis UN seul envoi.
 * Si le serveur répond qu'il faut un autre montant, `onFabriquer` rend `{ centimes }` et la confirmation est redemandée.
 */
import { useRef, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { formaterMontant } from "@/lib/montants";
import { montantApresControle } from "./avant-prix";

const euros = (centimes: number) => formaterMontant({ centimes: Math.max(0, Math.ceil(centimes)), devise: "EUR" });

export function BoutonFabriquer({
  montantCentimes,
  onFabriquer,
  desactive,
  message = "La voix de cette vidéo est la seule dépense.",
  libelle,
  avantPrix,
}: {
  montantCentimes: number;
  /** Envoie l'accord (montant confirmé). Rend `{ centimes }` si le serveur demande un autre montant. */
  onFabriquer: (accord: number) => Promise<{ centimes: number } | void>;
  desactive?: boolean;
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

  async function lancer(montant: number) {
    const accord = await confirmerPrix({ message, montant });
    if (typeof accord !== "number") return;
    const suite = await onFabriquer(accord);
    if (suite && typeof suite.centimes === "number") await lancer(suite.centimes);
  }

  async function cliquer() {
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    try {
      const montant = await montantApresControle(montantCentimes, avantPrix);
      if (montant === null) return;
      await lancer(montant);
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
