/** Registre des gabarits (T-EXT-22 ; G-Flux : T-EXT-50). */
import type { IdGabarit } from "../chef-de-projet";
import { G_DECISION } from "./g-decision";
import { G_FLUX } from "./g-flux";
import { G_JOURNEE } from "./g-journee";
import { G_REPONSE } from "./g-reponse";
import type { Gabarit } from "./types";

export const GABARITS: Readonly<Partial<Record<IdGabarit, Gabarit>>> = Object.freeze({
  "G-Journee": G_JOURNEE,
  "G-Decision": G_DECISION,
  "G-Reponse": G_REPONSE,
  "G-Flux": G_FLUX,
});

export function gabaritParId(id: IdGabarit): Gabarit | null {
  return Object.prototype.hasOwnProperty.call(GABARITS, id) ? (GABARITS[id] ?? null) : null;
}
