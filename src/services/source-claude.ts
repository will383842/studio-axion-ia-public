/**
 * SOURCES CLAUDE — côté serveur (socle multi-comptes ; règles dans `domaine/source-claude.ts`).
 * N'importe PAS `generation-claude.ts` (celui-ci l'importe). Une clé n'est jamais renvoyée d'ici : `vueSourcesClaude`
 * ne dit que « posée / absente ».
 */
import "server-only";
import {
  choisirSource,
  cleDeLaSource,
  debutPeriode,
  epuiseeMaintenant,
  lireReglageSources,
  PARAM_SOURCES_CLAUDE,
  paramEpuise,
  paramJourRenouvellement,
  SOURCES_ABONNEMENT,
  type EnvClaude,
  type EtatChoix,
  type ReglageSources,
  type SourceAbonnement,
  type SourceClaude,
} from "@/domaine/source-claude";
import { ecrireParametre, lireParametre, maintenant } from "./_commun";

interface Marque {
  depuis: string;
}

export async function lireReglageSourcesClaude(): Promise<ReglageSources> {
  return lireReglageSources(await lireParametre<unknown>(PARAM_SOURCES_CLAUDE, null));
}

async function jourRenouvellement(s: SourceAbonnement): Promise<number | null> {
  const j = await lireParametre<unknown>(paramJourRenouvellement(s), null);
  return typeof j === "number" ? j : null;
}

/** Quels comptes sont épuisés dans leur période en cours ? */
export async function etatsEpuisement(instant: string = maintenant()): Promise<Record<SourceAbonnement, boolean>> {
  const sortie = {} as Record<SourceAbonnement, boolean>;
  for (const { id } of SOURCES_ABONNEMENT) {
    sortie[id] = epuiseeMaintenant(await lireParametre<Marque | null>(paramEpuise(id), null), instant, await jourRenouvellement(id));
  }
  return sortie;
}

/** Choisit la source de l'appel (`env` : les clés visibles, `process.env` par défaut ; injectable pour les essais). */
export async function choisirSourceClaude(exclure: readonly SourceAbonnement[] = [], env: EnvClaude = process.env): Promise<EtatChoix> {
  return choisirSource(await lireReglageSourcesClaude(), env, await etatsEpuisement(), exclure);
}

/**
 * Règle UNIQUE « Claude en mode abonnements » (bandeau, cartes, suivi des travaux) : le mode l'est ET au moins un compte
 * d'abonnement est utilisable (clé posée, non désactivée, différente de la clé payante). Sinon il n'y a rien à renouveler.
 */
export async function abonnementsClaudeActifs(env?: EnvClaude): Promise<boolean> {
  if ((await lireReglageSourcesClaude()).mode !== "abonnements") return false;
  // Import différé : generation-claude importe ce module (cycle).
  const clesVisibles = env ?? (await import("./generation-claude")).envClaude();
  return (await choisirSourceClaude([], clesVisibles)).etat !== "aucun";
}

/* Les marques s'écrivent l'une après l'autre dans ce processus : deux appels parallèles ne posent qu'une marque. */
let file: Promise<unknown> = Promise.resolve();

/** Marque un compte épuisé pour la période en cours. N'écrit que si la marque est absente ou d'une période révolue. */
export function marquerEpuisee(s: SourceAbonnement): Promise<void> {
  const tache = file.then(async () => {
    const instant = maintenant();
    const existante = await lireParametre<Marque | null>(paramEpuise(s), null);
    if (epuiseeMaintenant(existante, instant, await jourRenouvellement(s))) return;
    await ecrireParametre(paramEpuise(s), { depuis: instant } satisfies Marque);
  });
  file = tache.catch(() => undefined);
  return tache;
}

/** Geste de Will : un compte (ou tous) redevient utilisable. */
export async function remettreEnService(s?: SourceAbonnement): Promise<void> {
  for (const { id } of SOURCES_ABONNEMENT) if (!s || s === id) await ecrireParametre(paramEpuise(id), null);
}

export interface VueSourceClaude {
  source: SourceClaude;
  libelle: string;
  clePosee: boolean;
  epuisee: boolean;
  epuiseDepuis: string | null;
  jourRenouvellement: number | null;
  debutPeriode: string;
  desactive: boolean;
}

/** Pour l'écran : l'état de chaque compte, JAMAIS une clé. */
export async function vueSourcesClaude(env: EnvClaude = process.env): Promise<{ reglage: ReglageSources; comptes: VueSourceClaude[]; apiCleePosee: boolean }> {
  const reglage = await lireReglageSourcesClaude();
  const instant = maintenant();
  const comptes: VueSourceClaude[] = [];
  for (const id of reglage.ordre) {
    const def = SOURCES_ABONNEMENT.find((x) => x.id === id)!;
    const marque = await lireParametre<Marque | null>(paramEpuise(id), null);
    const jour = await jourRenouvellement(id);
    comptes.push({ source: id, libelle: def.libelle, clePosee: !!cleDeLaSource(id, env), epuisee: epuiseeMaintenant(marque, instant, jour), epuiseDepuis: marque?.depuis ?? null, jourRenouvellement: jour, debutPeriode: debutPeriode(instant, jour), desactive: reglage.desactives.includes(id) });
  }
  return { reglage, comptes, apiCleePosee: !!cleDeLaSource("api", env) };
}
