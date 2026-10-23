/**
 * STOCK DE CAS PAR MÉTIER (lot K1). Charge `stock.json` UNE fois, au chargement du module, et expose :
 *   - CAS_STOCK : les cas valides, dans l'ordre du fichier (l'import les range par numéro de fiche) ;
 *   - RANGEMENT : leur rangement, par id de cas ;
 *   - REFUSES_STOCK : les lignes écartées avec leurs raisons (jamais affichées comme des cas) ;
 *   - estCasStock(id).
 * Les cas du stock ne sont montrés que si le réglage `casConcret.stockMetiers` est allumé (éteint par défaut, aucun code
 * ne l'allume : voir `casVisibles`). Fichier vide au départ.
 */
import type { CasConcret } from "../cas";
import { CATALOGUE_TS } from "../catalogue/base";
import { chargerStock, type RefusStock } from "./charger";
import type { Rangement } from "./schema";
import brut from "./stock.json";

const lignesBrutes = (brut as { cas?: unknown } | null)?.cas;
const charge = chargerStock(Array.isArray(lignesBrutes) ? lignesBrutes : [], { ids: CATALOGUE_TS.map((c) => c.id), mots: CATALOGUE_TS.map((c) => c.mot) });

export const CAS_STOCK: readonly CasConcret[] = charge.cas;
export const RANGEMENT: Readonly<Record<string, Rangement>> = charge.rangement;
export const REFUSES_STOCK: readonly RefusStock[] = Array.isArray(lignesBrutes)
  ? charge.refuses
  : [{ fiche: "stock.json", raisons: ["le fichier n'a pas de tableau « cas » : aucun cas du stock n'est chargé"] }, ...charge.refuses];

const IDS_STOCK: ReadonlySet<string> = new Set(CAS_STOCK.map((c) => c.id));
export const estCasStock = (id: string): boolean => IDS_STOCK.has(id);
