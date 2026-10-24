import type { ModeTexte, MotifRefus } from "./visuel";
import type { StatutVisuel } from "./statuts";
import type { CarrouselSpecType } from "./types";

export type DemandeTexteCarrousel = { type: "sujet"; sujet: string; version?: number } | { type: "paquet-session"; contenu: string };

export interface ReponseTexteCarrousel {
  titre: string;
  spec: unknown;
  pourquoi: string[];
  mode: ModeTexte;
  /** Explication à montrer sur la fiche (simulation : sujet non repris comme titre). */
  note?: string;
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
  /** Pages du texte écrit quand aucune n'est gardée (bloqué par la porte) : « 3 pages, non rendues ». */
  pagesTexte?: number;
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
  /** L'adresse du PDF l'enregistre au lieu de l'ouvrir (sinon : nouvel onglet). */
  pdfTelechargement: boolean;
  erreur?: string;
  /** D'où vient le texte : un sujet (« Refaire » possible) ou un texte déposé (on dépose un texte corrigé). */
  entree: "sujet" | "session";
  /** Texte écrit ou rendu demandé il y a moins de RENDU_PERIME_MS : la page s'actualise, pas de relance. */
  renduEnCours: boolean;
  noteTexte?: string;
  refus: { motif: MotifRefus; libelleMotif: string; page?: number; commentaire?: string; le: string }[];
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
