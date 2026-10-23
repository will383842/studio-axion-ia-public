/**
 * SOCLE QUALITÉ · adaptateur générique : des `LigneScript` (celles de « Relire le script ») vers le script normalisé.
 * Tout écrivain déjà branché sur RelireScript est presque branché sur le socle : il ne reste qu'à dire la partie de
 * chaque ligne. Sans indication, la 1re ligne est l'accroche, la dernière l'appel, le reste le corps. PUR.
 */
import type { LigneScript } from "@/domaine/relecture-script";
import type { LigneNormalisee, Partie, ScriptNormalise } from "../types";

export function depuisLignes(lignes: readonly LigneScript[], partieDe: (l: LigneScript, i: number) => Partie | null = () => null, plus: Omit<ScriptNormalise, "lignes"> = {}): ScriptNormalise {
  const dites = lignes.filter((l) => l.dit.trim());
  const n = dites.length;
  return {
    ...plus,
    lignes: dites.map((l, i): LigneNormalisee => ({ ...l, partie: partieDe(l, i) ?? (i === 0 ? "accroche" : i === n - 1 && n > 1 ? "appel" : "corps") })),
  };
}
