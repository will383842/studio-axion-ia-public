import React from "react";
/**
 * Contexte de la variété d'une scène « Image → vidéo » : la recette, le format, les données du bloc et, pour une toile,
 * la scène calculée. Sans variété (`variete` absent), `useVariete()` rend `null` et chaque composant garde son rendu
 * de référence. Aucun JSX ni calcul au niveau module.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AxeVariete, FormatIV, RecetteVarieteIV, VarieteBlocIV } from "../../../../src/briques/schema-motion/variete";

export interface VarieteScene {
  recette: RecetteVarieteIV;
  format: FormatIV;
  donnees: Partial<Record<AxeVariete, unknown>>;
  /** Scène calculée d'une toile (`calculerScene`), pour les calques qui suivent ses nœuds. */
  scene?: unknown;
  /** Fenêtres des vues d'ensemble de la scène (secondes depuis son début) : le calque caméra y peint le fond ivoire. */
  ensembles?: readonly { debut: number; fin: number }[];
}

const Contexte = createContext<VarieteScene | null>(null);

/** La variété de la scène en cours (`null` : rendu de référence). */
export function useVariete(): VarieteScene | null {
  return useContext(Contexte);
}

export function ContexteVariete({ variete, scene, ensembles, children }: { variete?: VarieteBlocIV; scene?: unknown; ensembles?: readonly { debut: number; fin: number }[]; children: ReactNode }) {
  const valeur = useMemo(
    () => (variete ? { recette: variete.recette, format: variete.format, donnees: variete.donnees ?? {}, ...(scene !== undefined ? { scene } : {}), ...(ensembles ? { ensembles } : {}) } : null),
    [variete, scene, ensembles],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}
