"use client";

import { useEffect, useRef } from "react";
import { inscrireChamp, reprendreSaisie, type SaisieGardee } from "@/lib/mise-a-jour-studio";

/** sessionStorage, ou rien (navigation privée stricte, rendu serveur) : le filet se tait sans casser la page. */
export function stockageSession(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Reprend (une fois) le texte gardé avant le rechargement d'une mise à jour du studio. */
export function reprendreSaisieGardee(cle: string): SaisieGardee | null {
  const s = stockageSession();
  if (!s) return null;
  try {
    return reprendreSaisie(s, cle, Date.now());
  } catch {
    return null;
  }
}

/** Clé complète d'une saisie : la page (chemin) + la clé du champ. */
export function cleSaisie(cle: string): string {
  return `${window.location.pathname}|${cle}`;
}

/**
 * Inscrit un champ de texte au filet « mise à jour du studio » (src/lib/mise-a-jour-studio.ts) : son texte est gardé
 * si la page se recharge, puis remis au montage suivant par `remettre` (qui décide : champ vide seulement, etc.).
 * `cle` nulle : champ non inscrit. La page (chemin) fait partie de la clé (`cleSaisie`).
 */
export function useSaisieGardee(cle: string | null, lire: () => string, remettre: (texte: string, saisie: SaisieGardee) => void) {
  const lecture = useRef(lire);
  const remise = useRef(remettre);
  useEffect(() => {
    lecture.current = lire;
    remise.current = remettre;
  });
  useEffect(() => {
    if (!cle) return;
    const complete = cleSaisie(cle);
    const reprise = reprendreSaisieGardee(complete);
    if (reprise) remise.current(reprise.texte, reprise);
    return inscrireChamp(complete, () => lecture.current());
  }, [cle]);
}
