/**
 * À TRAITER · SUIVI, PARTIE PURE (ATR-02b). Priorité, spam masqué, tri, délai, rappels dus, compteurs.
 * Module PUR : aucun import dynamique, aucune dépendance serveur (utilisable dans les composants clients).
 * Extrait de a-traiter-suivi.ts, qui le réexporte. Aucune réponse n'est envoyée, rien n'est supprimé.
 */
import { detecterAEcrireSoiMeme } from "./a-traiter-kit";
import { formateurDate } from "@/lib/intl";
import type { CarteATraiter } from "./a-traiter-types";

export type Priorite = 1 | 2 | 3 | 4;

/** PROPOSITION du pilotage : mots d'une demande commerciale ou de rendez-vous (sans accent, en minuscules). */
export const MOTS_COMMERCIAUX = ["devis", "tarif", "rendez-vous", "rdv", "appel", "demo", "offre"] as const;
/** PROPOSITION du pilotage : mots qui signalent un message indésirable (sans accent, en minuscules). */
export const MOTS_SPAM = ["crypto", "casino", "gagnez", "followers"] as const;
/** PROPOSITION du pilotage : heures de Paris des trois créneaux de rappel (le créneau dure toute l'heure). */
export const CRENEAUX_RAPPEL: readonly number[] = [9, 13, 19];
/** Valeurs du fondateur. */
export const DELAI_RAPPEL_HEURES = 4;
export const HEURE_DEBUT_RAPPELS = 8;
export const HEURE_FIN_RAPPELS = 20;

const sansAccent = (t: string): string =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const motPresent = (texte: string, mots: readonly string[]): boolean =>
  mots.some((m) => new RegExp(`(^|[^a-z0-9])${m}s?($|[^a-z0-9])`).test(texte));

const RE_MOTS_PRIX = /\b(?:prix|tarifs?|combien|co[uû]te[a-z]*|co[uû]ts?|payants?|gratuit[es]*|abonnements?|euros?|tarification)\b|[€$]/gi;

/** 1 réclamation ou colère ; 2 demande commerciale ou de rendez-vous ; 3 mot du guide ; 4 le reste. */
export function prioriteCarte(c: Pick<CarteATraiter, "extrait" | "mot">): Priorite {
  let raison = detecterAEcrireSoiMeme(c.extrait);
  // « prix » est testé avant réclamation et colère dans le kit : on retire les mots de prix pour ne pas masquer une plainte.
  if (raison === "prix") raison = detecterAEcrireSoiMeme(c.extrait.replace(RE_MOTS_PRIX, " "));
  if (raison === "reclamation" || raison === "colere") return 1;
  if (motPresent(sansAccent(c.extrait), MOTS_COMMERCIAUX)) return 2;
  if (c.mot) return 3;
  return 4;
}

/** Vrai si l'extrait contient au moins 2 liens ou un mot de `MOTS_SPAM`. */
export function estSpam(c: Pick<CarteATraiter, "extrait">): boolean {
  const t = sansAccent(c.extrait);
  const liens = t.match(/https?:\/\/|www\./g)?.length ?? 0;
  return liens >= 2 || motPresent(t, MOTS_SPAM);
}

/** Cartes à traiter hors spam, triées par priorité puis par date la plus ancienne (tri stable). */
export function trierParPriorite(cartes: readonly CarteATraiter[]): CarteATraiter[] {
  return cartes
    .filter((c) => c.statut === "a_traiter" && !estSpam(c))
    .map((c, i) => ({ c, i, p: prioriteCarte(c) }))
    .sort((a, b) => a.p - b.p || a.c.creeLe.localeCompare(b.c.creeLe) || a.i - b.i)
    .map((x) => x.c);
}

/** Cartes masquées (spam) : elles restent dans le dépôt, rien n'est supprimé. */
export const cartesMasquees = (cartes: readonly CarteATraiter[]): CarteATraiter[] => cartes.filter(estSpam);

/** Pour l'écran : les cartes « opposées » (STOP demandé) passent TOUJOURS en tête (la plus ancienne d'abord), puis le tri par priorité. */
export function trierPourEcran(cartes: readonly CarteATraiter[]): CarteATraiter[] {
  const opposees = cartes.filter((c) => c.statut === "a_traiter" && c.opposee === true).sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  return [...opposees, ...trierParPriorite(cartes.filter((c) => c.opposee !== true))];
}

/** Pour l'écran : une carte opposée n'est JAMAIS masquée, même avec un mot de spam ou deux liens. */
export const masqueesPourEcran = (cartes: readonly CarteATraiter[]): CarteATraiter[] => cartesMasquees(cartes.filter((c) => c.opposee !== true));

/**
 * Cartes pour les compteurs de l'écran : une carte traitée dans cette session n'est « fait » (donc « répondue ») que si l'action
 * était « Fait » ; Ignorer, Classer la carte et STOP la passent à « ignore » (ni répondue, ni en retard).
 */
export function cartesPourCompteurs(cartes: readonly CarteATraiter[], traitees: Readonly<Record<string, "fait" | "ignore">>): CarteATraiter[] {
  return cartes.map((c) => {
    const s = traitees[c.idEvenement];
    return s ? { ...c, statut: s } : c;
  });
}

/** Minutes entre la création et le « fait », ou null (pas de « fait », ou dates illisibles). */
export function delaiReponseMinutes(c: Pick<CarteATraiter, "creeLe" | "faitLe">): number | null {
  if (!c.faitLe) return null;
  const d = Date.parse(c.faitLe) - Date.parse(c.creeLe);
  return Number.isFinite(d) ? Math.round(d / 60_000) : null;
}

export interface ReglageRappels {
  /** Heures sans réponse avant qu'une carte soit due (défaut 4). */
  delaiHeures?: number;
  /** Heures de Paris des créneaux (défaut `CRENEAUX_RAPPEL`). */
  creneaux?: readonly number[];
}

/** Jour, heure et minute à Paris pour un instant donné. */
export function parisDe(d: Date): { jour: string; minutes: number; heure: number } {
  const p = Object.fromEntries(
    formateurDate("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const heure = Number(p.hour);
  return { jour: `${p.year}-${p.month}-${p.day}`, heure, minutes: heure * 60 + Number(p.minute) };
}

const estEnRetard = (c: CarteATraiter, maintenant: Date, delaiHeures: number): boolean => {
  if (c.statut !== "a_traiter" || c.opposee === true || estSpam(c)) return false;
  const age = maintenant.getTime() - Date.parse(c.creeLe);
  return Number.isFinite(age) && age >= delaiHeures * 3_600_000;
};

/** Créneau de Paris en cours (ex. 9), ou null : jamais avant 8 h ni après 20 h 00, et seulement dans un créneau. */
export function creneauEnCours(maintenant: Date, creneaux: readonly number[]): number | null {
  const { heure, minutes } = parisDe(maintenant);
  if (minutes < HEURE_DEBUT_RAPPELS * 60 || minutes > HEURE_FIN_RAPPELS * 60) return null;
  return creneaux.includes(heure) ? heure : null;
}

/** Cartes dues pour un rappel : « a_traiter », non spam, non opposée, sans réponse depuis `delaiHeures`, et dans un créneau. */
export function rappelsDus(cartes: readonly CarteATraiter[], maintenant: Date, reglage: ReglageRappels = {}): CarteATraiter[] {
  if (creneauEnCours(maintenant, reglage.creneaux ?? CRENEAUX_RAPPEL) === null) return [];
  const delai = reglage.delaiHeures ?? DELAI_RAPPEL_HEURES;
  return cartes.filter((c) => estEnRetard(c, maintenant, delai));
}

export interface Compte {
  arrives: number;
  repondus: number;
  enRetard: number;
}
export interface Compteurs {
  parReseau: Record<string, Compte>;
  /** réseau → repère du post → compte. */
  parPost: Record<string, Record<string, Compte>>;
}

/** Arrivés, répondus (« fait ») et en retard, par réseau et par post. Les cartes spam (masquées) ne comptent pas. */
export function compteurs(cartes: readonly CarteATraiter[], maintenant: Date = new Date(), reglage: ReglageRappels = {}): Compteurs {
  const delai = reglage.delaiHeures ?? DELAI_RAPPEL_HEURES;
  const out: Compteurs = { parReseau: {}, parPost: {} };
  const vide = (): Compte => ({ arrives: 0, repondus: 0, enRetard: 0 });
  for (const c of cartes) {
    if (estSpam(c)) continue;
    const r = (out.parReseau[c.reseau] ??= vide());
    const p = ((out.parPost[c.reseau] ??= {})[c.post] ??= vide());
    for (const x of [r, p]) {
      x.arrives += 1;
      if (c.statut === "fait") x.repondus += 1;
      if (estEnRetard(c, maintenant, delai)) x.enRetard += 1;
    }
  }
  return out;
}
