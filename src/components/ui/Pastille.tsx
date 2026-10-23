import type { ReactNode } from "react";
import type { Tonalite } from "@/domaine/libelles";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";

const TONS: Record<Tonalite, string> = {
  orange: "bg-orange-doux text-orange-vif border-orange/30",
  sauge: "bg-sauge-doux text-sauge border-sauge/30",
  ambre: "bg-ambre-doux text-ambre border-ambre/30",
  brique: "bg-brique-doux text-brique border-brique/30",
  neutre: "bg-surface-2 text-texte-doux border-trait",
};

export interface ProprietesPastille {
  ton?: Tonalite;
  icone?: NomIcone;
  /** Point animé (en cours). */
  point?: boolean;
  taille?: "sm" | "md";
  className?: string;
  children: ReactNode;
}

/** Étiquette courte colorée par tonalité (jetons uniquement). */
export function Pastille({ ton = "neutre", icone, point, taille = "sm", className, children }: ProprietesPastille) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold",
        taille === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        TONS[ton],
        className,
      )}
    >
      {point && (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {icone && <Icone nom={icone} size={taille === "sm" ? 12 : 14} />}
      {children}
    </span>
  );
}
