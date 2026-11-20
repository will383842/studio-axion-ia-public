/**
 * S-15-v19b : un nom stable par plaquette du plan v4 (calcul pur).
 * Le nom vient du contenu de la plaquette (jamais de son rang) : retirer une plaquette
 * ne change pas le nom des autres. Rien n'est enregistré, le schéma du plan est inchangé.
 */
import { completerUids } from "../../briques/animation-element";
import type { ElementV4Plan } from "./plan";

/** Texte de départ du nom : type, début, mots, nombre, indice du mot. Aucun rang. */
export function graineDePlaquette(e: ElementV4Plan): string {
  return `${e.id}|${e.debut}|${(e.mots ?? []).join(" ")}|${e.nombre ?? ""}|${e.motIndex ?? ""}`;
}

/** Donne un nom à chaque plaquette. Les plaquettes reçues ne sont ni modifiées ni recopiées avec un champ neuf. */
export function nommerPlaquettes(elements: readonly ElementV4Plan[]): Array<{ uid: string; element: ElementV4Plan }> {
  const enveloppes: Array<{ element: ElementV4Plan; uid?: string }> = elements.map((element) => ({ element }));
  return completerUids(enveloppes, (e) => graineDePlaquette(e.element));
}

/** Nom de la plaquette au rang donné, ou null si le rang n'existe pas. */
export function uidDePlaquette(elements: readonly ElementV4Plan[], index: number): string | null {
  return nommerPlaquettes(elements)[index]?.uid ?? null;
}
