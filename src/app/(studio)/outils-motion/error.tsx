"use client";

import { Bouton } from "@/components/ui/Bouton";
import { EtatVide } from "@/components/ui/EtatVide";

export default function Erreur({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <EtatVide
      icone="attention"
      titre="Les outils ne s'affichent pas"
      phrase="Rien n'est perdu. Réessayez dans un instant."
      action={
        <Bouton icone="reessayer" onClick={() => retry()}>
          Réessayer
        </Bouton>
      }
    />
  );
}
