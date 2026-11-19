/**
 * S-13-v19b · Ce que chaque échec noté est devenu : reparti seul, repris, encore en cours, resté à Williams.
 * Calcul pur (aucun dépôt, aucune horloge). Pas encore branché : aucun écran ne l'appelle.
 */
import type { LigneEchec } from "./journal-echecs";
import { CODES_PANNE_RENDUE } from "./pannes-rendues";
import type { Travail } from "./types";

export type IssueEchec = "reparti-seul" | "repris" | "en-cours" | "reste-a-williams";

export type VueTravailIssue = Pick<Travail, "statut" | "tentatives" | "reprise">;

/** Issue d'un échec noté, d'après l'état actuel du travail. */
export function issueDe(ligne: LigneEchec, travail: VueTravailIssue | undefined): IssueEchec {
  if (!travail) return "reste-a-williams";
  switch (travail.statut) {
    case "en_file":
    case "en_cours":
      return "en-cours";
    case "termine":
      return (CODES_PANNE_RENDUE as readonly string[]).includes(ligne.code) ? "reparti-seul" : "repris";
    default:
      return "reste-a-williams";
  }
}

/** La ligne `b` est-elle plus récente que `a` ? (date, puis numéro d'essai ; une date illisible vaut 0) */
function plusRecente(a: LigneEchec, b: LigneEchec): boolean {
  const ta = new Date(a.date).getTime() || 0;
  const tb = new Date(b.date).getTime() || 0;
  return tb !== ta ? tb > ta : b.essai > a.essai;
}

/** Compte les issues : chaque travail une seule fois, sur sa ligne la plus récente ; les attentes de validation sont écartées. */
export function compterIssues(lignes: readonly LigneEchec[], travaux: ReadonlyMap<string, VueTravailIssue>): Record<IssueEchec, number> {
  const compte: Record<IssueEchec, number> = { "reparti-seul": 0, repris: 0, "en-cours": 0, "reste-a-williams": 0 };
  const derniere = new Map<string, LigneEchec>();
  for (const l of lignes) {
    if (l.famille === "attente-validation") continue;
    const vue = derniere.get(l.travailId);
    if (!vue || plusRecente(vue, l)) derniere.set(l.travailId, l);
  }
  for (const [id, l] of derniere) compte[issueDe(l, travaux.get(id))] += 1;
  return compte;
}
