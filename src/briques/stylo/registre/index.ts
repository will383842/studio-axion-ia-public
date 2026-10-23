/**
 * Registre des stylos : un fichier par stylo + cet index. Changer de stylo = changer un identifiant
 * (« crayon/1 » → « main-crayon/1 »). Un identifiant inconnu est REFUSÉ (jamais remplacé en silence).
 */
import type { Stylo } from "../types";
import { CRAYON_1 } from "./crayon-1";

export const STYLOS: Readonly<Record<string, Stylo>> = Object.freeze({
  "crayon/1": CRAYON_1,
});

export const STYLO_PAR_DEFAUT = "crayon/1";

export const identifiantStylo = (s: Pick<Stylo, "id" | "version">): string => `${s.id}/${s.version}`;

export function listerStylos(): string[] {
  return Object.keys(STYLOS);
}

/** Le stylo demandé ; lève une erreur claire s'il n'existe pas. */
export function stylo(identifiant: string): Stylo {
  const s = Object.prototype.hasOwnProperty.call(STYLOS, identifiant) ? STYLOS[identifiant] : undefined;
  if (!s) throw new Error(`Stylo inconnu : « ${identifiant} » (connus : ${listerStylos().join(", ")}).`);
  return s;
}
