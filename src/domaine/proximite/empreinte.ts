/**
 * Empreinte de proximité d'une publication (PURE). Façade : réutilise `racinesIdee` (mots pleins, sans accents ni pluriel)
 * du classement ; aucun appel réel. Accepte `signatureUsine` (posée par l'usine sur le créneau).
 */
import { racinesIdee } from "@/domaine/classement-generateur";

export interface EntreeEmpreinte {
  sujet: string;
  signatureUsine?: string;
}

export interface Empreinte {
  /** Clé stable : racines triées, jointes par un espace (vide si aucun axe). */
  cle: string;
  /** Axes de comparaison : racines du sujet, triées. */
  axes: string[];
  signature?: string;
}

export function empreinte(e: EntreeEmpreinte): Empreinte {
  const axes = [...racinesIdee(e.sujet)].sort();
  const signature = e.signatureUsine?.trim() || undefined;
  return { cle: axes.join(" "), axes, ...(signature ? { signature } : {}) };
}
