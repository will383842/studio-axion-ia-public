/**
 * SOURCES CLAUDE (socle multi-comptes) — PUR, testé, sans `server-only`.
 *
 * Le studio peut écrire avec TROIS comptes Claude (trois forfaits, une organisation Console et une clé chacun). Quand un
 * compte est épuisé, le suivant prend le relais AUTOMATIQUEMENT. L'API payante (`api`) est une 4e source qui ne s'active
 * JAMAIS toute seule : seulement par le choix manuel de Will (mode « api » du réglage).
 *  - `abonnement-1` lit `ANTHROPIC_API_KEY` : le comportement d'avant, par défaut ;
 *  - jamais de repli d'une variable vers une autre (`cleDeLaSource` ne regarde que la variable de la source) ;
 *  - en mode « abonnements », `api` n'est JAMAIS parcourue, même si sa clé est posée.
 */
import type { DepenseEnregistree } from "./types";
import { depenseDuFournisseur } from "./credits";

export type SourceAbonnement = "abonnement-1" | "abonnement-2" | "abonnement-3";
export type SourceApi = "api";
export type SourceClaude = SourceAbonnement | SourceApi;

export const VARIABLE_CLE_CLAUDE_1 = "ANTHROPIC_API_KEY";
export const VARIABLE_CLE_CLAUDE_2 = "ANTHROPIC_API_KEY_2";
export const VARIABLE_CLE_CLAUDE_3 = "ANTHROPIC_API_KEY_3";
export const VARIABLE_CLE_CLAUDE_PAYANTE = "ANTHROPIC_API_KEY_PAYANTE";

export const SOURCES_ABONNEMENT: readonly { id: SourceAbonnement; numero: 1 | 2 | 3; variable: string; libelle: string }[] = [
  { id: "abonnement-1", numero: 1, variable: VARIABLE_CLE_CLAUDE_1, libelle: "Compte Claude 1" },
  { id: "abonnement-2", numero: 2, variable: VARIABLE_CLE_CLAUDE_2, libelle: "Compte Claude 2" },
  { id: "abonnement-3", numero: 3, variable: VARIABLE_CLE_CLAUDE_3, libelle: "Compte Claude 3" },
];

export const SOURCE_API = { id: "api" as SourceApi, variable: VARIABLE_CLE_CLAUDE_PAYANTE, libelle: "API payante" } as const;

export const PARAM_SOURCES_CLAUDE = "claude.sources";
export const paramEpuise = (s: SourceAbonnement): string => `claude.epuise.${s}`;
export const paramJourRenouvellement = (s: SourceAbonnement): string => `claude.jourRenouvellement.${s}`;

export type EnvClaude = Record<string, string | undefined>;

export interface ReglageSources {
  mode: "abonnements" | "api";
  ordre: SourceAbonnement[];
  desactives: SourceAbonnement[];
  changeLe: string | null;
}

const IDS_ABONNEMENT: SourceAbonnement[] = SOURCES_ABONNEMENT.map((s) => s.id);

export const REGLAGE_SOURCES_PAR_DEFAUT: ReglageSources = { mode: "abonnements", ordre: [...IDS_ABONNEMENT], desactives: [], changeLe: null };

export function libelleSource(s: SourceClaude): string {
  return s === "api" ? SOURCE_API.libelle : (SOURCES_ABONNEMENT.find((x) => x.id === s)?.libelle ?? s);
}

export function numeroAbonnement(s: SourceAbonnement): number {
  return SOURCES_ABONNEMENT.find((x) => x.id === s)?.numero ?? 1;
}

/** Lit le réglage stocké (illisible → défaut). Le mode « api » n'existe que si la valeur est EXACTEMENT « api ». */
export function lireReglageSources(v: unknown): ReglageSources {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ...REGLAGE_SOURCES_PAR_DEFAUT, ordre: [...IDS_ABONNEMENT], desactives: [] };
  const o = v as Record<string, unknown>;
  const mode = o.mode === "api" ? "api" : "abonnements";
  const brut = Array.isArray(o.ordre) ? o.ordre : [];
  const complet = brut.length === 3 && IDS_ABONNEMENT.every((id) => brut.filter((x) => x === id).length === 1);
  const ordre = complet ? (brut as SourceAbonnement[]) : [...IDS_ABONNEMENT];
  const desactives = Array.isArray(o.desactives) ? IDS_ABONNEMENT.filter((id) => (o.desactives as unknown[]).includes(id)) : [];
  return { mode, ordre: [...ordre], desactives, changeLe: typeof o.changeLe === "string" ? o.changeLe : null };
}

export function variableDeLaSource(s: SourceClaude): string {
  return s === "api" ? SOURCE_API.variable : SOURCES_ABONNEMENT.find((x) => x.id === s)!.variable;
}

/** Clé de la source, SANS aucun repli vers une autre variable. */
export function cleDeLaSource(s: SourceClaude, env: EnvClaude): string | null {
  return env[variableDeLaSource(s)]?.trim() || null;
}

/** Les quatre clés posées (pour les MASQUER dans un texte, jamais pour choisir une source). */
export function clesClaudeConnues(env: EnvClaude): string[] {
  return [...IDS_ABONNEMENT, "api" as SourceClaude].map((s) => cleDeLaSource(s, env)).filter((c): c is string => !!c);
}

/* --- Période de renouvellement ----------------------------------------- */

/** Jour de renouvellement valide : entier de 1 à 28 ; sinon (31, absent…) le 1er. */
function jourValide(jour: number | null | undefined): number {
  return typeof jour === "number" && Number.isInteger(jour) && jour >= 1 && jour <= 28 ? jour : 1;
}

/** Début (ISO, UTC, minuit) de la période de renouvellement en cours à cet instant. */
export function debutPeriode(instant: string | Date, jour: number | null | undefined): string {
  const j = jourValide(jour);
  const d = new Date(instant);
  let annee = d.getUTCFullYear();
  let mois = d.getUTCMonth();
  if (d.getUTCDate() < j) {
    mois -= 1;
    if (mois < 0) {
      mois = 11;
      annee -= 1;
    }
  }
  return new Date(Date.UTC(annee, mois, j)).toISOString();
}

/** Le compte est-il épuisé MAINTENANT (marque posée dans la période en cours) ? */
export function epuiseeMaintenant(e: { depuis: string } | null | undefined, maintenant: string | Date, jour: number | null | undefined): boolean {
  return !!e && typeof e.depuis === "string" && e.depuis >= debutPeriode(maintenant, jour);
}

/* --- Choix de la source -------------------------------------------------- */

export type EtatChoix = { etat: "pret"; source: SourceClaude; cle: string } | { etat: "tous-epuises"; comptes: number } | { etat: "aucun" };

export type Epuises = Partial<Record<SourceAbonnement, boolean>>;

/**
 * Choisit la source de l'appel.
 *  - mode « api » (geste manuel de Will) : l'API si sa clé est posée, sinon « aucun » ; jamais un abonnement ;
 *  - mode « abonnements » : parcourt `ordre`, garde les comptes non désactivés, avec une clé posée DIFFÉRENTE de celle d'un
 *    compte précédent (un doublon est ignoré) et non exclus ; le premier non épuisé répond ; tous épuisés → « tous-epuises ».
 *    `api` n'est JAMAIS parcourue.
 */
export function choisirSource(reglage: ReglageSources, env: EnvClaude, epuises: Epuises, exclure: readonly SourceAbonnement[] = []): EtatChoix {
  if (reglage.mode === "api") {
    const cle = cleDeLaSource("api", env);
    return cle ? { etat: "pret", source: "api", cle } : { etat: "aucun" };
  }
  const retenus = comptesRetenus(reglage, env, exclure);
  if (!retenus.length) return { etat: "aucun" };
  const libre = retenus.find((c) => !epuises[c.source]);
  return libre ? { etat: "pret", source: libre.source, cle: libre.cle } : { etat: "tous-epuises", comptes: retenus.length };
}

function comptesRetenus(reglage: ReglageSources, env: EnvClaude, exclure: readonly SourceAbonnement[]): { source: SourceAbonnement; cle: string }[] {
  // La clé payante n'est JAMAIS un compte d'abonnement : collée aussi en compte 2 ou 3, elle y est ignorée.
  const vues = new Set<string>();
  const payante = cleDeLaSource("api", env);
  if (payante) vues.add(payante);
  const retenus: { source: SourceAbonnement; cle: string }[] = [];
  for (const source of reglage.ordre) {
    if (reglage.desactives.includes(source)) continue;
    const cle = cleDeLaSource(source, env);
    if (!cle || vues.has(cle)) continue;
    vues.add(cle);
    if (exclure.includes(source)) continue;
    retenus.push({ source, cle });
  }
  return retenus;
}

/**
 * Prochain compte d'ABONNEMENT à essayer après un refus de facturation (jamais `api`, jamais un compte déjà essayé,
 * jamais un compte épuisé, jamais une clé en doublon) ; `null` : plus aucun.
 */
export function prochaineSourceAbonnement(reglage: ReglageSources, env: EnvClaude, epuises: Epuises, dejaEssayees: readonly SourceAbonnement[]): { source: SourceAbonnement; cle: string } | null {
  if (reglage.mode === "api") return null;
  return comptesRetenus(reglage, env, dejaEssayees).find((c) => !epuises[c.source]) ?? null;
}

export { messageComptesEpuises } from "./credits";

/* --- Consommation -------------------------------------------------------- */

/** Dépense Claude réelle par source depuis `depuis` (centimes de dollar). Sans `sourceClaude` : compte 1. */
export function consommationParSource(depenses: Pick<DepenseEnregistree, "lignes" | "date" | "sourceClaude">[], depuis: string, tauxUsdEur: number): Record<SourceClaude, number> {
  const total: Record<SourceClaude, number> = { "abonnement-1": 0, "abonnement-2": 0, "abonnement-3": 0, api: 0 };
  for (const d of depenses) total[d.sourceClaude ?? "abonnement-1"] += depenseDuFournisseur([d], "anthropic", tauxUsdEur, depuis);
  for (const s of Object.keys(total) as SourceClaude[]) total[s] = Math.round(total[s]);
  return total;
}
