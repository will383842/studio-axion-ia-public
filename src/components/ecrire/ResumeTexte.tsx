"use client";

import { motion } from "motion/react";
import type { NoteScript } from "@/domaine/types";
import { libelleDuree } from "@/formats";
import { cn } from "@/lib/cn";

function ton(n: number) {
  return n >= 75 ? "sauge" : n >= 55 ? "ambre" : "brique";
}

const TEXTE_TON = { sauge: "text-sauge", ambre: "text-ambre", brique: "text-brique" } as const;
const FOND_TON = { sauge: "bg-sauge", ambre: "bg-ambre", brique: "bg-brique" } as const;

/**
 * Gros chiffres du texte : durée estimée (en direct) face à la cible, note /100 (audit 4.4 : calculée par règles
 * fixes, libellée « Note estimée »),
 * et une mini-barre par critère de la recette (accroche, clarté, rythme, durée, appel).
 */
export function ResumeTexte({
  dureeSec,
  cibleSec,
  notes,
  criteres,
  className,
}: {
  dureeSec: number;
  cibleSec?: number;
  notes?: NoteScript;
  criteres: { id: string; nom: string }[];
  className?: string;
}) {
  const ecart = cibleSec ? dureeSec / cibleSec : 1;
  const tonDuree = !cibleSec ? "sauge" : ecart > 1.2 || ecart < 0.7 ? "brique" : ecart > 1.08 || ecart < 0.85 ? "ambre" : "sauge";
  return (
    <div className={cn("rounded-carte border border-trait bg-surface-1 p-4", className)}>
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-texte-faible">Durée estimée</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <motion.span key={dureeSec} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className={cn("font-titre text-4xl tabular-nums leading-none", TEXTE_TON[tonDuree])}>
              {libelleDuree(dureeSec)}
            </motion.span>
            {cibleSec && <span className="text-sm text-texte-faible">/ {libelleDuree(cibleSec)}</span>}
          </p>
          {cibleSec && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <motion.div className={cn("h-full rounded-full", FOND_TON[tonDuree])} initial={false} animate={{ width: `${Math.min(100, Math.round(ecart * 100))}%` }} transition={{ duration: 0.4 }} />
            </div>
          )}
        </div>
        {notes && (
          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold text-texte-faible">Note estimée</p>
            <p className="mt-1">
              <motion.span key={notes.globale} initial={{ scale: 0.85 }} animate={{ scale: 1 }} className={cn("inline-block font-titre text-4xl tabular-nums leading-none", TEXTE_TON[ton(notes.globale)])}>
                {notes.globale}
              </motion.span>
              <span className="text-sm text-texte-faible">/100</span>
            </p>
          </div>
        )}
      </div>
      {notes && (
        <ul className="mt-4 grid grid-cols-5 gap-2">
          {criteres.map((c) => {
            const n = notes.criteres[c.id] ?? 0;
            return (
              <li key={c.id} className="min-w-0">
                <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                  <motion.div className={cn("h-full rounded-full", FOND_TON[ton(n)])} initial={false} animate={{ width: `${n}%` }} transition={{ duration: 0.5 }} />
                </div>
                <p className="mt-1.5 truncate text-[11px] font-semibold text-texte-faible" title={c.nom}>
                  {c.nom.split(" ")[0]}
                </p>
                <p className="text-sm font-bold tabular-nums text-texte">{n}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
