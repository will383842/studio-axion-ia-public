"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";
import { notifier } from "./Toast";

/** Copie un texte en un geste (texte de publication, lien privé). */
export function BoutonCopier({
  texte,
  libelle = "Copier",
  libelleCopie = "Copié",
  compact,
  className,
}: {
  texte: string;
  libelle?: string;
  libelleCopie?: string;
  /** Icône seule (44 px). */
  compact?: boolean;
  className?: string;
}) {
  const [copie, setCopie] = useState(false);
  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      setTimeout(() => setCopie(false), 1600);
    } catch {
      notifier.erreur("Impossible de copier", "Sélectionnez le texte à la main.");
    }
  }
  return (
    <button
      type="button"
      onClick={copier}
      aria-label={compact ? libelle : undefined}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border font-semibold transition-colors duration-200",
        compact ? "size-11" : "px-4 text-sm",
        copie ? "border-sauge/40 bg-sauge-doux text-sauge" : "border-trait bg-surface-2 text-texte hover:bg-surface-3",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={copie ? "ok" : "copier"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }}>
          <Icone nom={copie ? "coche" : "copier"} size={18} />
        </motion.span>
      </AnimatePresence>
      {!compact && <span aria-live="polite">{copie ? libelleCopie : libelle}</span>}
    </button>
  );
}
