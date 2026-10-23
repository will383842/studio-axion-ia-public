"use client";

import { useEffect } from "react";
import { notifier } from "@/components/ui/Toast";
import { stockageSession } from "@/hooks/useSaisieGardee";
import { MESSAGE_MISE_A_JOUR, envelopperFetch, preparerRechargement } from "@/lib/mise-a-jour-studio";

let pose = false;

/**
 * Filet « page ouverte avant une mise en ligne » (src/lib/mise-a-jour-studio.ts), posé UNE fois dans le layout racine :
 * une action serveur inconnue du nouveau studio garde les textes saisis, affiche une phrase simple et recharge la page.
 */
export function RepriseMiseAJour() {
  useEffect(() => {
    if (pose) return;
    pose = true;
    window.fetch = envelopperFetch(window.fetch.bind(window), () => {
      const s = stockageSession();
      if (!s || !preparerRechargement(s, Date.now())) return false;
      notifier.info(MESSAGE_MISE_A_JOUR);
      setTimeout(() => window.location.reload(), 1500);
      return true;
    });
  }, []);
  return null;
}
