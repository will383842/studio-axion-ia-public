/** Plans de la composition d'une chaîne par scènes : une scène rendue = un plan d'illustration vidéo, bout à bout. */
import type { PlanProduit } from "@/moteurs/types";

/** Une scène rendue, pour la composition. */
export interface ScenePosee {
  id: string;
  debutSec: number;
  finSec: number;
  cle: string;
}

/** Une scène = un plan d'illustration vidéo (média `scene:<id>`), coupe franche, cadrage large fixe. */
export function plansDesScenes(scenes: readonly ScenePosee[]): PlanProduit[] {
  return scenes.map((s, i) => ({
    ordre: i + 1,
    segmentId: s.id,
    debutSec: s.debutSec,
    finSec: s.finSec,
    texte: "",
    sourceImage: "illustration",
    illustration: { source: "bibliotheque", elementId: `scene:${s.id}`, verrouille: true, candidats: [] },
    motsEnValeur: [],
    cadrage: { pointInteret: { x: 0.5, y: 0.5 }, zoom: 1, zoomFin: 1, valeur: "large" },
    transition: "coupe",
  }));
}
