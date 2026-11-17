/**
 * Note d'intérêt, moments et étiquettes (X4-01) : TYPES SEULS, aucun comportement.
 * Brique pure, côté Studio seulement, jamais importée par `studio-rendu/**`. Aucune date du jour, aucun hasard.
 */
import type { TypeAutomatisation } from "@/domaine/ciblage/types";
import type { Ratio } from "@/domaine/types";

export type OrigineMoment = "parole" | "scene" | "ecran-demo" | "capture-cas" | "prise-v4";

export type Montre = "interface" | "chiffre" | "demarche" | "geste" | "texte" | "visage" | "inconnu";

export type SujetExtrait = TypeAutomatisation | "appels-offres";

export type UsageExtrait = "telephone" | "ecran" | "fond" | "preuve-chiffree";

export interface Moment {
  id: string;
  origine: OrigineMoment;
  debutSec: number;
  finSec: number;
  montre: Montre;
  texte?: string;
  avecVisage: boolean;
  texteIncruste: boolean;
  sourceCle?: string;
  ratio?: Ratio;
  pieces?: string[];
}

export interface NoteMoment {
  note: number;
  raisons: { code: string; points: number }[];
  sujet: SujetExtrait | null;
  usages: UsageExtrait[];
  decision: "garde" | "peut-etre" | "ignore";
}

export interface ResultatTri {
  gardes: (Moment & NoteMoment)[];
  peutEtre: (Moment & NoteMoment)[];
  ignores: { nombre: number; raisonPrincipale: string | null };
  rienARetenir: boolean;
}
