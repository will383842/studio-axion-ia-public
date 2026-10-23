"use client";

import { motion } from "motion/react";
import { Bouton, Icone } from "@/components/ui";

/** Carte de blocage : personne réelle sans accord complet (B.4-6). */
export function BlocageAccord({ nom, onOuvrirAccord, className }: { nom: string; onOuvrirAccord: () => void; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={className}>
      <div className="relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-carte border border-ambre/40 bg-ambre-doux p-5 text-center sm:flex-row sm:text-left">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-ambre text-fond">
          <Icone nom="cadenas" size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-texte">Bloqué sans l&apos;accord de {nom}</p>
          <p className="text-sm text-ambre">Case, document signé et date.</p>
        </div>
        <Bouton variante="contour" icone="bouclier" onClick={onOuvrirAccord}>
          Voir l&apos;accord
        </Bouton>
      </div>
    </motion.div>
  );
}
