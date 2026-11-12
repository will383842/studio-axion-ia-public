/**
 * Plan éditorial : types (PURS). Le créneau est stocké en UTC (ISO 8601) ; l'affichage se fait en Europe/Paris.
 * L'usine propose ; seul le Studio programme, publie ou constate un échec.
 */
import type { IdReseau } from "../types";

export type StatutPlan = "propose" | "a_valider" | "valide" | "programme" | "publie" | "echec" | "archive";

/** Qui écrit : l'usine ne produit que des propositions ; le Studio (le fondateur) décide et publie. */
export type AuteurPlan = "usine" | "studio";

/** Origine d'une entrée du calendrier : une seule définition. « vous » = le fondateur ; « usine » = proposée par l'usine (le stratège vit dans l'usine). */
export type OrigineEntree = "vous" | "usine";

export interface CreneauEditorial {
  id: string;
  /** Jour visé, AAAA-MM-JJ (jour de Paris). */
  jourVise: string;
  /** Heure de publication par réseau : instant ISO en UTC (se termine par « Z »). */
  heuresParReseau: Partial<Record<IdReseau, string>>;
  /** Compte cible (identifiant du compte de publication). */
  compteCible: string;
  /** Repère et signature posés par l'usine (optionnels). */
  repereUsine?: string;
  signatureUsine?: string;
  /** Une vidéo OU un visuel, jamais les deux. */
  videoId?: string;
  visuelId?: string;
  statut: StatutPlan;
  /** Nombre de décalages subis ; ne diminue jamais. */
  decalages: number;
  /** Origine de l'entrée (facultative pour les entrées existantes). */
  origine?: OrigineEntree;
  /** Validation par le fondateur (instant ISO UTC, auteur) : seule porte vers « valide ». */
  valideeLe?: string;
  valideePar?: string;
  /** Refus : l'entrée est archivée, jamais supprimée. Le motif est facultatif. */
  refuseLe?: string;
  motifRefus?: string;
}

export type ResultatTransition = { ok: true; creneau: CreneauEditorial } | { ok: false; raison: string };
