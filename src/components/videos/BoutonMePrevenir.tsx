"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useTransition } from "react";
import { mePrevenirAction } from "@/app/(studio)/formats/[id]/actions";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";

/** « Me prévenir » d'un format bientôt disponible. Devient « Je serai prévenu » une fois noté. */
export function BoutonMePrevenir({ formatId, dejaNote }: { formatId: string; dejaNote: boolean }) {
  const [note, setNote] = useState(dejaNote);
  const [enCours, demarrer] = useTransition();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={note ? "ok" : "attente"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="w-full lg:w-auto">
        <Bouton
          taille="lg"
          pleineLargeur
          icone={note ? "coche" : "cloche"}
          variante={note ? "secondaire" : "principal"}
          disabled={note}
          chargement={enCours}
          onClick={() =>
            demarrer(async () => {
              const r = await mePrevenirAction(formatId);
              if (!r.ok) {
                notifier.erreur(r.message);
                return;
              }
              setNote(true);
              notifier.succes("C'est noté", "Je vous préviens dès que ce format est prêt.");
            })
          }
        >
          {note ? "Je serai prévenu" : "Me prévenir"}
        </Bouton>
      </motion.div>
    </AnimatePresence>
  );
}
