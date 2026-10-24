import type { Intention } from "../../briques/visuels/trames";
import type { Id } from "../types";
import type { RapportPorte } from "./contrats";
import type { CarrouselSpecType } from "./types";
import type { StatutVisuel } from "./statuts";
import type { ToileSpecType } from "./continu/schema-toile";

export type ModeTexte = "simulation" | "session" | "api";
export type MotifRefus = "texte" | "mise_en_page" | "sujet" | "ton" | "autre";
export const LIBELLES_MOTIF: Record<MotifRefus, string> = { texte: "Le texte", mise_en_page: "La mise en page", sujet: "Le sujet", ton: "Le ton", autre: "Autre chose" };

export interface RenduVisuel {
  empreinte: string;
  pdfCle: string;
  vignetteCle: string;
  pages: { index: number; x1Cle: string; x2Cle: string }[];
  renduLe: string;
}

export interface Visuel {
  /** "vis_" + crypto.randomUUID() */
  id: Id;
  famille: "carrousel" | "carrousel-continu";
  /** 120 caractères au plus. */
  titre: string;
  /** `intention` (L12, facultative) : choisit la trame du carrousel ; absente, rien ne change. */
  entree: { type: "sujet"; sujet: string; intention?: Intention } | { type: "session" };
  statut: StatutVisuel;
  modeTexte: ModeTexte;
  spec?: CarrouselSpecType;
  toile?: ToileSpecType;
  renduToile?: { empreinte: string; format: "4:5" | "3:4"; pages: { index: number; cle: string }[]; bandeCle: string; vignetteCle: string; renduLe: string };
  /** Nombre de pages du texte écrit, gardé même quand la porte le refuse (le spec, lui, n'est alors pas gardé). */
  pagesTexte?: number;
  pourquoi?: string[];
  versionSpec: number;
  rapport?: RapportPorte;
  rendu?: RenduVisuel;
  renduDemandeLe?: string;
  erreur?: string;
  /** Explication affichée sur la fiche (ex. simulation : pourquoi le sujet n'a pas été repris comme titre). */
  noteTexte?: string;
  refus?: { motif: MotifRefus; page?: number; commentaire?: string; le: string }[];
  valideLe?: string;
  corbeilleLe?: string;
  statutAvantCorbeille?: StatutVisuel;
  coutCentimes: 0;
  creeLe: string;
  modifieLe: string;
  estDemo?: boolean;
}
