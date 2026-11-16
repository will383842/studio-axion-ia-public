/**
 * Archive des vidéos livrées (C3-UT-3.1) : TYPES SEULS de la fiche « source-extraits » d'une vidéo.
 * Aucun service, aucune mémoire d'usage (P-3) : ni `derniereVideoId`, ni `dernierRangVideo`, ni `utilisations`, ni `decoupes`.
 * Durée utile pour le chantier 4 : 3 s au moins.
 */
import type { Id, Licence, Ratio } from "./types";
import type { OrigineMoment } from "@/briques/note-extraits";

/** Au plus 30 plages par fiche. */
export const PLAGES_MAX_PAR_FICHE = 30;
/** Une fiche sérialisée ne dépasse pas 30 000 caractères. */
export const TAILLE_MAX_FICHE_CARACTERES = 30000;

export type EtatPlageExtrait = "utilisable" | "exclue" | "ecartee" | "a_verifier";

/** Une plage d'une vidéo livrée, candidate à servir d'extrait. */
export interface PlageExtrait {
  id: string;
  debutSec: number;
  finSec: number;
  texte: string;
  motsCles: string[];
  avecVisage: boolean;
  texteIncruste: boolean;
  etat: EtatPlageExtrait;
  /** Renseignée quand l'état n'est pas « utilisable ». */
  raisonExclusion?: string;
  ecarteeLe?: string; // gestes de Williams, jamais réécrits par la tâche
  valideeLe?: string;
  // X4-08 : champs facultatifs de la note. Absent = fiche sans note (chantier 3 seul). Lus par personne tant que X4-10 n'est pas allumée.
  origine?: OrigineMoment;
  note?: number;
  raisonsNote?: { code: string; points: number }[];
  sujet?: string;
  sujetCorrigeLe?: string;
  usages?: string[];
}

/** Fiche d'une vidéo livrée. */
export interface FicheSourceExtraits {
  videoId: Id;
  versionId: Id;
  sortieId: Id;
  ratio: Ratio;
  /** Licence calculée à partir de celle de la vidéo. */
  licence: Licence;
  /** Vidéos que ces extraits ne doivent jamais illustrer. */
  famille: string[];
  plages: PlageExtrait[];
  /** Vidéo rangée dans l'archive. */
  rangee: boolean;
  /** Source préférée pour cette vidéo (une source par vidéo). */
  sourcePreferee: boolean;
  // X4-08 : champs facultatifs de la note. Absent = fiche sans note (chantier 3 seul).
  ignores?: { nombre: number; raisonPrincipale: string | null };
  rienARetenir?: boolean;
  chiffresReels?: boolean;
  noteVersion?: string;
  /** Lu par X4-11. */
  attentePublication?: boolean;
}
