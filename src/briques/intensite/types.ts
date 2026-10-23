/**
 * CHEF D'ORCHESTRE DE L'INTENSITÉ — types et constantes FIGÉS par l'architecte le 02/10
 * (`docs/LOT-INTENSITE-CREDITS-EXECUTION.md` §2 ; consigne `INTENSITE-ET-BRUITAGES.md` §1). Propriétaire : D1.
 *
 * Une courbe d'intensité UNIQUE, calculée après le découpage en plans, que TOUS les effets consultent avant de se
 * placer : coupes, recadrages, zooms, illustrations, incrustations, sous-titres Impact et Bandeau, soulignés, bruitages,
 * second angle. Brique commune, PURE, sans aucun format : le niveau vient de la commande, les demandes des moteurs.
 * Ce fichier ne change que par ajout pur facultatif en fin d'interface (signalé dans le rapport).
 */
import type { NiveauIntensite, RapportIntensite } from "@/domaine/types";

export type { NiveauIntensite, RapportIntensite };

/** Chaque effet que l'orchestrateur arbitre. */
export type TypeEffet =
  | "coupe"
  | "poitrine"
  | "zoom-lent"
  | "illustration"
  | "incrustation"
  | "impact"
  | "bandeau"
  | "souligne"
  | "bruitage"
  | "second-angle";

/** Poids de chaque effet (consigne §1). */
export const POIDS_EFFETS: Readonly<Record<TypeEffet, number>> = {
  coupe: 1,
  poitrine: 1,
  "zoom-lent": 0.5,
  illustration: 2,
  incrustation: 2,
  impact: 3,
  bandeau: 2,
  souligne: 1,
  bruitage: 1,
  "second-angle": 1,
};

/** Plafond de la charge d'une fenêtre glissante de 3 s, selon l'intensité choisie. */
export const PLAFOND_PAR_NIVEAU: Readonly<Record<NiveauIntensite, number>> = { sobre: 3, equilibre: 5, "tres-dynamique": 7 };

/** Règles chiffrées (consigne §1) : fenêtre, effet « fort », respiration, accroche. */
export const REGLES_INTENSITE = {
  fenetreSec: 3,
  /** Un effet est « fort » à partir de ce poids : au plus un fort à la fois. */
  poidsFort: 2,
  /** Respiration après un effet fort : aucun autre effet fort pendant ce temps. */
  respirationApresFortSec: 1.5,
  /** Accroche : priorité aux effets qui commencent avant cet instant. */
  accrocheSec: 2,
  /** Pas d'échantillonnage de la courbe (rapport). */
  pasCourbeSec: 0.5,
} as const;

/**
 * Priorité d'une demande. « verrouille » : choix de Will, passe TOUJOURS (le reste s'adapte autour) ;
 * « accroche » (0-2 s) et « relance » (relances du script) passent avant « normale ».
 */
export type PrioriteEffet = "verrouille" | "accroche" | "relance" | "normale";

/** Ce qu'une brique ou un moteur DEMANDE de placer. */
export interface DemandeEffet {
  /** Identifiant stable (ex. `plan-4:zoom-lent`, `st-12:impact`, `bruitage:chiffre:3`). */
  id: string;
  type: TypeEffet;
  debutSec: number;
  finSec: number;
  priorite: PrioriteEffet;
  /** Décalage admis (s, des deux côtés) avant de sauter l'effet ; 0 ou absent : jamais décalé. */
  decalageMaxSec?: number;
  /** Qui l'a demandé (journal, tests) : `decoupage`, `sous-titres`, `incrustations`, `bruitages`… */
  origine: string;
  planId?: string;
  /** D1 (02/10, ajout pur) : sens du décalage admis (absent : « les-deux »). Une incrustation ne recule jamais avant son plan. */
  decalageSens?: "les-deux" | "plus-tard" | "plus-tot";
}

/** Ce que l'orchestrateur décide pour chaque demande. */
export interface DecisionEffet {
  id: string;
  decision: "garde" | "decale" | "saute";
  /** Instants retenus (égaux à la demande si « garde »). */
  debutSec: number;
  finSec: number;
  /** En français, court (« deux effets forts en même temps », « plafond de la fenêtre atteint »). */
  raison?: string;
}

export interface OptionsOrchestration {
  niveau: NiveauIntensite;
  dureeSec: number;
  /** Instants des relances du script (s) : priorité « relance » autour d'eux. */
  relancesSec?: number[];
}

export interface ResultatOrchestration {
  decisions: DecisionEffet[];
  rapport: RapportIntensite;
}

/**
 * Signature figée de l'orchestrateur (D1 l'écrit dans `briques/intensite/orchestrateur.ts`). PURE et déterministe :
 * mêmes demandes, mêmes décisions. Garantit : aucune fenêtre de 3 s au-dessus du plafond, au plus un effet fort à la
 * fois, respiration de 1,5 s après un effet fort ; un « verrouille » n'est jamais décalé ni sauté.
 */
export type OrchestrerIntensite = (demandes: DemandeEffet[], options: OptionsOrchestration) => ResultatOrchestration;

/* --- Bruitages modernes (consigne §2) : règles chiffrées, figées ---------------------------------------------- */

/** Bruitage placé par D1 (`briques/intensite/bruitages.ts`), passé à la brique composition pour le mixage. */
export interface BruitagePlace {
  elementId: string;
  declencheur: import("@/domaine/types").DeclencheurBruitage;
  debutSec: number;
  dureeSec: number;
  /** Gain appliqué au son (dB, négatif) : 18 à 24 dB sous la voix. */
  gainDb: number;
  planId?: string;
}

export const REGLES_BRUITAGES = {
  /** Sous la voix, en dB (le mixage vise le milieu). */
  sousVoixDb: [18, 24] as const,
  /** Coupe des graves sous cette fréquence. */
  passeHautHz: 120,
  /** Au plus un bruitage par intervalle (s). */
  intervalleMinSec: 10,
  /** Aucun bruitage dans la dernière seconde. */
  pasDansDerniereSec: 1,
  /** Jamais PENDANT le mot clé : légèrement avant ou après (s). */
  ecartMotCleSec: 0.12,
  /** Durée maximale par déclencheur (ms). */
  dureeMaxMs: { chiffre: 150, document: 400, telephone: 400, "illustration-forte": 300, impact: 200 } as const,
  /** Variantes attendues par son, tirées sans répétition consécutive. */
  variantes: [3, 5] as const,
} as const;
