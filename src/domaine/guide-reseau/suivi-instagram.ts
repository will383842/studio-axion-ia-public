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
  if (
    e.finFenetreMs === null ||
    !Number.isFinite(e.maintenantMs) ||
    !Number.isFinite(e.finFenetreMs) ||
    e.maintenantMs >= e.finFenetreMs
  )
    return { action: "silence", raison: "hors_fenetre" };
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

/* --- « OK » de la personne : liste FERMÉE ---------------------------------------------------------------------------- */
const OK_RECONNUS: ReadonlySet<string> = new Set(["ok", "okay", "oki", "oui", "c est fait", "fait", "voila", "done", "👍", "✅", "ok c est fait", "oui c est fait"]);
/** Minuscules, sans accents, apostrophes en espaces, sans ponctuation finale, espaces réduits. */
function normaliserOk(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’‘`´]/g, " ")
    .replace(/[\s.!,;:…]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}
/** Vrai SEULEMENT si le message ENTIER est l'un des OK de la liste fermée (après normalisation). Tout autre texte : faux. */
export function estOkInstagram(texte: unknown): boolean {
  return typeof texte === "string" && OK_RECONNUS.has(normaliserOk(texte));
}

/* --- Plafond par personne ---------------------------------------------------------------------------------------------- */
/** Messages Instagram de ce parcours au plus par personne et par 24 h (suivre le compte, « pas encore », lien). */
export const PLAFOND_IG_PERSONNE = 3;
const ETATS_ENVOI_INCERTAIN: readonly string[] = ["m1_en_vol", "m1_a_verifier", "ig_envoi_en_vol", "ig_a_verifier"];
const FENETRE_PLAFOND_IG_MS = 24 * 3600_000;
export interface LimitePersonneIg {
  nombre: number;
  atteint: boolean;
  /** Date (ms) à partir de laquelle un envoi redevient possible ; `null` si le plafond n'est pas atteint. */
  repriseMs: number | null;
}
/**
 * Compte, sur TOUS les parcours du dossier, `m1Le`, `pasEncoreLe` et `lienIgLe` de moins de 24 h. Une date présente mais illisible
 * compte comme un envoi à l'instant même (échec fermé). Atteint à `PLAFOND_IG_PERSONNE` ou plus.
 */
export function limitePersonneIg(
  parcours: readonly { etat?: string; creeLe?: string | null; essaiEnvoiLe?: string | null; m1Le?: string | null; pasEncoreLe?: string | null; lienIgLe?: string | null }[],
  maintenantMs: number,
): LimitePersonneIg {
  const dates: number[] = [];
  for (const p of parcours) {
    // Issue inconnue ou envoi interrompu (le message est peut-être parti, aucune date de succès) : compté à la date de l'essai (échec fermé).
    if (p.etat !== undefined && ETATS_ENVOI_INCERTAIN.includes(p.etat)) {
      const t = Date.parse(p.essaiEnvoiLe ?? p.creeLe ?? "");
      const quand = Number.isNaN(t) ? maintenantMs : t;
      if (maintenantMs - quand < FENETRE_PLAFOND_IG_MS) dates.push(quand);
    }
    for (const v of [p.m1Le, p.pasEncoreLe, p.lienIgLe]) {
      if (typeof v !== "string") continue;
      const t = Date.parse(v);
      const quand = Number.isNaN(t) ? maintenantMs : t;
      if (maintenantMs - quand < FENETRE_PLAFOND_IG_MS) dates.push(quand);
    }
  }
  dates.sort((a, b) => a - b);
  const nombre = dates.length;
  if (nombre < PLAFOND_IG_PERSONNE) return { nombre, atteint: false, repriseMs: null };
  return { nombre, atteint: true, repriseMs: dates[nombre - PLAFOND_IG_PERSONNE] + FENETRE_PLAFOND_IG_MS };
}
