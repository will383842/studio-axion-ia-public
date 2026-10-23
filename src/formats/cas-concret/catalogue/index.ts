import type { CasConcret } from "../cas";
import { CAS_STOCK, estCasStock } from "../stock-metiers";
import { CATALOGUE_TS } from "./base";

/**
 * Le catalogue : les 22 cas TypeScript (`base.ts`, dans leur ordre), puis, À LA FIN, les cas du stock par métier
 * (`stock-metiers/stock.json`, vide au départ). Les 22 gardent leur rang et leur empreinte. Les cas de la phase 2 ne sont
 * montrés par la page que si `casConcret.catalogueEtendu` est allumé (voir `casVisibles`), ceux du stock que si
 * `casConcret.stockMetiers` l'est.
 */
export const CATALOGUE: readonly CasConcret[] = [...CATALOGUE_TS, ...CAS_STOCK];

/** Les cas ajoutés par la phase 2 (les quatorze derniers des 22) : cachés par la page tant que `casConcret.catalogueEtendu` est éteint. */
const IDS_PHASE_2: ReadonlySet<string> = new Set(CATALOGUE_TS.slice(8).map((c) => c.id));

export const estCasPhase2 = (id: string): boolean => IDS_PHASE_2.has(id);

export { estCasStock };

/** Réglages qui décident des cas montrés. Éteints (ou absents) : exactement les huit cas de master. */
export interface ReglagesVisibilite {
  catalogueEtendu: boolean;
  /** Réglage `casConcret.stockMetiers` ; absent = éteint. */
  stockMetiers?: boolean;
}

/**
 * Retire de la liste les cas de la phase 2 tant que le catalogue étendu est éteint, et les cas du stock par métier tant que
 * `stockMetiers` est éteint (les cas de master restent tels quels). Les appels existants passent `{ catalogueEtendu }` :
 * leur comportement est identique à celui d'avant le stock.
 */
export function casVisibles<T extends { cas: { id: string } }>(liste: readonly T[], reglages: ReglagesVisibilite): T[] {
  return liste.filter((x) => (reglages.catalogueEtendu || !estCasPhase2(x.cas.id)) && (reglages.stockMetiers === true || !estCasStock(x.cas.id)));
}

export function trouverCas(id: string): CasConcret | undefined {
  return CATALOGUE.find((c) => c.id === id);
}
