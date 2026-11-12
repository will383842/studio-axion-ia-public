/**
 * Adaptateur d'empreinte pour la vérification d'espacement (PUR). Réutilise l'empreinte de proximité (L3-11)
 * pour le sujet ; ajoute la clé « pilier + cible » que la règle de répétition compare.
 */
import { empreinte, type Empreinte } from "@/domaine/proximite/empreinte";

export interface EntreeCadence {
  pilier: string;
  cible: string;
  sujet?: string;
  signatureUsine?: string;
}

function norme(t: string): string {
  return t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Clé stable « pilier|cible », sans accents ni casse. */
export function cleCadence(e: Pick<EntreeCadence, "pilier" | "cible">): string {
  return `${norme(e.pilier)}|${norme(e.cible)}`;
}

/** Empreinte du sujet (vide si aucun sujet donné). */
export function empreinteSujet(e: EntreeCadence): Empreinte {
  return empreinte({ sujet: e.sujet ?? "", signatureUsine: e.signatureUsine });
}
