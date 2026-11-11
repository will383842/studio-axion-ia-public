import { Icone } from "@/components/ui/Icone";

/** Remarques d'une fiche : jamais un refus, seulement des conseils (état vide : rien n'est affiché). */
export function RemarquesFiche({ remarques }: { remarques: readonly string[] }) {
  if (remarques.length === 0) return null;
  return (
    <ul className="space-y-1.5" aria-label="Remarques">
      {remarques.map((r) => (
        <li key={r} className="flex items-start gap-2 text-sm text-texte-doux">
          <Icone nom="info" size={16} className="mt-0.5 shrink-0 text-ambre" />
          {r}
        </li>
      ))}
    </ul>
  );
}

/** Ce que voit Williams quand il valide : la demande est gardée, le rendu n'est pas encore branché (une pause, pas une erreur). */
export function PauseVitrine({ phrase }: { phrase: string }) {
  return (
    <div role="status" className="flex items-start gap-2 rounded-carte border border-trait bg-surface-2 p-3.5 text-sm text-texte">
      <Icone nom="sablier" size={18} className="mt-0.5 shrink-0 text-orange-vif" />
      {phrase}
    </div>
  );
}
