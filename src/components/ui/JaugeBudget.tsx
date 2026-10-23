import type { Montant } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { formaterMontant } from "@/lib/montants";

/** Jauge du budget du mois : anneau + gros chiffre. Ambre ≥ 80 %, brique ≥ 100 %. */
export function JaugeBudget({ depense, budget, compacte, className }: { depense: Montant; budget: Montant; compacte?: boolean; className?: string }) {
  const pct = budget.centimes ? Math.min(100, Math.round((depense.centimes / budget.centimes) * 100)) : 0;
  const ton = pct >= 100 ? "text-brique" : pct >= 80 ? "text-ambre" : "text-orange-vif";
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className={cn("relative shrink-0", compacte ? "size-14" : "size-20")}>
        <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={r} className="fill-none stroke-surface-3" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={r}
            className={cn("fill-none stroke-current transition-[stroke-dashoffset] duration-700 ease-studio", ton)}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
          />
        </svg>
        <span className={cn("absolute inset-0 grid place-items-center font-titre tabular-nums text-texte", compacte ? "text-sm" : "text-lg")}>{pct}%</span>
      </div>
      <div className="min-w-0">
        <p className={cn("font-titre tabular-nums text-texte", compacte ? "text-xl" : "text-3xl")}>{formaterMontant(depense, { court: true })}</p>
        <p className="text-sm text-texte-doux">sur {formaterMontant(budget, { court: true })} ce mois</p>
      </div>
    </div>
  );
}
