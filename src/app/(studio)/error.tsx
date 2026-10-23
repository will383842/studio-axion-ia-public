"use client";

import { useEffect } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";
import { stockageSession } from "@/hooks/useSaisieGardee";
import { estErreurActionIntrouvable, rechargementPermis } from "@/lib/mise-a-jour-studio";

/** Erreur d'un écran connecté : une phrase, un bouton (B.8 #19). Next 16 : la prop s'appelle `retry`. */
export default function Erreur({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Page ouverte avant une mise en ligne (secours du filet central RepriseMiseAJour) : jamais d'erreur brute, la page
  // se recharge (une fois par minute au plus).
  const miseAJour = estErreurActionIntrouvable(error);
  useEffect(() => {
    console.error(error);
    const s = stockageSession();
    if (miseAJour && s && rechargementPermis(s, Date.now())) window.location.reload();
  }, [error, miseAJour]);
  if (miseAJour) {
    return (
      <EtatVide
        icone="actualiser"
        titre="Le studio vient d'être mis à jour"
        phrase="Rechargez la page pour continuer."
        action={
          <Bouton icone="actualiser" onClick={() => window.location.reload()}>
            Recharger
          </Bouton>
        }
      />
    );
  }
  return (
    <EtatVide
      icone="attention"
      titre="Un souci est survenu"
      phrase="Rien n'est perdu. Réessayez dans un instant."
      action={
        <Bouton icone="reessayer" onClick={() => retry()}>
          Réessayer
        </Bouton>
      }
    />
  );
}
