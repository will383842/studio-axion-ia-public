/**
 * STOCK DES CAS : la porte d'accès par identifiant (point de sécurité, suite de K1). `trouverCas` rend tout le catalogue, stock
 * par métier compris ; or un cas du stock n'existe que si `casConcret.stockMetiers` est allumé. Tout point d'entrée qui reçoit
 * un identifiant venu de l'extérieur (adresse directe, valider, estimer, lancer, écran fourni) passe donc par ici : réglage
 * éteint, un cas du stock est INCONNU, exactement comme avant le stock. Les 22 cas d'avant ne lisent AUCUN réglage.
 */
import "server-only";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { estCasStock, trouverCas } from "@/formats/cas-concret/catalogue";
import { REGLAGES_CAS_CONCRET, reglageAllume } from "./cas-concret-reglages";

export async function trouverCasAutorise(id: string, stockMetiersAllume: () => Promise<boolean> = () => reglageAllume(REGLAGES_CAS_CONCRET.stockMetiers)): Promise<CasConcret | undefined> {
  const cas = trouverCas(id);
  if (cas && estCasStock(cas.id) && !(await stockMetiersAllume().catch(() => false))) return undefined;
  return cas;
}
