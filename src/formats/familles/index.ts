/**
 * FAMILLES DE FORMATS ET HÉRITAGE (générateur, plan v5 B.4.0, B.0 n° 30). PUR : importable côté client.
 *
 * Un format hérite de la recette de sa famille et ne déclare que ses différences. `resoudreRecette(format)` fusionne
 * famille + différences : une valeur du format REMPLACE celle de la famille, tableaux compris (ils ne s'additionnent
 * jamais : un test fige ce comportement). Le générateur central ne lit QUE la recette résolue.
 */
import type { Emotion, ModeDeclinaison, ModeDiction, PointDeVue } from "@/domaine/types";
import type { DefinitionFormat, FamilleFormat, RecetteScript, StructureRecette } from "../types";
import type { RecetteFamille } from "./types";
import { recetteAutre } from "./autre";
import { recetteConversation } from "./conversation";
import { recetteEcranPartage } from "./ecran-partage";
import { recetteFaceCamera } from "./face-camera";
import { recetteMotion } from "./motion";
import { recetteTemoignage } from "./temoignage";
import { recetteUgc } from "./ugc";

export type { RecetteFamille } from "./types";

export const RECETTES_FAMILLES: Readonly<Record<FamilleFormat, RecetteFamille>> = {
  "face-camera": recetteFaceCamera,
  conversation: recetteConversation,
  ugc: recetteUgc,
  temoignage: recetteTemoignage,
  "ecran-partage": recetteEcranPartage,
  motion: recetteMotion,
  autre: recetteAutre,
};

/** Débits par mode (mots/s, B.0 n° 1) quand ni la famille ni le format n'en déclarent ; `avatar` = `motsParSeconde`. */
export const DEBITS_PAR_DEFAUT: Readonly<Record<Exclude<ModeDiction, "avatar">, number>> = { teleprompteur: 2.9, trame: 2.9, "voix-off": 2.6 };

/** Parties d'une version par réseau quand rien n'est déclaré : les blocs d'ouverture et de fin les plus courants. */
const PARTIES_PAR_DEFAUT = { ouverture: ["accroche", "promesse"], fin: ["appel", "boucle"] };

const EMOTIONS: Emotion[] = ["surprise", "agacement", "soulagement", "fierte", "inquietude-maitrisee"];
const POINTS_DE_VUE: PointDeVue[] = ["je", "nous-clients", "vous", "un-dirigeant"];

/** Recette complète, telle que le générateur la lit. */
export interface RecetteResolue extends RecetteScript {
  famille: FamilleFormat;
  declinaison: ModeDeclinaison;
  version: number;
  debitParMode: Record<ModeDiction, number>;
  modesDiction: ModeDiction[];
  modeParDefaut: ModeDiction;
  structures: StructureRecette[];
  annotationsReservees: RecetteScript["annotations"];
  segmentsFacultatifsMax: number;
  exceptionObligatoire: boolean;
  emotionsPermises: Emotion[];
  pointsDeVuePermis: PointDeVue[];
  partiesDeclinaison: { ouverture: string[]; fin: string[] };
}

/** Garde seulement les champs RÉELLEMENT déclarés (une valeur `undefined` ne remplace rien). */
function declares<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Famille dont hérite un format : `recetteScript.herite`, sinon `DefinitionFormat.famille`. */
export function familleDe(format: Pick<DefinitionFormat, "famille" | "recetteScript">): FamilleFormat {
  return format.recetteScript.herite ?? format.famille;
}

/** Famille + différences du format → recette complète (B.4.0). Les tableaux REMPLACENT. */
export function resoudreRecette(format: Pick<DefinitionFormat, "famille" | "recetteScript" | "declinaison">): RecetteResolue {
  const famille = familleDe(format);
  const { famille: _f, declinaison: declinaisonFamille, ...base } = RECETTES_FAMILLES[famille];
  void _f;
  const fusion = { ...declares(base), ...declares(format.recetteScript) } as RecetteScript & Partial<RecetteResolue>;
  const modesDiction = fusion.modesDiction?.length ? fusion.modesDiction : (["avatar"] as ModeDiction[]);
  const debitParMode: Record<ModeDiction, number> = {
    avatar: fusion.debitParMode?.avatar ?? format.recetteScript.motsParSeconde,
    teleprompteur: fusion.debitParMode?.teleprompteur ?? DEBITS_PAR_DEFAUT.teleprompteur,
    trame: fusion.debitParMode?.trame ?? DEBITS_PAR_DEFAUT.trame,
    "voix-off": fusion.debitParMode?.["voix-off"] ?? DEBITS_PAR_DEFAUT["voix-off"],
  };
  return {
    ...fusion,
    famille,
    declinaison: format.declinaison ?? declinaisonFamille,
    version: fusion.version ?? 1,
    debitParMode,
    modesDiction,
    modeParDefaut: fusion.modeParDefaut && modesDiction.includes(fusion.modeParDefaut) ? fusion.modeParDefaut : modesDiction[0],
    structures: fusion.structures ?? [],
    annotationsReservees: fusion.annotationsReservees ?? [],
    segmentsFacultatifsMax: fusion.segmentsFacultatifsMax ?? 0,
    exceptionObligatoire: fusion.exceptionObligatoire ?? true,
    emotionsPermises: fusion.emotionsPermises ?? EMOTIONS,
    pointsDeVuePermis: fusion.pointsDeVuePermis ?? POINTS_DE_VUE,
    partiesDeclinaison: fusion.partiesDeclinaison ?? PARTIES_PAR_DEFAUT,
  };
}
