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

/* --- Sélection des parcours d'un OK (pure) ----------------------------------------------------------------------------- */
/**
 * Parmi les parcours en attente (déjà triés : les plus anciens d'abord), ceux que CE message sert encore : ceux qu'il a déjà servis (`idMessageOk`)
 * sont écartés ET comptent dans le maximum par message (un rejeu après un débit ne sert jamais plus de `max` parcours pour un seul OK).
 */
export function parcoursAServir<T extends { cle: string }>(
  entrees: readonly { cle: string; etat: { idMessageOk?: string } }[],
  enAttente: readonly T[],
  idMessage: string,
  max: number,
): T[] {
  const servi = (cle: string): boolean => entrees.find((y) => y.cle === cle)?.etat.idMessageOk === idMessage;
  const dejaServis = entrees.filter((x) => x.etat.idMessageOk === idMessage).length;
  return enAttente.filter((x) => !servi(x.cle)).slice(0, Math.max(0, max - dejaServis));
}

/* --- Plafond par personne ---------------------------------------------------------------------------------------------- */
/** Messages Instagram au plus par personne et par 24 h : TOUS ceux envoyés à la personne (suivre le compte, « pas encore », lien, merci, accusé, adresse refusée, M2). */
export const PLAFOND_IG_PERSONNE = 3;
const ETATS_ENVOI_INCERTAIN: readonly string[] = ["m1_en_vol", "m1_a_verifier", "ig_envoi_en_vol", "ig_a_verifier"];
const FENETRE_PLAFOND_IG_MS = 24 * 3600_000;
export interface LimitePersonneIg {
  nombre: number;
  atteint: boolean;
  /** Date (ms) à partir de laquelle un envoi redevient possible ; `null` si le plafond n'est pas atteint. */
  repriseMs: number | null;
}
type ParcoursPlafond = {
  etat?: string;
  reseau?: string | null;
  creeLe?: string | null;
  essaiEnvoiLe?: string | null;
  m1Le?: string | null;
  pasEncoreLe?: string | null;
  lienIgLe?: string | null;
  m2Le?: string | null;
  adresseRefuseeLe?: string | null;
  accuseLe?: string | null;
  merciEssaiLe?: string | null;
  merciLe?: string | null;
};
/**
 * Compte, sur TOUS les parcours Instagram du dossier, chaque message de moins de 24 h : `m1Le`, `pasEncoreLe`, `lienIgLe`, `m2Le`, `adresseRefuseeLe`,
 * `accuseLe`, le merci (`merciEssaiLe`, à défaut `merciLe`) et tout essai d'issue inconnue (`essaiEnvoiLe`, QUEL QUE SOIT l'état, sauf pour un parcours qui porte
 * déjà une date de succès hors des états d'issue incertaine). Une date présente mais illisible compte comme un envoi à l'instant même (échec fermé). Atteint à `PLAFOND_IG_PERSONNE`.
 * Un parcours d'un autre réseau n'est jamais compté.
 */
export function limitePersonneIg(parcours: readonly ParcoursPlafond[], maintenantMs: number): LimitePersonneIg {
  const dates: number[] = [];
  const ajouter = (v: unknown): number | null => {
    if (typeof v !== "string") return null;
    const t = Date.parse(v);
    const quand = Number.isNaN(t) ? maintenantMs : t;
    if (maintenantMs - quand < FENETRE_PLAFOND_IG_MS) dates.push(quand);
    return t;
  };
  for (const p of parcours) {
    if (typeof p.reseau === "string" && p.reseau !== "instagram") continue;
    const succes = [p.m1Le, p.pasEncoreLe, p.lienIgLe].map((v) => (typeof v === "string" ? Date.parse(v) : NaN));
    for (const v of [p.m1Le, p.pasEncoreLe, p.lienIgLe, p.m2Le, p.adresseRefuseeLe, p.accuseLe]) ajouter(v);
    ajouter(typeof p.merciEssaiLe === "string" ? p.merciEssaiLe : p.merciLe);
    // Essai d'issue inconnue ou interrompu (le message est peut-être parti sans date de succès) : compté à la date de l'essai (échec fermé), dans tous les états
    // (après `m1_a_verifier`, l'état peut avoir changé). Seul un parcours qui porte déjà une date de succès hors des états d'issue incertaine ne compte pas deux fois.
    const incertain = p.etat !== undefined && ETATS_ENVOI_INCERTAIN.includes(p.etat);
    const avecSucces = succes.some((t) => !Number.isNaN(t));
    if (typeof p.essaiEnvoiLe === "string") {
      if (incertain || !avecSucces) ajouter(p.essaiEnvoiLe);
    } else if (incertain) {
      // Ancien enregistrement sans date d'essai : la création du parcours.
      const t = Date.parse(p.creeLe ?? "");
      const quand = Number.isNaN(t) ? maintenantMs : t;
      if (maintenantMs - quand < FENETRE_PLAFOND_IG_MS) dates.push(quand);
    }
  }
  dates.sort((a, b) => a - b);
  const nombre = dates.length;
  if (nombre < PLAFOND_IG_PERSONNE) return { nombre, atteint: false, repriseMs: null };
  return { nombre, atteint: true, repriseMs: dates[nombre - PLAFOND_IG_PERSONNE] + FENETRE_PLAFOND_IG_MS };
}
