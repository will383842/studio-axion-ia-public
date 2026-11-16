/**
 * FIN EN BOUCLE PARFAITE (X1-11, décision E1-4 : sans visage seulement). PUR, sans alias « @/ », sans horloge ni hasard.
 * Décide si une vidéo peut boucler : aucun plan avec visage dans la première et la dernière seconde, même fond aux deux
 * bouts ; rend le raccord (la dernière scène reprend l'état d'entrée de la première). Éteint : rien ne l'appelle.
 */

export type TypeSceneBoucle = "face-camera" | "motion" | "tableau" | "image-video";

export interface SceneBoucle {
  type: TypeSceneBoucle;
  debutMs: number;
  finMs: number;
  /** Identifiant du fond de la scène. */
  fond: string;
  /** État d'entrée de la scène (ce que le spectateur voit à son premier instant). */
  etatEntree: string;
}

export const FENETRE_BOUCLE_MS = 1000;
export const DUREE_MIN_BOUCLE_MS = 2 * FENETRE_BOUCLE_MS;

export type RaisonRefusBoucle = "vide" | "trop-court" | "visage-debut" | "visage-fin" | "fond-different";

export interface RaccordBoucle {
  sceneInitiale: number;
  sceneFinale: number;
  /** La dernière scène se termine sur cet état = état d'entrée de la première. */
  etatFinal: string;
}

export type DecisionBoucle = { boucle: true; raccord: RaccordBoucle } | { boucle: false; raison: RaisonRefusBoucle };

const recouvre = (s: SceneBoucle, a: number, b: number) => s.debutMs < b && s.finMs > a;

export function deciderBoucle(scenes: readonly SceneBoucle[]): DecisionBoucle {
  if (scenes.length === 0) return { boucle: false, raison: "vide" };
  const ordre = scenes.map((_, i) => i).sort((i, j) => scenes[i].debutMs - scenes[j].debutMs || i - j);
  const debut = Math.min(...scenes.map((s) => s.debutMs));
  const fin = Math.max(...scenes.map((s) => s.finMs));
  if (fin - debut < DUREE_MIN_BOUCLE_MS) return { boucle: false, raison: "trop-court" };
  if (scenes.some((s) => s.type === "face-camera" && recouvre(s, debut, debut + FENETRE_BOUCLE_MS))) return { boucle: false, raison: "visage-debut" };
  if (scenes.some((s) => s.type === "face-camera" && recouvre(s, fin - FENETRE_BOUCLE_MS, fin))) return { boucle: false, raison: "visage-fin" };
  const premiere = ordre[0];
  const derniere = ordre.reduce((m, i) => (scenes[i].finMs >= scenes[m].finMs ? i : m), ordre[ordre.length - 1]);
  if (scenes[premiere].fond !== scenes[derniere].fond) return { boucle: false, raison: "fond-different" };
  return { boucle: true, raccord: { sceneInitiale: premiere, sceneFinale: derniere, etatFinal: scenes[premiere].etatEntree } };
}
