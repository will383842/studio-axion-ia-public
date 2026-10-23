"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/cn";

export interface EtapeBarre {
  cle: string;
  libelle: string;
}

/**
 * Barre d'étapes de l'assistant : segments qui se remplissent, libellé de l'étape courante.
 * Les étapes passées sont cliquables (revenir en arrière).
 */
export function BarreEtapes({ etapes, courante, onAller, className }: { etapes: EtapeBarre[]; courante: number; onAller?: (index: number) => void; className?: string }) {
  return (
    <nav aria-label="Étapes" className={cn("w-full", className)}>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-texte">{etapes[courante]?.libelle}</span>
        <span className="tabular-nums text-texte-faible">
          {courante + 1}/{etapes.length}
        </span>
      </div>
      <ol className="flex gap-1.5">
        {etapes.map((e, i) => {
          const faite = i < courante;
          const active = i === courante;
          return (
            <li key={e.cle} className="flex-1">
              <button
                type="button"
                disabled={!faite || !onAller}
                onClick={() => onAller?.(i)}
                aria-current={active ? "step" : undefined}
                aria-label={`${e.libelle}${faite ? " (faite)" : active ? " (en cours)" : ""}`}
                className="relative block h-11 w-full disabled:cursor-default"
              >
                <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-3">
                  <motion.span
                    className="absolute inset-y-0 left-0 rounded-full bg-orange"
                    initial={false}
                    animate={{ width: faite ? "100%" : active ? "50%" : "0%" }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
