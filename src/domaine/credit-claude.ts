/**
 * CRÉDIT CLAUDE RESTANT ESTIMÉ — calculs PURS, sans `server-only`. AFFICHAGE SEULEMENT.
 * Anthropic n'offre AUCUNE API de solde : ce chiffre est un calcul (crédit du cycle ou dernier relevé de la Console,
 * moins la dépense Claude enregistrée depuis). Il n'est JAMAIS lu par le pré-vol, `marquerEpuisee`, `choisirSource`
 * ni `declarerRecharge` : une estimation ne bloque ni ne débloque rien.
 */
import type { DepenseEnregistree } from "./types";
import { depenseDuFournisseur } from "./credits";
import type { EnvClaude, SourceAbonnement, SourceClaude } from "./source-claude";
import { cleDeLaSource } from "./source-claude";

export interface CycleCredit {
  montantCentimes: number;
  debut: string;
  expireLe: string | null;
  prochainLe: string | null;
}

export interface ReleveCredit {
  centimes: number;
  le: string;
}

/** Crédit d'un cycle quand rien d'autre n'est saisi : 200 $. */
export const CREDIT_CYCLE_PAR_DEFAUT_CENTIMES = 20000;

export const paramCycleCredit = (s: SourceAbonnement): string => `claude.credit.cycle.${s}`;
export const paramReleveCredit = (s: SourceAbonnement): string => `claude.credit.releve.${s}`;

/* --- Dates : une date seule (AAAA-MM-JJ) se lit à l'heure de Paris ------- */

const DATE_SEULE = /^\d{4}-\d{2}-\d{2}$/;

/** Années acceptées pour une date saisie. */
const ANNEE_MIN = 2024;
const ANNEE_MAX = 2100;

/** Date seule AAAA-MM-JJ valide (jour réel du calendrier, année de 2024 à 2100). Un instant avec heure ou fuseau est refusé. */
export function dateIsoValide(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_SEULE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(v)) return false;
  const annee = d.getUTCFullYear();
  return annee >= ANNEE_MIN && annee <= ANNEE_MAX;
}

const FORMAT_PARIS = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Minuit (heure de Paris) d'une date seule, en ms UTC. */
function minuitParis(jour: string): number {
  const [a, m, j] = jour.split("-").map(Number) as [number, number, number];
  for (const decalage of [1, 2]) {
    const t = Date.UTC(a, m - 1, j) - decalage * 3_600_000;
    const p = Object.fromEntries(FORMAT_PARIS.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}` === jour && p.hour === "00" && p.minute === "00") return t;
  }
  return Date.UTC(a, m - 1, j) - 3_600_000;
}

/** Instant (ms) d'un début : date seule = minuit Paris ; instant complet = tel quel. */
export function instantDebut(v: string): number {
  return DATE_SEULE.test(v) ? minuitParis(v) : new Date(v).getTime();
}

/** Instant (ms) d'une expiration : date seule = ce jour entier compris (expire à minuit Paris du lendemain). */
function instantFin(v: string): number {
  if (!DATE_SEULE.test(v)) return new Date(v).getTime();
  const lendemain = new Date(new Date(`${v}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
  return minuitParis(lendemain);
}

/* --- Consommation ----------------------------------------------------------- */

/** Instant UTC normalisé (ISO) : une date seule = minuit Paris ; un instant avec fuseau est converti en UTC. */
export function instantUtc(v: string): string {
  return new Date(instantDebut(v)).toISOString();
}

/**
 * Dépense Claude réelle (centimes de dollar, arrondie) d'UN compte (ou de plusieurs, additionnés) depuis `depuis`. Ignore les données de démonstration ;
 * une dépense sans `sourceClaude` compte pour le compte 1 ; la source `api` ne sort jamais d'un compte d'abonnement.
 */
export function consommeDepuis(depenses: (Pick<DepenseEnregistree, "lignes" | "date" | "sourceClaude"> & { estDemo?: boolean })[], sources: SourceClaude | readonly SourceClaude[], depuis: string, tauxUsdEur: number): number {
  const depuisIso = instantUtc(depuis);
  const voulues = typeof sources === "string" ? [sources] : sources;
  let total = 0;
  for (const d of depenses) {
    if (d.estDemo) continue;
    if (!voulues.includes(d.sourceClaude ?? "abonnement-1")) continue;
    total += depenseDuFournisseur([d], "anthropic", tauxUsdEur, depuisIso);
  }
  return Math.round(total);
}

/* --- Restant estimé --------------------------------------------------------- */

export type EtatRestant = "estime" | "expire" | "a-venir" | "a-renseigner";

export interface RestantEstime {
  etat: EtatRestant;
  restantCentimes: number | null;
  base: "releve" | "cycle" | null;
  depuis: string | null;
  depasse: boolean;
}

/** `consomme(depuis)` : dépense du compte depuis cet instant (centimes de dollar). */
export function restantEstime(p: { cycle: CycleCredit | null; releve: ReleveCredit | null; consomme: (depuis: string) => number; maintenant: string | Date }): RestantEstime {
  const now = new Date(p.maintenant).getTime();
  const { cycle, releve } = p;
  const PEREMPTION_RELEVE_MS = 35 * 86_400_000;
  if (!cycle && (!releve || now - new Date(releve.le).getTime() > PEREMPTION_RELEVE_MS)) return { etat: "a-renseigner", restantCentimes: null, base: null, depuis: null, depasse: false };

  if (cycle) {
    if (cycle.expireLe && now >= instantFin(cycle.expireLe)) return { etat: "expire", restantCentimes: 0, base: null, depuis: cycle.debut, depasse: false };
    if (now < instantDebut(cycle.debut)) return { etat: "a-venir", restantCentimes: cycle.montantCentimes, base: "cycle", depuis: cycle.debut, depasse: false };
  }

  // Le relevé ne vaut que s'il est du cycle en cours.
  const releveValable = releve && (!cycle || new Date(releve.le).getTime() >= instantDebut(cycle.debut)) ? releve : null;
  const base = releveValable ? releveValable.centimes : cycle!.montantCentimes;
  const depuis = releveValable ? releveValable.le : cycle!.debut;
  const brut = Math.round(base - p.consomme(depuis));
  return { etat: "estime", restantCentimes: Math.max(0, brut), base: releveValable ? "releve" : "cycle", depuis, depasse: brut < 0 };
}

/* --- Total ------------------------------------------------------------------ */

export interface CompteTotal {
  source: SourceClaude;
  cle: string | null;
  desactive: boolean;
  etat: EtatRestant;
  restantCentimes: number | null;
}

export type MotifHorsTotal = "sans-cle" | "cle-payante" | "doublon" | "desactive";

export interface TotalRestant {
  centimes: number;
  /** Nombre de comptes réellement additionnés (après exclusion des doublons, de la clé payante, des désactivés, sans clé). */
  comptes: number;
  /** Pourquoi un compte d'abonnement n'est pas dans le total (absent : il y est, ou n'a pas de chiffre). */
  exclus: Partial<Record<SourceClaude, MotifHorsTotal>>;
}

/**
 * Total restant : seulement les comptes d'abonnement « estimé », avec clé posée, non désactivés, sans clé en doublon
 * (même règle que le choix de source : `comptes` DOIT être dans l'ordre du réglage ; un désactivé est sauté AVANT
 * de noter sa clé). L'API payante n'y entre jamais ; sa clé collée ailleurs y est ignorée.
 */
export function totalRestant(comptes: readonly CompteTotal[]): TotalRestant {
  const vues = new Set<string>();
  const payante = comptes.find((c) => c.source === "api")?.cle;
  if (payante) vues.add(payante);
  const exclus: TotalRestant["exclus"] = {};
  let centimes = 0;
  let n = 0;
  for (const c of comptes) {
    if (c.source === "api") continue;
    if (c.desactive) {
      exclus[c.source] = "desactive";
      continue;
    }
    if (!c.cle) {
      exclus[c.source] = "sans-cle";
      continue;
    }
    if (payante && c.cle === payante) {
      exclus[c.source] = "cle-payante";
      continue;
    }
    if (vues.has(c.cle)) {
      exclus[c.source] = "doublon";
      continue;
    }
    vues.add(c.cle);
    if (c.etat === "estime" && c.restantCentimes !== null) {
      centimes += c.restantCentimes;
      n += 1;
    }
  }
  return { centimes, comptes: n, exclus };
}

/** Clé posée de la source (aide pour le service). */
export function cleDe(s: SourceClaude, env: EnvClaude): string | null {
  return cleDeLaSource(s, env);
}

/* --- Avertissement de la carte de l'Accueil (affichage seulement) --------------- */

/** Sous ce restant (20 $), un compte retenu est « presque vide ». */
export const SEUIL_PRESQUE_VIDE_CENTIMES = 2000;
/** Un relevé de la Console plus vieux que ça (7 jours) est signalé. */
const RELEVE_ANCIEN_MS = 7 * 86_400_000;

export interface CompteAvertissement {
  source: string;
  etat: EtatRestant;
  restantCentimes: number | null;
  prochainLe: string | null;
  releveLe: string | null;
  /** Le compte n'entre pas dans le total (désactivé, sans clé, doublon, clé payante). */
  horsTotalTexte: string | null;
}

export type AvertissementCredit = { ton: "ambre"; texte: string } | { ton: "brique"; texte: string } | { ton: "gris"; texte: string };

/**
 * Mise en garde de la carte. Jamais le mot « recharger » : un abonnement se renouvelle. Mode API : aucune (les comptes
 * d'abonnement ne servent pas). Priorité : tous vides (brique), puis un compte presque vide (ambre), puis relevé ancien (gris).
 */
export function avertissementCreditClaude(p: { mode: "abonnements" | "api"; comptes: readonly CompteAvertissement[]; maintenant: string | Date; formaterJour?: (iso: string) => string }): AvertissementCredit | null {
  if (p.mode !== "abonnements") return null;
  const jour = p.formaterJour ?? ((iso: string) => iso.slice(0, 10));
  const retenus = p.comptes.filter((c) => !c.horsTotalTexte);
  const vide = (c: CompteAvertissement) => c.etat === "expire" || (c.etat === "estime" && c.restantCentimes === 0);
  if (retenus.length && retenus.every(vide)) {
    const prochains = retenus.map((c) => c.prochainLe).filter((x): x is string => !!x).sort();
    return { ton: "brique", texte: `Comptes Claude vides jusqu'au renouvellement${prochains[0] ? ` (prochain : ${jour(prochains[0])})` : ""}` };
  }
  const bas = retenus.findIndex((c) => c.etat === "estime" && c.restantCentimes !== null && c.restantCentimes < SEUIL_PRESQUE_VIDE_CENTIMES);
  if (bas >= 0) {
    const c = retenus[bas]!;
    // « Le compte suivant prendra le relais » seulement s'il existe, après lui dans l'ordre, un compte retenu non vide.
    const relais = retenus.slice(bas + 1).some((x) => !vide(x));
    return { ton: "ambre", texte: `Compte ${c.source.replace("abonnement-", "")} ${vide(c) ? "vide" : "presque vide"}${relais ? " : le compte suivant prendra le relais" : ""}` };
  }
  const releves = p.comptes.map((c) => c.releveLe).filter((x): x is string => !!x);
  if (releves.length) {
    const dernier = Math.max(...releves.map((r) => new Date(r).getTime()));
    if (new Date(p.maintenant).getTime() - dernier > RELEVE_ANCIEN_MS) return { ton: "gris", texte: "Relevé ancien : vérifiez dans la Console" };
  }
  return null;
}
