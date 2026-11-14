import { useId } from "react";
import type { CreneauDuJour } from "@/app/(studio)/calendrier/charger-plan";
import { DecalerEntree } from "./DecalerEntree";
import { nomReseau } from "./CarteEntreeCalendrier";

/** Créneaux du plan d'un jour, à part de la grille : chacun peut être décalé. Rien à montrer quand la liste est vide. */
export function PlanDuJour({ creneaux, aujourdhui }: { creneaux: readonly CreneauDuJour[]; aujourdhui: string }) {
  void aujourdhui;
  const idTitre = useId();
  if (creneaux.length === 0) return null;
  return (
    <section aria-labelledby={idTitre} data-plan-du-jour className="flex flex-col gap-2 rounded-xl border border-trait bg-surface-1 p-3">
      <h2 id={idTitre} className="text-sm font-extrabold text-texte">Plan du jour</h2>
      <ul className="flex flex-col gap-3">
        {creneaux.map((c) => (
          <li key={c.id} className="flex flex-col gap-1 text-sm text-texte">
            <span className="font-bold">{c.titre}</span>
            <span className="text-texte-doux">
              {c.reseaux.map((r) => nomReseau(r)).join(", ")}
              {c.heure ? ` · ${c.heure}` : ""}
            </span>
            <DecalerEntree id={c.id} jourActuel={c.jourVise} />
          </li>
        ))}
      </ul>
    </section>
  );
}
