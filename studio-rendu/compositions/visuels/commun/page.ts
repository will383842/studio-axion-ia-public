import { TYPES_PAGE } from "../../../../src/briques/visuels/registre-pages";
import type { PageSpec, SpecVisuel } from "./types";

/** La page demandée du spec ; refuse un index hors des pages ou un type de page inconnu (jamais de page vide). */
export function pageDuSpec(spec: SpecVisuel, index: number): PageSpec {
  if (!Number.isInteger(index) || index < 0 || index >= spec.pages.length) {
    throw new Error(`VisuelPage : la page ${index} n'existe pas (${spec.pages.length} page(s) dans le spec)`);
  }
  const page = spec.pages[index];
  if (!(TYPES_PAGE as readonly string[]).includes(page.type)) throw new Error(`VisuelPage : type de page inconnu « ${(page as { type: string }).type} »`);
  return page;
}
