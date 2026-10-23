"use client";

import type { TypeMatiere } from "@/domaine/types";
import { LIBELLES_MATIERE, TYPES_MATIERE } from "@/domaine/matieres";
import { Icone, type NomIcone } from "@/components/ui";
import { cn } from "@/lib/cn";

export const ICONE_MATIERE: Readonly<Record<TypeMatiere, NomIcone>> = {
  "question-recue": "loupe",
  "avis-will": "megaphone",
  observation: "oeil",
  "parole-dirigeant": "citation",
  "cas-client": "personnages",
  "idee-recue": "idee",
  "anecdote-will": "personne",
  limite: "balance",
  etude: "livre",
  actualite: "tendance",
  demonstration: "ecran-partage",
};

/** Pastille de type (lecture). */
export function PastilleType({ type, className }: { type: TypeMatiere; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-texte-doux", className)}>
      <Icone nom={ICONE_MATIERE[type]} size={12} />
      {LIBELLES_MATIERE[type].court}
    </span>
  );
}

/** Choix du type d'un toucher (rangée qui défile ; le type proposé est déjà choisi). */
export function ChoixType({ valeur, onChange, compact, className = "-mx-5 px-5" }: { valeur: TypeMatiere; onChange: (t: TypeMatiere) => void; compact?: boolean; className?: string }) {
  return (
    <div role="radiogroup" aria-label="Type" className={cn("sans-barre flex gap-2 overflow-x-auto pb-1", className)}>
      {TYPES_MATIERE.map((t) => {
        const actif = t === valeur;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(t)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors",
              compact ? "min-h-10 px-3 text-[13px]" : "min-h-11 px-3.5 text-sm",
              actif ? "border-orange bg-orange text-sur-orange" : "border-trait bg-surface-1 text-texte hover:bg-surface-2",
            )}
          >
            <Icone nom={ICONE_MATIERE[t]} size={15} />
            {LIBELLES_MATIERE[t].court}
          </button>
        );
      })}
    </div>
  );
}

/** Pastilles « Masquer ce nom ? » (C59) : un toucher par nom. */
export function NomsAMasquer({ noms, masques, onChange }: { noms: string[]; masques: string[]; onChange: (n: string[]) => void }) {
  if (!noms.length) return null;
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-texte-faible">
        <Icone nom="oeil-barre" size={13} />
        Masquer ces noms ?
      </p>
      <div className="flex flex-wrap gap-2">
        {noms.map((n) => {
          const actif = masques.includes(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={actif}
              onClick={() => onChange(actif ? masques.filter((x) => x !== n) : [...masques, n])}
              className={cn(
                "flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold",
                actif ? "border-sauge/40 bg-sauge-doux text-sauge" : "border-trait bg-surface-1 text-texte",
              )}
            >
              {actif && <Icone nom="coche" size={14} />}
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Texte cité tel quel, entre guillemets sauf s'il en porte déjà (jamais « « … » »). */
export function cite(texte: string): string {
  return /^[«“"]/.test(texte.trim()) ? texte : `« ${texte} »`;
}
