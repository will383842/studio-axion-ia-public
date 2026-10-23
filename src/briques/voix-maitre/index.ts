/**
 * BRIQUE « VOIX MAÎTRE » (ORG-07a, U-5 partie 1) : texte validé → voix → nettoyage des blancs → son maître. Extraite du
 * moteur avocat sans réécriture ; les anciens chemins (`src/moteurs/montage-avocat/nettoyage.ts`, `index.ts`)
 * réexportent. Le calage, le report des heures et l'empreinte vivent déjà dans `calage` et `empreinte-audio`.
 */
export * from "./nettoyage";
export type * from "./types";
export * from "./voix-epinglee";
