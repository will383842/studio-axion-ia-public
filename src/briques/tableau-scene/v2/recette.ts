/**
 * RECETTE DE COMPOSITION DU STYLE « blocs/2 » (complément de `RECETTE_COMPOSITION_TABLEAU` de la fabrication) : la
 * tenue de l'écran de fin, son fondu d'image, et les bruitages déclarés par le plan des scènes. Côté studio seulement
 * (n'est pas lu par `studio-rendu`).
 *
 * `bruitagesVideoV2` donne la liste des bruitages d'une vidéo (instant, famille, gain, fichier) à partir des propriétés
 * de ses scènes : la même que celle que chaque scène calcule pour elle-même (`planifierEcranV2`). Le mixage (piste des
 * bruitages sous la voix) reste à brancher dans la fabrication (voir la PR « style v2 »).
 */
import type { RecetteComposition } from "../../composition/recette";
import { SONS_TABLEAU } from "../../../donnees/bruitages";
import type { ProprietesTableauScene } from "../types";
import { planifierEcranV2, REGLAGES_ANIMATION_V2 } from "./animation";
import { FIN_V2 } from "./charte";
import type { FamilleBruitageV2 } from "./types";

/** Le complément de recette du style « blocs/2 ». */
export const RECETTE_STYLE_BLOCS_2: Required<Pick<RecetteComposition, "finTenue" | "bruitagesPlan">> = Object.freeze({
  finTenue: Object.freeze({ apresVoixSec: FIN_V2.tenueApresVoixMs / 1000, fonduImageSec: FIN_V2.fonduImageMs / 1000 }),
  bruitagesPlan: Object.freeze({
    sons: Object.freeze(Object.fromEntries(SONS_TABLEAU.map((s) => [s.famille, Object.freeze({ cleStockage: s.cleStockage, gainDb: s.gainDb })]))),
    sousVoixDbMin: 18,
    ecartMemeFamilleSec: REGLAGES_ANIMATION_V2.ecartFamilleMinMs / 1000,
    musique: false as const,
  }),
});

export interface BruitagePose {
  /** Instant (s, horloge de la vidéo). */
  sec: number;
  famille: FamilleBruitageV2;
  cleStockage: string;
  gainDb: number;
  /** Ce qui le déclenche (trait, forme). */
  source: string;
}

/** Bruitages d'une vidéo du style « blocs/2 », dans l'ordre du temps (sans doublon d'un écran vu par deux scènes). */
export function bruitagesVideoV2(scenes: readonly ProprietesTableauScene[]): BruitagePose[] {
  const vus = new Set<string>();
  const res: BruitagePose[] = [];
  for (const p of scenes) {
    const v = p.v2;
    if (!v) continue;
    for (const e of v.ecrans) {
      if (vus.has(e.id)) continue;
      vus.add(e.id);
      const plan = planifierEcranV2({ ecran: e, geometrie: v.geometrie, debutMs: v.temps[e.id].debutMs, finMs: v.temps[e.id].finMs, heures: v.heures, finVoixMs: v.finVoixMs, ...(v.mots ? { mots: v.mots } : {}), stylo: p.stylo });
      for (const s of plan.sons) {
        const son = RECETTE_STYLE_BLOCS_2.bruitagesPlan.sons[s.famille];
        res.push({ sec: +(s.ms / 1000).toFixed(3), famille: s.famille, cleStockage: son.cleStockage, gainDb: son.gainDb, source: s.source });
      }
    }
  }
  return res.sort((a, b) => a.sec - b.sec);
}
