"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { ajouterIdeeAction } from "../actions";

/** Champ « Une idée ? » de l'accueil : ajout en une ligne, puis un lien vers le carnet. */
export function IdeeRapide() {
  const id = useId();
  const [texte, setTexte] = useState("");
  const [notee, setNotee] = useState(false);
  const [enCours, demarrer] = useTransition();
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!texte.trim()) return;
          demarrer(async () => {
            const r = await ajouterIdeeAction(texte);
            if (r.ok) {
              setTexte("");
              setNotee(true);
              notifier.succes("Idée notée");
            } else notifier.erreur(r.message);
          });
        }}
        className="flex min-h-14 items-center gap-2 rounded-full border border-trait bg-surface-1 pl-5 pr-1.5 transition-colors focus-within:border-orange"
      >
        <Icone nom="idee" size={20} className="shrink-0 text-ambre" />
        <label htmlFor={id} className="sr-only">
          Une idée ?
        </label>
        <input
          id={id}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value);
            setNotee(false);
          }}
          placeholder="Une idée ?"
          maxLength={200}
          enterKeyHint="send"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-texte outline-none placeholder:text-texte-faible"
        />
        <button
          type="submit"
          disabled={!texte.trim() || enCours}
          aria-label="Noter l'idée"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-texte transition-colors hover:bg-orange hover:text-sur-orange disabled:opacity-40"
        >
          <Icone nom={enCours ? "chargement" : "fleche-droite"} size={18} className={enCours ? "animate-spin" : ""} />
        </button>
      </form>
      <AnimatePresence>
        {notee && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Link href="/ecrire?onglet=idees" className="mt-1 inline-flex min-h-11 items-center gap-1.5 px-5 text-sm font-semibold text-sauge">
              <Icone nom="valide" size={15} />
              Rangée dans Écrire
              <Icone nom="chevron-droite" size={14} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
