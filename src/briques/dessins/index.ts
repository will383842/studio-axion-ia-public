import { droitValide } from "../droits/lecture";
import { DESSINS } from "./registre/index";
import type { EntreeDessin } from "./types";

export * from "./types";
export * from "./traces";
export { DESSINS } from "./registre/index";

export function trouverDessin(dessinId: string): EntreeDessin | undefined {
  return DESSINS.find((d) => d.id === dessinId);
}

/** Règle V11 : le dessin existe dans la banque ET son droit est valide (non périmé) à la date donnée. */
export function dessinValide(dessinId: string, aLaDate: Date | string = new Date()): boolean {
  const d = trouverDessin(dessinId);
  return !!d && droitValide(d.droitId, aLaDate);
}
