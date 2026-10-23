"use client";

import { motion } from "motion/react";
import { Icone } from "@/components/ui/Icone";
import { texteScript } from "@/domaine/derivations";
import { estimerDureeTexte, libelleDuree, obtenirFormat } from "@/formats";
import type { ScriptGenere } from "@/fournisseurs";
import { cn } from "@/lib/cn";

/** Les 3 versions proposées : lettre, note en gros, durée, titre. Un toucher pour choisir. */
export function ChoixVersions({ formatId, versions, choisie, onChoisir, className }: { formatId: string; versions: ScriptGenere[]; choisie?: number; onChoisir: (i: number) => void; className?: string }) {
  const format = obtenirFormat(formatId);
  return (
    <div role="radiogroup" aria-label="Versions proposées" className={cn("grid grid-cols-3 gap-2", className)}>
      {versions.map((v, i) => {
        const actif = choisie === i;
        const meilleure = v.notes.globale === Math.max(...versions.map((x) => x.notes.globale));
        return (
          <motion.button
            key={i}
            type="button"
            role="radio"
            aria-checked={actif}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            onClick={() => onChoisir(i)}
            className={cn(
              "relative isolate flex min-h-32 flex-col overflow-hidden rounded-carte border p-3 text-left transition-colors duration-200",
              actif ? "border-orange bg-surface-2 shadow-orange" : "border-trait bg-surface-1 hover:border-trait-fort",
            )}
          >
            {actif && <span aria-hidden className="absolute inset-0 -z-10 lueur" />}
            <span className="flex items-center justify-between">
              <span className={cn("grid size-7 place-items-center rounded-full font-titre text-sm", actif ? "bg-orange text-sur-orange" : "bg-surface-3 text-texte-doux")}>
                {actif ? <Icone nom="coche" size={14} strokeWidth={3} /> : String.fromCharCode(65 + i)}
              </span>
              {meilleure && <Icone nom="etoile" size={14} className="text-orange-vif" fill="currentColor" />}
            </span>
            <span className="mt-2 font-titre text-3xl tabular-nums leading-none text-texte">{v.notes.globale}</span>
            <span className="mt-1 line-clamp-2 text-xs font-semibold leading-snug text-texte-doux">{v.titre}</span>
            <span className="mt-auto pt-1 text-[11px] tabular-nums text-texte-faible">{libelleDuree(estimerDureeTexte(format, texteScript(v.blocs)))}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
