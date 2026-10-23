"use client";

import { AnimatePresence, motion } from "motion/react";
import { useSyncExternalStore } from "react";
import { Icone } from "@/components/ui/Icone";

function abonner(rappel: () => void) {
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  return () => {
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
  };
}

/** Bandeau « hors ligne » (B.8 transverses). */
export function BandeauHorsLigne() {
  const enLigne = useSyncExternalStore(
    abonner,
    () => navigator.onLine,
    () => true,
  );
  return (
    <AnimatePresence>
      {!enLigne && (
        // Pastille sur une seule ligne, posée SOUS l'en-tête (h-16 + zone sûre, comme la coquille) : elle ne recouvre
        // ni le logo, ni la recherche, ni la cloche. Texte court sur mobile, phrase complète à partir de sm:.
        <motion.div
          role="status"
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top)+8px)] z-[60] flex justify-center px-4"
        >
          <span className="inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full bg-ambre px-4 py-1.5 text-sm font-semibold text-fond shadow-carte">
            <Icone nom="hors-ligne" size={16} className="shrink-0" />
            <span className="sm:hidden">Hors ligne</span>
            <span className="hidden truncate sm:inline">Vous êtes hors ligne. Vos changements attendront le retour du réseau.</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
