import type { Id } from "../types";
import type { RapportPorte } from "./contrats";
import type { CarrouselSpecType } from "./types";
import type { StatutVisuel } from "./statuts";

export type ModeTexte = "simulation" | "session" | "api";
export type MotifRefus = "texte" | "mise_en_page" | "sujet" | "ton" | "autre";

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
  famille: "carrousel";
  /** 120 caractères au plus. */
  titre: string;
  entree: { type: "sujet"; sujet: string } | { type: "session" };
  statut: StatutVisuel;
  modeTexte: ModeTexte;
  spec?: CarrouselSpecType;
  pourquoi?: string[];
  versionSpec: number;
  rapport?: RapportPorte;
  rendu?: RenduVisuel;
  renduDemandeLe?: string;
  erreur?: string;
  refus?: { motif: MotifRefus; page?: number; commentaire?: string; le: string }[];
  valideLe?: string;
  corbeilleLe?: string;
  statutAvantCorbeille?: StatutVisuel;
  coutCentimes: 0;
  creeLe: string;
  modifieLe: string;
  estDemo?: boolean;
}
