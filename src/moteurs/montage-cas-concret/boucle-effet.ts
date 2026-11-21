/**
 * BOUCLE-EFFET-a (X1-18) : décision PURE de la fin en boucle d'un cas concret, à partir de ses écrans calés.
 * Sans horloge, sans hasard, sans serveur ; ne lève jamais. Aucun appelant : éteint (la fiche b le branchera).
 * SEUL endroit du Studio qui cite `deciderBoucle`.
 */
import { deciderBoucle, type DecisionBoucle, type SceneBoucle } from "@/briques/fins/boucle";
import type { EcranCale } from "@/briques/ecrans-motion";

/** Un écran calé donne une scène de boucle : le cas concret n'a jamais de visage (type « motion »), aucun texte. */
export function scenesBoucleDeCasConcret(cales: readonly EcranCale[]): SceneBoucle[] {
  return cales.map((e) => ({ type: "motion", debutMs: e.debutMs, finMs: e.finMs, fond: e.fond, etatEntree: `${e.type}|${e.fond}` }));
}

export function decisionBoucleCasConcret(cales: readonly EcranCale[]): DecisionBoucle {
  return deciderBoucle(scenesBoucleDeCasConcret(cales));
}

/** Copie de la recette sans la clé `finPropre` (la fin du format est dans sa ligne de temps). Entrée non modifiée. */
export function sansFinPropre<R extends { finPropre?: unknown }>(recette: R): Omit<R, "finPropre"> {
  const { finPropre: _sansFinPropre, ...reste } = recette;
  void _sansFinPropre;
  return reste;
}
