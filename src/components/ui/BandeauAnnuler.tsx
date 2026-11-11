"use client";

import { useEffect, useRef } from "react";
import { Bouton } from "./Bouton";

/**
 * Bandeau fixé en bas d'écran : message + bouton « Annuler », disparaît seul après `dureeMs` (défaut 10 000) en appelant `onFin`.
 * Props : { message: string; onAnnuler: () => void; onFin?: () => void; dureeMs?: number }. À monter seulement quand il y a quelque chose à annuler.
 */
export function BandeauAnnuler({ message, onAnnuler, onFin, dureeMs = 10_000 }: { message: string; onAnnuler: () => void; onFin?: () => void; dureeMs?: number }) {
  const fin = useRef(onFin);
  fin.current = onFin;
  useEffect(() => {
    const t = setTimeout(() => fin.current?.(), dureeMs);
    return () => clearTimeout(t);
  }, [message, dureeMs]);
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(var(--hauteur-onglets-bas,0px)+env(safe-area-inset-bottom)+12px)] z-50 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-carte border border-trait-fort bg-surface-1 p-3 pl-4 shadow-carte lg:bottom-6"
    >
      <span className="min-w-0 text-[15px] text-texte">{message}</span>
      <Bouton variante="secondaire" onClick={onAnnuler}>
        Annuler
      </Bouton>
    </div>
  );
}
