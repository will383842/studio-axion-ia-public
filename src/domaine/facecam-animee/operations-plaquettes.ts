/**
 * S-15-OPERATIONS-v19c : retrouver une plaquette par son nom et la retirer (calcul pur).
 * Ne lève jamais, ne modifie jamais la liste reçue. Aucun appelant : rien n'est branché.
 */
import { nommerPlaquettes } from "./noms-plaquettes";
import type { ElementV4Plan } from "./plan";

export type RetraitPlaquette =
  | { ok: true; elements: ElementV4Plan[]; retiree: ElementV4Plan }
  | { ok: false; raison: string };

/** Retrouve une plaquette par son nom, ou null si elle n'existe pas. */
export function trouverPlaquette(
  elements: readonly ElementV4Plan[],
  uid: string,
): { index: number; element: ElementV4Plan } | null {
  const index = nommerPlaquettes(elements).findIndex((n) => n.uid === uid);
  return index < 0 ? null : { index, element: elements[index] };
}

/** Retire une plaquette ; les autres restent les mêmes objets, avec les mêmes noms. */
export function retirerPlaquette(elements: readonly ElementV4Plan[], uid: string): RetraitPlaquette {
  const avant = nommerPlaquettes(elements);
  const index = avant.findIndex((n) => n.uid === uid);
  if (index < 0) return { ok: false, raison: "Cette plaquette n'existe plus dans le plan." };
  const reste = elements.filter((_, i) => i !== index);
  const apres = nommerPlaquettes(reste).map((n) => n.uid);
  const attendus = avant.filter((_, i) => i !== index).map((n) => n.uid);
  if (apres.length !== attendus.length || apres.some((u, i) => u !== attendus[i])) {
    return { ok: false, raison: "Deux plaquettes identiques : dites laquelle par son moment." };
  }
  return { ok: true, elements: reste, retiree: elements[index] };
}
