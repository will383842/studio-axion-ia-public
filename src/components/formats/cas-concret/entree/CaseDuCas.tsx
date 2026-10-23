"use client";

/** La case : une phrase entière classe les cartes (sans appel) ; Entrée ouvre la première. Porte B : le texte libre de Will. */
import { Champ } from "@/components/ui/Champ";
import { LONGUEUR_CASE } from "./vue";

/** Longueur de la case de master (réglage `casConcret.porteB` éteint : l'écran ne change pas). */
const LONGUEUR_FILTRE = 160;

export function CaseDuCas({ valeur, onChange, onEntree, porteB = false }: { valeur: string; onChange: (v: string) => void; onEntree: () => void; porteB?: boolean }) {
  return (
    <Champ
      grand
      icone="loupe"
      libelle="Quel cas voulez-vous montrer ?"
      value={valeur}
      maxLength={porteB ? LONGUEUR_CASE : LONGUEUR_FILTRE}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        onEntree();
      }}
    />
  );
}
