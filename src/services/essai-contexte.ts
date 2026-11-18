/**
 * Contexte d'exécution de l'essai borné : l'identifiant du créneau d'essai, rien d'autre. Module feuille (aucun import du Studio) pour que le
 * fournisseur de publication sache sans coût s'il est dans un essai. Ce contexte n'ouvre aucune porte : chaque porte relit `essaiCouvre`.
 */
import { AsyncLocalStorage } from "node:async_hooks";

const contexte = new AsyncLocalStorage<string>();

/** Exécute `f` avec le créneau d'essai en contexte (hérité par toute tâche détachée lancée dedans : d'où la relecture à chaque porte). */
export function dansEssai<T>(creneauId: string, f: () => Promise<T>): Promise<T> {
  return contexte.run(creneauId, f);
}

export const essaiEnCours = (): string | undefined => contexte.getStore();
