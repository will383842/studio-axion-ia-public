import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";

/** Statistique : gros chiffre + libellé court (+ tendance). */
export function GrosChiffre({
  valeur,
  libelle,
  icone,
  tendance,
  accent,
  className,
}: {
  valeur: ReactNode;
  libelle: string;
  icone?: NomIcone;
  /** « +12 % » en sauge, « −4 % » en brique. */
  tendance?: { valeur: string; positive: boolean };
  /** Chiffre en orange. */
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {icone && (
        <span className="mb-1 grid size-9 place-items-center rounded-xl bg-surface-2 text-texte-doux">
          <Icone nom={icone} size={18} />
        </span>
      )}
      <span className={cn("font-titre text-3xl tabular-nums leading-none sm:text-4xl", accent ? "text-orange-vif" : "text-texte")}>{valeur}</span>
      <span className="flex items-center gap-2 text-sm text-texte-doux">
        {libelle}
        {tendance && <span className={cn("text-xs font-bold", tendance.positive ? "text-sauge" : "text-brique")}>{tendance.valeur}</span>}
      </span>
    </div>
  );
}
