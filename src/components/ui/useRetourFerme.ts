"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { gardeRetour } from "@/lib/retour-ferme";

/**
 * Le retour du navigateur (geste « retour » du téléphone) ferme d'abord la feuille ou la fenêtre ouverte, au lieu de
 * quitter la page (voir `lib/retour-ferme.ts`). À appeler dans chaque composant qui ouvre une feuille.
 */
export function useRetourFerme(ouverte: boolean, fermer: () => void) {
  const id = useId();
  const chemin = usePathname();
  const fermerRef = useRef(fermer);
  useEffect(() => {
    fermerRef.current = fermer;
  });

  useEffect(() => {
    if (!ouverte) return;
    const garde = gardeRetour();
    garde?.ouvrir(id, () => fermerRef.current());
    return () => garde?.fermeParEcran(id);
  }, [ouverte, id]);

  useEffect(() => {
    gardeRetour()?.surNavigation();
  }, [chemin]);
}
