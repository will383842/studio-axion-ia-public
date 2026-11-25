/**
 * BOUCLE-TABLEAU-a (X1-18) : décision PURE « ce tableau peut-il finir en boucle ? », via la règle commune `deciderBoucle`.
 * Sans horloge, sans hasard, sans service ; ne lève jamais, n'altère pas l'entrée. Aucun appelant : éteint (la fiche b le branchera).
 */
import { deciderBoucle, type DecisionBoucle, type SceneBoucle } from "@/briques/fins/boucle";
import { estStyleTableau } from "@/briques/tableau-scene/trois-styles/styles";
import { estStyleReference1, estStyleReference2, estStyleReference3, type FicheTableau } from "./fiche";

type FicheStyle = Pick<FicheTableau, "habillage" | "styleTableau">;
type SceneCalee = { debutMs: number; finMs: number };

export type DecisionBoucleTableau = DecisionBoucle | { boucle: false; raison: "fin-a-montrer" | "style-non-liste" };

/** Style de boucle de la fiche (reference/1, /2, /3, ou tableau/<style> pour reference/3), `null` pour tout autre style. */
export function styleBoucleTableau(fiche: FicheStyle): string | null {
  if (estStyleReference1(fiche)) return "reference/1";
  if (estStyleReference2(fiche)) return "reference/2";
  if (estStyleReference3(fiche)) return estStyleTableau(fiche.styleTableau) ? `tableau/${fiche.styleTableau}` : "reference/3";
  return null;
}

/** Une scène « tableau » par scène calée (jamais de visage), même fond, entrée sur page vide. */
export function scenesBoucleDeTableau(style: string, scenes: readonly SceneCalee[]): SceneBoucle[] {
  return scenes.map((s) => ({ type: "tableau", debutMs: s.debutMs, finMs: s.finMs, fond: style, etatEntree: `${style}|page-vide` }));
}

export function decisionBoucleTableau(e: { fiche: FicheStyle; scenes: readonly SceneCalee[]; finAMontrer: boolean }): DecisionBoucleTableau {
  if (e.finAMontrer) return { boucle: false, raison: "fin-a-montrer" };
  const style = styleBoucleTableau(e.fiche);
  if (style === null) return { boucle: false, raison: "style-non-liste" };
  return deciderBoucle(scenesBoucleDeTableau(style, e.scenes));
}
