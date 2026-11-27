import type { Intention } from "../../briques/visuels/trames";
import type { Id } from "../types";
import type { OrigineUsine } from "../usine";
import type { RapportPorte } from "./contrats";
import type { CarrouselSpecType } from "./types";
import type { StatutVisuel } from "./statuts";
import type { Reseau } from "../../briques/visuels/reseaux";
import type { VersionStockee } from "./depot";
import type { ToileSpecType } from "./continu/schema-toile";

export type ModeTexte = "simulation" | "session" | "api" | "import";
export type MotifRefus = "texte" | "mise_en_page" | "sujet" | "ton" | "autre";
export const LIBELLES_MOTIF: Record<MotifRefus, string> = { texte: "Le texte", mise_en_page: "La mise en page", sujet: "Le sujet", ton: "Le ton", autre: "Autre chose" };

export interface RenduVisuel {
  empreinte: string;
  pdfCle: string;
  vignetteCle: string;
  pages: { index: number; x1Cle: string; x2Cle: string }[];
  renduLe: string;
}

export interface EpingleVisuel {
  titre: string;
  lien: string;
  texteAlternatif: string;
  /** Mention « modifié par IA » : booléen obligatoire, jamais déduit. */
  contenuIA: boolean;
  image: { cle: string; largeur: number; hauteur: number; mime: "image/jpeg" | "image/png" | "image/webp"; sha256: string; taille: number };
  /** Clé de l'épingle (anti-doublon de l'import). */
  cle: string;
}

export interface Visuel {
  /** "vis_" + crypto.randomUUID() */
  id: Id;
  famille: "carrousel" | "carrousel-continu" | "infographie" | "epingle";
  /** Réseaux visés (L1-02) ; absent sur un ancien visuel. « pinterest » seulement pour une épingle. */
  reseaux?: (Reseau | "pinterest")[];
  /** Épingle Pinterest (famille « epingle ») : titre, lien, texte alternatif (500), mention IA et l'image déposée. */
  epingle?: EpingleVisuel;
  /** Sous-type libre du classement (L1-02), 40 signes au plus ; absent sur un ancien visuel. */
  sousType?: string;
  /** Versions rendues par cadre, gardées avec le visuel (L1-02) : un rendu déjà fait n'est pas refait. */
  versions?: VersionStockee[];
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
  /** Aucun prix dans le Studio : toujours 0. */
  coutCentimes: 0;
  creeLe: string;
  modifieLe: string;
  estDemo?: boolean;
  /** Carrousel retenu depuis une carte de la semaine de l'usine (plan usine #63) : jamais validé ni programmé par ce chemin. */
  origineUsine?: OrigineUsine & { prevenueLe?: string };
  /** Jour visé par la carte retenue (AAAA-MM-JJ). */
  dateVisee?: string;
}
