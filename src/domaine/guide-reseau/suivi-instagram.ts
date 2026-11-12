/**
 * Décision pure « Instagram : suivre le compte puis répondre OK ». Aucun import (ni port, ni service) : aucune lecture,
 * aucun envoi, aucune écriture. Le doute sur une opposition l'emporte toujours ; hors fenêtre, silence.
 */

export const ETATS_IG = ["ig_attente_ok", "ig_pas_encore", "ig_envoi_en_vol", "ig_a_verifier"] as const;

export type EtatSuivi = "suit" | "ne_suit_pas" | "inconnu" | "panne_passagere" | "panne_definitive";
export type IssueSuivi = "deja_suivi" | "gagne" | "sans_suivre" | "inconnu";

/** Attentes avant chaque nouvel essai de lecture du suivi (1er puis 2e réessai). */
export const ATTENTES_SUIVI_MS = [60_000, 300_000] as const;
/** Nombre maximal de parcours auxquels un même message « OK » peut répondre. */
export const REPONSES_IG_MAX_PAR_MESSAGE = 3;

export interface EntreeDecisionIg {
  etat: "ig_attente_ok" | "ig_pas_encore";
  suivi: EtatSuivi;
  essaisSuivi: number;
  pasEncoreDejaEnvoye: boolean;
  douteOpposition: boolean;
  maintenantMs: number;
  finFenetreMs: number | null;
}

export type DecisionIg =
  | { action: "lien"; issue: IssueSuivi }
  | { action: "pas_encore" }
  | { action: "reessayer_suivi"; apresMs: number }
  | { action: "silence"; raison: "doute" | "hors_fenetre" };

export function deciderReponseInstagram(e: EntreeDecisionIg): DecisionIg {
  if (e.douteOpposition) return { action: "silence", raison: "doute" };
  if (e.finFenetreMs === null || e.maintenantMs >= e.finFenetreMs) return { action: "silence", raison: "hors_fenetre" };
  switch (e.suivi) {
    case "suit":
      return { action: "lien", issue: e.pasEncoreDejaEnvoye ? "gagne" : "deja_suivi" };
    case "ne_suit_pas":
      return e.etat === "ig_attente_ok" && !e.pasEncoreDejaEnvoye
        ? { action: "pas_encore" }
        : { action: "lien", issue: "sans_suivre" };
    case "inconnu":
      return { action: "lien", issue: "inconnu" };
    case "panne_passagere": {
      if (e.essaisSuivi < ATTENTES_SUIVI_MS.length) {
        const apresMs = ATTENTES_SUIVI_MS[e.essaisSuivi];
        if (e.maintenantMs + apresMs < e.finFenetreMs) return { action: "reessayer_suivi", apresMs };
      }
      return { action: "lien", issue: "inconnu" };
    }
    default:
      return { action: "lien", issue: "inconnu" };
  }
}

/** Traduit la lecture du port (forme vérifiée structurellement, sans import). Tout ce qui n'est pas reconnu => panne définitive. */
export function suiviDepuisPort(lu: unknown): EtatSuivi {
  try {
    if (typeof lu !== "object" || lu === null || Array.isArray(lu)) return "panne_definitive";
    const o = lu as { statut?: unknown; definitive?: unknown };
    if (o.statut === "suit") return "suit";
    if (o.statut === "ne_suit_pas") return "ne_suit_pas";
    if (o.statut === "inconnu") return "inconnu";
    if (o.statut === "panne" && o.definitive === false) return "panne_passagere";
    return "panne_definitive";
  } catch {
    return "panne_definitive";
  }
}

/** Parcours auxquels répond un « OK » : états d'attente, même compte, plus anciens d'abord (date illisible en dernier), au plus `max`. */
export function choisirParcoursPourOk<T extends { cle: string; etat: string; creeLe: string; idCompte: string }>(
  liste: readonly T[],
  idCompte: string,
  max: number = REPONSES_IG_MAX_PAR_MESSAGE,
): T[] {
  const date = (s: string): number => {
    const t = Date.parse(s);
    return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
  };
  return liste
    .filter((p) => (p.etat === "ig_attente_ok" || p.etat === "ig_pas_encore") && p.idCompte === idCompte)
    .map((p, i) => ({ p, i, t: date(p.creeLe) }))
    .sort((a, b) => (a.t === b.t ? a.i - b.i : a.t < b.t ? -1 : 1))
    .slice(0, Math.max(0, max))
    .map((x) => x.p);
}
