/**
 * TOURNAGE (plan v5 B.6 n° 15-16, lot G4c). PUR : importable côté client.
 *
 * - Texte du téléprompteur découpé en phrases (une prise par phrase-plan, lignes séparées par « / ») et horodaté au
 *   débit du mode « je lis » (2,9 mots/s par défaut) : le défilement suit ce débit, réglable de 0,7 à 1,3.
 * - Séance : ordre de passage groupé par format (même tenue, même décor), puis par numéro de sujet ; l'état de chaque
 *   version se lit dans la liste des prises (aucune prise / dernière ratée / rangée). Rien n'est effacé : une prise
 *   ratée reste dans la liste, marquée.
 * - Enregistreur : machine d'états pure (caméra → prêt → compte à rebours → enregistrement ⇄ pause → relecture →
 *   envoi → rangée), testée sans caméra.
 */
import type { Id, ReseauDeclinaison, SessionTournage, VarianteReseau } from "./types";

/* ------------------------------------------------------------------ */
/* Texte et défilement                                                 */
/* ------------------------------------------------------------------ */

/** Pause entre deux phrases (s), comptée dans le défilement. */
export const PAUSE_PHRASE_SEC = 0.4;
export const VITESSE_MIN = 0.7;
export const VITESSE_MAX = 1.3;
/** Compte à rebours avant l'enregistrement (s). */
export const DECOMPTE_SEC = 3;

export interface PhrasePrompteur {
  numero: number;
  lignes: string[];
  mots: number;
  debutSec: number;
  dureeSec: number;
}

const compterMots = (t: string) => t.split(/\s+/).filter((m) => m && m !== "/").length;

/** « 1. Une ligne / une autre » → phrases numérotées, horodatées au débit donné (mots/s). */
export function phrasesPrompteur(prompteur: string, motsParSec: number): { phrases: PhrasePrompteur[]; dureeSec: number } {
  const debit = Math.max(0.5, motsParSec);
  const phrases: PhrasePrompteur[] = [];
  let t = 0;
  for (const brute of prompteur.split("\n")) {
    const l = brute.trim();
    if (!l) continue;
    const texte = l.replace(/^\d+\.\s*/, "");
    const mots = compterMots(texte);
    const dureeSec = mots / debit + PAUSE_PHRASE_SEC;
    phrases.push({ numero: phrases.length + 1, lignes: texte.split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean), mots, debutSec: t, dureeSec });
    t += dureeSec;
  }
  return { phrases, dureeSec: t };
}

export function bornerVitesse(v: number): number {
  return Math.round(Math.min(VITESSE_MAX, Math.max(VITESSE_MIN, v)) * 10) / 10;
}

/**
 * Où en est la lecture après `tSec` secondes de défilement, à la vitesse donnée : phrase en cours et avancement dans
 * cette phrase (0 à 1). Au-delà de la fin : dernière phrase, avancement 1, `fini`.
 */
export function positionLecture(phrases: PhrasePrompteur[], tSec: number, vitesse = 1): { index: number; avancement: number; fini: boolean } {
  if (!phrases.length) return { index: 0, avancement: 1, fini: true };
  const t = Math.max(0, tSec) * bornerVitesse(vitesse);
  for (let i = 0; i < phrases.length; i++) {
    const p = phrases[i];
    if (t < p.debutSec + p.dureeSec) return { index: i, avancement: Math.min(1, Math.max(0, (t - p.debutSec) / p.dureeSec)), fini: false };
  }
  return { index: phrases.length - 1, avancement: 1, fini: true };
}

/* ------------------------------------------------------------------ */
/* Séance                                                              */
/* ------------------------------------------------------------------ */

/** Ce que la séance sait d'une version à filmer. */
export interface VersionTournable {
  id: Id;
  code: string;
  scriptMaitreId: Id;
  numero?: number;
  titre: string;
  formatId: string;
  formatNom: string;
  reseau: ReseauDeclinaison;
  mode: "teleprompteur" | "trame";
  dureeSec: number;
}

/** Ordre de passage : un groupe par format (même tenue, même décor), dans l'ordre d'arrivée ; numéro puis code dedans. */
export function ordonnerSeance(versions: Pick<VersionTournable, "id" | "code" | "numero" | "formatId" | "formatNom">[]): { libelle: string; varianteIds: Id[] }[] {
  const groupes: { formatId: string; libelle: string; versions: typeof versions }[] = [];
  for (const v of versions) {
    let g = groupes.find((x) => x.formatId === v.formatId);
    if (!g) groupes.push((g = { formatId: v.formatId, libelle: v.formatNom, versions: [] }));
    if (!g.versions.some((x) => x.id === v.id)) g.versions.push(v);
  }
  return groupes.map((g) => ({
    libelle: g.libelle,
    varianteIds: [...g.versions].sort((a, b) => (a.numero ?? Infinity) - (b.numero ?? Infinity) || a.code.localeCompare(b.code)).map((v) => v.id),
  }));
}

export type EtatVersionSeance = "a-filmer" | "a-refaire" | "rangee";

/** Une version dans la vue d'une séance. */
export interface VersionDeSeance extends VersionTournable {
  etat: EtatVersionSeance;
  prises: number;
  prompteur?: string;
  trame?: VarianteReseau["trame"];
  /** Débit du mode « je lis » de son format (mots/s). */
  debit: number;
}

type Prises = SessionTournage["prises"];

/** État d'une version dans la séance : aucune prise → à filmer ; dernière prise ratée → à refaire ; sinon rangée. */
export function etatVersionSeance(prises: Prises, varianteId: Id): EtatVersionSeance {
  const siennes = prises.filter((p) => p.varianteId === varianteId);
  const derniere = siennes.at(-1);
  if (!derniere) return "a-filmer";
  return derniere.ratee ? "a-refaire" : "rangee";
}

/** Nombre de prises d'une version (ratées comprises). */
export function nombrePrises(prises: Prises, varianteId: Id): number {
  return prises.filter((p) => p.varianteId === varianteId).length;
}

/** Prochaine version à filmer dans l'ordre de la séance (null : tout est rangé). */
export function prochaineVersion(s: Pick<SessionTournage, "varianteIds" | "prises">): Id | null {
  return s.varianteIds.find((id) => etatVersionSeance(s.prises, id) !== "rangee") ?? null;
}

export function etatSeance(s: Pick<SessionTournage, "varianteIds" | "prises">): SessionTournage["etat"] {
  if (!s.prises.length) return "preparee";
  return prochaineVersion(s) === null ? "terminee" : "en-cours";
}

export function compteSeance(s: Pick<SessionTournage, "varianteIds" | "prises">): { rangees: number; total: number } {
  return { rangees: s.varianteIds.filter((id) => etatVersionSeance(s.prises, id) === "rangee").length, total: s.varianteIds.length };
}

/** Nom de la prise, rangée sous son code : « 0042-AV-TT-L · prise 2 ». */
export function nomPrise(code: string, numero: number): string {
  return `${code} · prise ${numero}`;
}

/** Nom du fichier enregistré (sans espace ni accent) : « 0042-AV-TT-L-prise-2.webm ». */
export function nomFichierPrise(code: string, numero: number, mime: string): string {
  const ext = /mp4/.test(mime) ? "mp4" : "webm";
  return `${code.replace(/[^A-Za-z0-9-]/g, "")}-prise-${numero}.${ext}`;
}

/* ------------------------------------------------------------------ */
/* Enregistreur : machine d'états                                       */
/* ------------------------------------------------------------------ */

export type EtatEnregistreur =
  | { phase: "camera" }
  | { phase: "refusee" }
  | { phase: "pret" }
  | { phase: "decompte"; reste: number }
  | { phase: "enregistre"; depuisSec: number }
  | { phase: "pause"; depuisSec: number }
  | { phase: "relecture"; dureeSec: number }
  | { phase: "envoi"; dureeSec: number }
  | { phase: "rangee" }
  | { phase: "erreur"; message: string; dureeSec: number };

export type EvenementEnregistreur =
  | { type: "camera-ok" }
  | { type: "camera-refusee" }
  | { type: "demarrer" }
  | { type: "tic" }
  | { type: "temps"; sec: number }
  | { type: "toucher" }
  | { type: "arreter" }
  | { type: "ratee" }
  | { type: "garder" }
  | { type: "envoyee" }
  | { type: "echec"; message: string }
  | { type: "suivante" };

/** Transitions de l'enregistreur. Un événement hors de propos est ignoré (jamais d'erreur). */
export function enregistreur(e: EtatEnregistreur, ev: EvenementEnregistreur): EtatEnregistreur {
  switch (ev.type) {
    case "camera-ok":
      return e.phase === "camera" || e.phase === "refusee" ? { phase: "pret" } : e;
    case "camera-refusee":
      return e.phase === "camera" ? { phase: "refusee" } : e;
    case "demarrer":
      return e.phase === "pret" ? { phase: "decompte", reste: DECOMPTE_SEC } : e;
    case "tic":
      if (e.phase !== "decompte") return e;
      return e.reste > 1 ? { phase: "decompte", reste: e.reste - 1 } : { phase: "enregistre", depuisSec: 0 };
    case "temps":
      return e.phase === "enregistre" ? { phase: "enregistre", depuisSec: ev.sec } : e;
    case "toucher":
      if (e.phase === "enregistre") return { phase: "pause", depuisSec: e.depuisSec };
      if (e.phase === "pause") return { phase: "enregistre", depuisSec: e.depuisSec };
      return e;
    case "arreter":
      return e.phase === "enregistre" || e.phase === "pause" ? { phase: "relecture", dureeSec: e.depuisSec } : e;
    case "ratee":
      return e.phase === "relecture" || e.phase === "erreur" || e.phase === "enregistre" || e.phase === "pause" ? { phase: "pret" } : e;
    case "garder":
      return e.phase === "relecture" || e.phase === "erreur" ? { phase: "envoi", dureeSec: e.dureeSec } : e;
    case "envoyee":
      return e.phase === "envoi" ? { phase: "rangee" } : e;
    case "echec":
      return e.phase === "envoi" ? { phase: "erreur", message: ev.message, dureeSec: e.dureeSec } : e;
    case "suivante":
      return e.phase === "rangee" ? { phase: "pret" } : e;
  }
}
