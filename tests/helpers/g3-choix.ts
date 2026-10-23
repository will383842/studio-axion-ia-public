/** Entrée du choix conjoint pour les tests G3 (registre « fin des Excel » transposé, recette avocat v4). */
import type { EntreeChoix } from "@/generateur/choix-combinaison";
import { M, MAINTENANT, P, PARAMS, RECETTE } from "./g3";

export function entreeChoix(p: Partial<EntreeChoix> = {}, brief: Partial<EntreeChoix["brief"]> = {}): EntreeChoix {
  return {
    maintenant: MAINTENANT,
    brief: { idee: "Remplacer Excel par un tableau de bord", pilier: "donnees", motsCles: ["remplacer Excel"], reseaux: ["tiktok", "linkedin"], objectif: "notoriete", ...brief },
    quiParleWill: false,
    debit: 4.4,
    matieres: Object.values(M),
    preuves: Object.values(P),
    structures: RECETTE.structures,
    pointsDeVueParType: PARAMS.pointsDeVueParType,
    pointsDeVuePermis: RECETTE.pointsDeVuePermis,
    emotionsPermises: RECETTE.emotionsPermises,
    conditionsEmotions: PARAMS.conditionsEmotions,
    famillesAccroche: PARAMS.accroches.filter((a) => RECETTE.famillesAccrochePermises.includes(a.id)).map((a) => ({ id: a.id, exige: a.exige, plafond: a.plafond })),
    series: {},
    usagesMatieres: {},
    sujetsValides: 0,
    modeRotation: "normal",
    termesVagues: ["outil adapté", "solution sur mesure"],
    ...p,
  };
}

