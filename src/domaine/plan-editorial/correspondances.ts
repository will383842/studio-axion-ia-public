/** Correspondance entre les statuts du plan et ceux de Publication (existants, inchangés). PUR. */
import type { IdReseau, StatutPublication } from "../types";
import type { StatutPlan } from "./types";

export const IDS_RESEAUX_PLAN: readonly IdReseau[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube", "youtube-shorts"];

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
