/**
 * Brique commune « intensité » (lot du 02/10, propriétaire D1). Point d'entrée unique pour les moteurs, la brique
 * « sous-titres », la brique « composition » et les écrans : réglage global (`reglage.ts`), chef d'orchestre
 * (`orchestrateur.ts`), placement des bruitages (`bruitages.ts`) et orchestration d'un montage entier (`montage.ts`).
 * La forme des types est figée (`types.ts`).
 */
export * from "./types";
export { reglageIntensite } from "./reglage";
export { orchestrerIntensite, verifierIntensite, effetsRetenus, chargeA, rapportDe, estFort, prioriteEffective, RANG_TYPE, type EffetPlace } from "./orchestrateur";
export { GAIN_SOUS_VOIX_DB, PREFERENCE_DECLENCHEURS, choisirVariante, declencheurIllustration, dureePosee, candidatsBruitages, refusBruitage, type DeclencheurVu, type EntreePlacementBruitages } from "./bruitages";
export { orchestrerMontage, allegerStructure, avecChoixBruitages, ENTREE_BRUITAGES_PLANS, demandesDesPlans, demandesDesSousTitres, appliquerAuxPlans, appliquerAuxSousTitres, declencheursVus, INCRUSTATION_VISIBLE_MIN_SEC, type EntreeOrchestrationMontage, type SortieOrchestrationMontage } from "./montage";
