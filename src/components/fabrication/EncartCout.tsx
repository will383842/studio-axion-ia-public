import { LIBELLES_ARGENT } from "@/domaine/libelles";
import type { Montant } from "@/domaine/types";

/** Règle de Williams : aucun montant à l'écran. Seul l'état « essai, pas payé » (sans chiffre) reste affiché. */
export function EncartCout({ nature, sansPrix }: { nature: keyof typeof LIBELLES_ARGENT; montant?: Montant; sansPrix?: boolean }) {
  if (sansPrix || nature !== "essai") return null;
  return (
    <p className="flex items-baseline justify-between rounded-carte border border-trait bg-surface-2 px-4 py-3 text-sm">
      <span className="text-texte-doux">{LIBELLES_ARGENT[nature]}</span>
    </p>
  );
}
