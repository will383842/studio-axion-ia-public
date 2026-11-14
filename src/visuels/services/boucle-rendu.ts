import type { Visuel } from "@/domaine/visuels/visuel";
import { lancerRendu, RENDU_PERIME_MS, type DependancesCarrousels } from "./carrousels";

/**
 * L2-04 : reprise, par la boucle et sans clic, des rendus de carrousels restés « en cours » depuis plus de RENDU_PERIME_MS.
 * `lancerRendu` est injecté (aucun appel réel dans les tests) ; il garde seul la règle du jeton et de l'interrupteur.
 * Un visuel récent n'est jamais relancé ; la corbeille et les autres statuts sont ignorés. Un échec n'arrête pas les suivants.
 * Format : le carrousel LinkedIn est UN SEUL document PDF (titre de document porté par `rendu-reseaux`) ; les autres réseaux
 * gardent leurs images.
 */
export async function reprendreRendusPerimes(
  deps: DependancesCarrousels,
  lancer: (id: string, deps: DependancesCarrousels) => Promise<void> = lancerRendu,
): Promise<{ repris: string[]; echecs: { id: string; erreur: string }[] }> {
  const maintenantMs = Date.parse(deps.maintenant());
  const perimes = await deps.depot.lister(
    (v: Visuel) => v.statut === "rendu_en_cours" && !v.corbeilleLe && !!v.renduDemandeLe && maintenantMs - Date.parse(v.renduDemandeLe) >= RENDU_PERIME_MS,
  );
  const repris: string[] = [];
  const echecs: { id: string; erreur: string }[] = [];
  for (const v of perimes) {
    try {
      await lancer(v.id, deps);
      repris.push(v.id);
    } catch (e) {
      echecs.push({ id: v.id, erreur: e instanceof Error ? e.name : "erreur" });
    }
  }
  return { repris, echecs };
}

/** Point d'entrée de la boucle : dépendances réelles, chargées à la demande. */
export async function reprendreRendusDeLaBoucle(): Promise<void> {
  const { dependancesCarrousels } = await import("./production");
  await reprendreRendusPerimes(dependancesCarrousels());
}
