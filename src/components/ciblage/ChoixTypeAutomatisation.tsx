import { TYPES_AUTOMATISATION, type TypeAutomatisation } from "@/domaine/ciblage/types";

/** Liste des 12 types, plus « À classer » (absence de type). Rendu serveur compatible. */
export function ChoixTypeAutomatisation({ valeur, nom = "typeAutomatisation" }: { valeur?: TypeAutomatisation | null; nom?: string }) {
  const options: { id: string; libelle: string }[] = [...TYPES_AUTOMATISATION, { id: "", libelle: "À classer" }];
  return (
    <fieldset className="flex flex-col gap-2 text-texte">
      <legend className="mb-1 text-sm text-texte-doux">Quel type d&apos;automatisation ?</legend>
      {options.map((o) => (
        <label key={o.id || "a-classer"} className="flex items-center gap-2 rounded-lg border border-trait bg-surface-2 px-3 py-2">
          <input type="radio" name={nom} value={o.id} defaultChecked={(valeur ?? "") === o.id} />
          <span>{o.libelle}</span>
        </label>
      ))}
    </fieldset>
  );
}
