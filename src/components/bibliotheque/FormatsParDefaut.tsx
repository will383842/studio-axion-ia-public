"use client";

import { useOptimistic, useTransition } from "react";
import { basculerParDefautAction } from "@/app/(studio)/bibliotheque/actions";
import { Icone, notifier } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { FormatCourt } from "./outils";
import { nomCourtFormat } from "@/formats";

/** Pastilles « Par défaut pour » : un élément devient le style par défaut d'un ou plusieurs formats. */
export function FormatsParDefaut({ elementId, type, actifs, formats, className }: { elementId: string; type: string; actifs: string[]; formats: FormatCourt[]; className?: string }) {
  const [optimistes, basculer] = useOptimistic(actifs, (etat: string[], f: string) => (etat.includes(f) ? etat.filter((x) => x !== f) : [...etat, f]));
  const [, demarrer] = useTransition();

  function changer(formatId: string) {
    const actif = !optimistes.includes(formatId);
    demarrer(async () => {
      basculer(formatId);
      const r = await basculerParDefautAction(elementId, type, formatId, actif);
      if (!r.ok) notifier.erreur(r.message);
    });
  }

  return (
    <div className={className}>
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-texte-doux">
        <Icone nom="etoile" size={14} className="text-orange-vif" />
        Par défaut pour
      </p>
      <div className="flex flex-wrap gap-2">
        {formats.map((f) => {
          const actif = optimistes.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              role="checkbox"
              aria-checked={actif}
              onClick={() => changer(f.id)}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-200",
                actif ? "border-orange bg-orange text-sur-orange" : "border-trait bg-surface-1 text-texte-doux hover:border-trait-fort hover:text-texte",
              )}
            >
              {actif && <Icone nom="etoile" size={13} fill="currentColor" />}
              {nomCourtFormat(f)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
