"use client";

import { useEffect } from "react";

/**
 * E2E-2 parcours n° 25 : une saisie en cours (sujet de l'atelier, dictée « Plusieurs d'un coup ») n'est plus perdue
 * sans prévenir au rechargement ou à la fermeture de l'onglet : le navigateur demande confirmation (comme le kit).
 */
export function useRetenirDepart(actif: boolean): void {
  useEffect(() => {
    if (!actif) return;
    const retenir = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", retenir);
    return () => window.removeEventListener("beforeunload", retenir);
  }, [actif]);
}
