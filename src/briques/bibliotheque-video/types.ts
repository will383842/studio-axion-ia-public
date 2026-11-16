/**
 * Contrat commun du chantier 1 (PLAN-FINAL § 3.2). Les 12 réponses de Williams sont acquises.
 * Module côté Studio seulement : jamais importé par `studio-rendu/**` (§ 3, règle 13 de E1).
 * Aucun comportement.
 */
import type { Ratio } from "@/domaine/types";

/** Familles de capacité (§ 3.3, AM-12, E-4). La liste des identifiants est à C1-U1. */
export type FamilleCapacite =
  | "texte" | "ecran" | "calque" | "plan-scenes" | "transition" | "fond" | "etalonnage"
  | "son" | "motion" | "objet" | "accroche" | "rythme" | "mention" | "cadrage";

export type IdCapacite = `${FamilleCapacite}.${string}`;

/** État d'une capacité : mêmes mots que la carte de l'arbitrage. */
export type EtatCapacite = "prod" | "demande" | "eteint" | "coulisse" | "absent" | "prevu";

/** Règle d'un profil pour une capacité (§ 3.4). */
export interface RegleProfilCapacite { permis: boolean; maxParVideo?: number; decision?: string }

export interface Candidat { id: string; capacite: IdCapacite; cle: string }

export interface UsageMemoire { capacite: IdCapacite; cle: string; videoId: string; source: SourceMemoire; le: string }

export interface Choix { capacite: IdCapacite; cle: string; signature?: string }

/** Profil : les capacités, les plafonds, et un bloc typé par chantier (tous facultatifs). */
export interface ProfilVideo {
  id: string; formatId: string; version: number;
  capacites: Partial<Record<IdCapacite, RegleProfilCapacite>>;
  plafonds: { evenementsParMinute?: number; transitionsMax?: number; extraitsMax?: number };
  memoire: { fenetreVideos: number; portee: "format" | "globale" };
  verrous: string[];
  blocs?: { texteEcran?: BlocTexteEcran; extraits?: BlocExtraits; habillage?: BlocHabillage; calques?: BlocCalques };
}

/** Chantier 2 : ce que le tirage du style a le droit de choisir. */
export interface BlocTexteEcran {
  teintes: ("terracotta" | "ivoire" | "ardoise")[];
  cibles: ("souligne" | "expression" | "mot-dit")[];
  pave: boolean; outils: boolean; bandeauNom: boolean;
  intensites: string[];          // noms d'intensité de la brique des sous-titres
  signaturesAEviter: number;     // 3 : jamais une des 3 dernières signatures du format
}

/** Chantiers 3 et 4 : règles de droit des extraits. */
export interface BlocExtraits {
  visageSurInstagram: boolean;                                // Q5 : vrai
  texteIncrusteAccepte: Partial<Record<IdCapacite, boolean>>; // P-4 : faux partout par défaut
  dureeMinSec: number;                                        // 3
  uneSourceParVideo: boolean;                                 // vrai
}

/** Chantier 6 : plafonds de l'habillage (lus par l'adaptateur `plafondsDepuisProfil`). */
export interface BlocHabillage { partCoupesFranchesMin: number; pleinCadrePermis: boolean; fondsAnimes: boolean; lumieres: boolean }

/** Chantier 5. Réservé : aucune fiche ne le lit tant que V4 est suspendu. */
export interface BlocCalques { texteDerriereMax: number }           // 1, au plus 2.

/** Extrait : aligné sur la fiche du chantier 3. */
export interface CandidatExtrait extends Candidat {
  elementId: string; plageId: string;
  debutSec: number; finSec: number; ratio: Ratio;
  visage: "williams" | "aucun";          // un tiers n'est jamais candidat (plage exclue en amont)
  texteIncruste: boolean;
  famille: string[];                     // vidéos qu'il ne doit jamais illustrer
}

export const cleUsageExtrait = (elementId: string, plageId: string) => `extrait:${elementId}:${plageId}`;

/** Entrée figée : les choix faits au lancement y sont notés. */
export interface EntreeBibliotheque {
  version: "bibliotheque-video/1"; profil: ProfilVideo;
  recents: Pick<UsageMemoire, "capacite" | "cle" | "videoId">[];
  graine: string; figeeLe: string;
  choix?: Choix[];                       // ex. la signature du style de sous-titres tirée au lancement
}

/** Sources de mémoire. */
export type SourceMemoire = "bibliotheque-video" | "avocat-cartes" | "v4-familles" | "v4-extraits"
  | "cas-concret-tirages" | "tableau-styles" | "image-video-variete" | "illustrations";
