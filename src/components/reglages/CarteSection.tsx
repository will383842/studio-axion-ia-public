import type { ReactNode } from "react";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";

/** Section de Réglages : ancre, icône, titre court, contenu en carte. */
export function CarteSection({ id, icone, titre, action, children, className }: { id: string; icone: NomIcone; titre: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className={cn("scroll-mt-24", className)}>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-doux text-orange-vif">
          <Icone nom={icone} size={18} />
        </span>
        <h2 id={`${id}-titre`} className="flex-1 text-lg text-texte">
          {titre}
        </h2>
        {action}
      </div>
      <div className="rounded-carte border border-trait bg-surface-1 p-4 shadow-carte sm:p-5">{children}</div>
    </section>
  );
}
