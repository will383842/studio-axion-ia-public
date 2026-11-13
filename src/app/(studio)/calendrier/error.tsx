"use client";

import { useEffect } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";

/** Erreur du calendrier (CAL-13) : une phrase, un bouton. Aucun détail technique à l'écran. Next 16 : la prop s'appelle `retry`. */
export default function ErreurCalendrier({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div data-etat="erreur">
      <EtatVide icone="attention" titre="Le calendrier n'a pas pu s'afficher" phrase="Rien n'est perdu : vos publications sont intactes. Réessayez dans un instant." action={<Bouton icone="reessayer" onClick={() => retry()}>Réessayer</Bouton>} />
    </div>
  );
}
