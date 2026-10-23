"use client";

/** Choix des réseaux visés : une case par réseau, la liste vient du format. */
import { CaseACocher } from "@/components/ui/CaseACocher";

export interface ReseauChoix {
  valeur: string;
  libelle: string;
}

export function ChoixReseaux({ reseaux, valeurs, onChange }: { reseaux: readonly ReseauChoix[]; valeurs: readonly string[]; onChange: (valeurs: string[]) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-texte-doux">Les réseaux</legend>
      {reseaux.map((r) => (
        <CaseACocher key={r.valeur} libelle={r.libelle} coche={valeurs.includes(r.valeur)} onChange={(v) => onChange(v ? [...valeurs, r.valeur] : valeurs.filter((x) => x !== r.valeur))} />
      ))}
    </fieldset>
  );
}
