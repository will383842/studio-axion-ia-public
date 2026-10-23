import { LIBELLES_ARGENT } from "@/domaine/libelles";
import type { Montant } from "@/domaine/types";
import { formaterMontant } from "@/lib/montants";

/** L'argent d'un suivi, en quatre façons seulement. Présentation seule ; rien du tout pour un format sans prix. */
export function EncartCout({ nature, montant, sansPrix }: { nature: keyof typeof LIBELLES_ARGENT; montant?: Montant; sansPrix?: boolean }) {
  if (sansPrix) return null;
  if (nature !== "essai" && !montant) return null;
  return (
    <p className="flex items-baseline justify-between rounded-carte border border-trait bg-surface-2 px-4 py-3 text-sm">
      <span className="text-texte-doux">{LIBELLES_ARGENT[nature]}</span>
      {nature !== "essai" && montant && <span className="font-titre text-lg tabular-nums text-texte">{formaterMontant(montant)}</span>}
    </p>
  );
}
