/**
 * Contrat de l'habillage commun (C6-H0) : types et plafonds de repli. PUR : aucun import par alias
 * (le dossier `src/briques/motion/**` est lu par le rendu). Rien ne lit ces types encore ; tout est éteint par défaut.
 */
import type { PlanValide } from "../../plan-scenes/schema";
import type { FormeRaccord } from "./raccord-forme";

/** Identifiant de transition. Union vide d'effet : rien ne la lit ; C6-H1 la complète avec les 14 identifiants. */
export type IdTransition = string & { readonly __idTransition?: never };

export type Emprise = "boite" | "plein-cadre";
export type SensTransition = "entree" | "sortie";

export interface PlafondsHabillage {
  transitionsRichesMax: number;
  partCoupesFranchesMin: number;
  pleinCadrePermis: boolean;
  fondsAnimes: boolean;
  lumieres: boolean;
}

/** Famille de son. Type seul, sans lien avec `DeclencheurBruitage` de `src/domaine/types.ts`. */
export type FamilleSon = string & { readonly __familleSon?: never };

export interface HabillagePlan {
  transitions?: Record<string, { entree?: IdTransition; sortie?: IdTransition }>;
  /** BR-RACCORD-FORME-a : raccord par forme posé à l'entrée d'une scène (clé = id de scène). Absent : rien n'est dessiné. */
  raccords?: Record<string, { de: FormeRaccord; vers: FormeRaccord }>;
  pleinCadrePermis: boolean;
  version: "habillage-1";
}

export type PlanHabille = PlanValide & { habillageCommun?: HabillagePlan };

/** Hypothèse Q7 ; valeur de repli ; remplacée par le profil via `plafondsDepuisProfil` (C6-H0b). */
export const PLAFONDS_PAR_DEFAUT: PlafondsHabillage = {
  transitionsRichesMax: 3,
  partCoupesFranchesMin: 0.9,
  pleinCadrePermis: false,
  fondsAnimes: false,
  lumieres: false,
};
