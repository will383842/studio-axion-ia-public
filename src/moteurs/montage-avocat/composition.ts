/**
 * COMPOSITION DU FORMAT AVOCAT = la brique commune « composition » + la recette avocat.
 *
 * Depuis le 02/10, toute la mise en image (décor, double, recadrage, micro, illustrations, incrustations, encadré,
 * LUT, son, export) vit dans `@/briques/composition`, paramétrée par une RECETTE de format. Ce fichier ne fait plus
 * que lier la recette avocat (`recette-composition.ts`) aux fonctions communes, sous les noms et signatures du lot M4
 * (le moteur, les tests et `outils/demo-m4` les appellent ainsi). Rien n'y est calculé.
 */
import {
  decorScene as decorSceneCommun,
  lutDuPlan as lutDuPlanCommun,
  parametresComposition as parametresCompositionCommun,
  placerEncadre as placerEncadreCommun,
  plagesDesLuts as plagesDesLutsCommun,
  type EntreeComposition,
  type ParametresComposition,
  type RatioScene,
} from "@/briques/composition";
import type { CommandeFabrication, IdReseau } from "@/domaine/types";
import { ENCADRE_OUVERTURE_AVOCAT } from "@/formats/avocat";
import type { EncadreOuverture } from "@/formats/types";
import type { PlanProduit } from "../types";
import { DECOR_REPLI_AVOCAT, RECETTE_COMPOSITION_AVOCAT } from "./recette-composition";

export {
  basSousTitres,
  boiteEncadre,
  boiteGroupe,
  COULEURS_INCRUSTATION,
  coteContour,
  largeurInter,
  masquerMontantsDits,
  montantDit,
  partiesTitre,
  pausesDesMots,
  placerIncrustations,
  SILHOUETTE,
  type EntreeComposition,
  type ParametresComposition,
} from "@/briques/composition";
export { RECETTE_COMPOSITION_AVOCAT } from "./recette-composition";

/** Décor de repli de l'avocat (N1 Halo orange). */
export const DECOR_REPLI = DECOR_REPLI_AVOCAT;
/** Centre des sous-titres hors 9:16 (% de la hauteur) : sur la poitrine du double ancré en bas. */
export const CENTRE_SOUS_TITRES = RECETTE_COMPOSITION_AVOCAT.centreSousTitres;

type CommandeLut = Pick<CommandeFabrication, "styles" | "distribution" | "recetteMontage">;

/** LUT d'un plan (plan > vidéo > visage > format), angles par défaut de l'avocat. */
export const lutDuPlan = (c: CommandeLut, plan: Pick<PlanProduit, "lutId" | "sourceImage" | "angle">) => lutDuPlanCommun(c, plan, RECETTE_COMPOSITION_AVOCAT.angles);

/** Plages de chaque LUT sur la durée, par plan. */
export const plagesDesLuts = (c: CommandeLut, plans: PlanProduit[]) => plagesDesLutsCommun(c, plans, RECETTE_COMPOSITION_AVOCAT.angles);

/** Décor de la scène, repli N1 Halo orange. */
export const decorScene = (c: Pick<CommandeFabrication, "styles" | "medias">) => decorSceneCommun(c, RECETTE_COMPOSITION_AVOCAT);

type OptionsEncadre = Omit<Parameters<typeof placerEncadreCommun>[3], "encadre"> & { encadre?: EncadreOuverture };

/** Encadré d'ouverture ; sans forme donnée, celle de l'avocat (`ENCADRE_OUVERTURE_AVOCAT`). */
export const placerEncadre = (texte: string, ratio: RatioScene, reseaux: IdReseau[], options: OptionsEncadre = {}) =>
  placerEncadreCommun(texte, ratio, reseaux, { ...options, encadre: options.encadre ?? ENCADRE_OUVERTURE_AVOCAT });

/** Paramètres complets de la composition d'UN format d'image, recette avocat. */
export function parametresComposition(c: CommandeFabrication, e: EntreeComposition): ParametresComposition {
  return parametresCompositionCommun(c, e, RECETTE_COMPOSITION_AVOCAT);
}
