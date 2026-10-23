import { DROITS } from "./registre/index";
import type { EntreeDroit } from "./types";

/** Cherche une entrée par identifiant (undefined si absente). */
export function trouverDroit(id: string): EntreeDroit | undefined {
  return DROITS.find((d) => d.id === id);
}

function enJour(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}

/** Vrai si la pièce a une entrée et qu'elle n'est pas périmée à la date donnée (aujourd'hui par défaut). */
export function droitValide(id: string, aLaDate: Date | string = new Date()): boolean {
  const e = trouverDroit(id);
  if (!e) return false;
  return !e.perimeLe || enJour(aLaDate) < e.perimeLe;
}
