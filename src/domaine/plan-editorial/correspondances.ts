/** Correspondance entre les statuts du plan et ceux de Publication (existants, inchangés). PUR. */
import type { IdReseau, StatutPublication } from "../types";
import { RESEAUX_TAXONOMIE } from "../taxonomie-contenu";
import type { StatutPlan } from "./types";

/** Lue chez la taxonomie (L1-01), non recopiée. */
export const IDS_RESEAUX_PLAN: readonly IdReseau[] = RESEAUX_TAXONOMIE;

/** Image de chaque statut de Publication existant dans le plan. */
export const IMAGE_PUBLICATION: Readonly<Record<StatutPublication, StatutPlan>> = {
  brouillon: "propose",
  programmee: "programme",
  publiee: "publie",
  echec: "echec",
};

export function statutPlanDepuisPublication(s: StatutPublication): StatutPlan {
  return IMAGE_PUBLICATION[s];
}

/** Statut de Publication correspondant : tout ce qui n'est pas encore parti reste « brouillon ». */
export function statutPublicationDepuisPlan(s: StatutPlan): StatutPublication {
  if (s === "programme") return "programmee";
  if (s === "publie") return "publiee";
  if (s === "echec") return "echec";
  return "brouillon";
}
