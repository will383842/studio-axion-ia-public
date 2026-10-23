import type { ModeTexte } from "./visuel";
import type { StatutVisuel } from "./statuts";
import type { CarrouselSpecType } from "./types";

export type DemandeTexteCarrousel = { type: "sujet"; sujet: string } | { type: "paquet-session"; contenu: string };

export interface ReponseTexteCarrousel {
  titre: string;
  spec: unknown;
  pourquoi: string[];
  mode: ModeTexte;
}

export interface FournisseurTexteCarrousel {
  readonly mode: ModeTexte;
  ecrire(d: DemandeTexteCarrousel): Promise<ReponseTexteCarrousel>;
}

export type NiveauControle = "vert" | "orange" | "rouge";

export interface ControlePorte {
  code: string;
  niveau: "orange" | "rouge";
  phrase: string;
  page?: number;
  chemin?: string;
}

export interface RapportPorte {
  version: "porte-carrousel/1";
  verdict: NiveauControle;
  controles: ControlePorte[];
  corrections: string[];
}

export interface ContextePorte {
  interditsDans: (texte: string) => string[];
  /** Faux tant que la liste de faits n'est pas validée : tout chiffre est alors rouge. */
  faitsDisponibles: boolean;
}

export type Porte = (spec: unknown, ctx: ContextePorte) => { rapport: RapportPorte; specCorrige?: CarrouselSpecType };

export type ActionCarrousel = "valider" | "refuser" | "refaire" | "relancer_rendu" | "corbeille" | "restaurer";

export interface VueCarrouselCarte {
  id: string;
  titre: string;
  statut: StatutVisuel;
  libelleStatut: string;
  verdict?: NiveauControle;
  nbPages: number;
  vignetteUrl?: string;
  modifieLe: string;
  joursRestantsCorbeille?: number;
}

export interface VueCarrouselFiche extends VueCarrouselCarte {
  modeTexte: ModeTexte;
  pourquoi: string[];
  rapport?: RapportPorte;
  pages: { index: number; type: string; urlX1?: string; urlX2?: string }[];
  pdfUrl?: string;
  erreur?: string;
  actionsPermises: ActionCarrousel[];
  generateurAllume: boolean;
}

export const CODES_ERREUR_VISUELS = [
  "GENERATEUR_ETEINT",
  "API_PAYANTE_VERROUILLEE",
  "SESSION_ATTENDUE",
  "PAQUET_INVALIDE",
  "SUJET_INVALIDE",
  "TRANSITION_REFUSEE",
  "CORBEILLE_REFUSEE",
  "INTROUVABLE",
] as const;
