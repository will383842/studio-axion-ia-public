/**
 * EFFET RÉALISTE PAR IA (lot K, décision de Will du 09/10). PUR.
 *
 * Les objets 3D composés (Three.js, lots F3 / I / I2) « ne font pas réaliste ». Après la génération de la vidéo, Will
 * peut demander au monteur une action LIBRE et réaliste (« rajoute au bon endroit un téléphone dans ma main et
 * jette-le sur l'écran ») : le passage choisi (3 à 8 s) part chez Higgsfield (Kling Omni Edit avec image de référence,
 * sinon FLUX 3 Video Edit), revient contrôlé (durée, lèvres, visage, raccords) et se repose dans la piste montée.
 * Option PAYANTE : rien ne part sans « Confirmer » (brique `options-payantes`, lot J, garde côté serveur).
 */
import type { ModeleHiggsfield } from "@/fournisseurs/higgsfield/types";

/** Durée d'un effet réaliste (s) : assez pour un geste complet, assez court pour garder le coût bas. */
export const DUREE_EFFET_MIN_SEC = 3;
export const DUREE_EFFET_MAX_SEC = 8;
export const DUREE_EFFET_DEFAUT_SEC = 5;

/** Où Will a ancré l'effet : un mot cité, un instant cité, ou « au bon endroit » (le monteur choisit). */
export type TypeAncreEffet = "mot" | "instant" | "bon-endroit";

/** Objets que l'on sait nommer en anglais et, pour certains, rendre en 3D (repli gratuit). */
export type ObjetConnu = "telephone" | "logo-axion" | "tasse" | "livre" | "stylo" | "carte-bancaire" | "cle" | "autre";

/** Un effet réaliste préparé (moment choisi, consigne vidéo écrite), en attente de « Confirmer », puis à fabriquer. */
export interface EffetRealistePrepare {
  /** Identifiant du passage dans la piste (stable : sert à reprendre un effet déjà payé). */
  id: string;
  /** Ce que Will a demandé, tel quel. */
  consigne: string;
  /** Ce que l'effet fera, en français simple (carte de confirmation). */
  description: string;
  /** Consigne envoyée au modèle vidéo (anglais, règles de préservation comprises). */
  consigneVideo: string;
  ancre: TypeAncreEffet;
  /** Mot du début du passage (index de la transcription de la prise). */
  debutMot: number;
  /** Temps de la PRISE (extraction dans la passe image). */
  debutPriseSec: number;
  finPriseSec: number;
  /** Temps de la vidéo LIVRÉE (aperçu, « Changer de moment »). */
  debutSec: number;
  finSec: number;
  dureeSec: number;
  modele: ModeleHiggsfield;
  /** Image de référence (logo Axion, objet de Mes images) : clé R2 ; absente → FLUX 3 Video Edit. */
  imageReferenceCle?: string;
  objet: ObjetConnu;
  /** L'action finit sur l'écran (objet jeté vers la caméra) : la vitre brisée s'enchaîne à l'impact. */
  finitSurEcran: boolean;
  /** Instant de l'impact (temps de la vidéo livrée) quand `finitSurEcran`. */
  impactSec?: number;
  /** Bruitage suggéré (« whoosh », « verre ») ; absent : aucun. */
  sonSuggere?: string;
  /** Phrase dite pendant le passage (aperçu). */
  phrase: string;
  /** Pourquoi ce moment, en une phrase (« vous parlez de votre téléphone, plan large »). */
  raisonMoment: string;
}

/** Résultat de la fabrication d'UN effet (la chaîne le garde ; jamais d'exception). */
export type ResultatEffetRealiste =
  | { id: string; statut: "reussi"; morceau: MorceauEffet; creditsDebites: number; message: string }
  | { id: string; statut: "rate" | "non-lance"; raison: RaisonEffetRate; creditsDebites: number; message: string };

export type RaisonEffetRate =
  | "non-confirme"
  | "plafond"
  | "duree"
  | "consigne-vide"
  | "extraction"
  | "envoi"
  | "refus"
  | "panne"
  | "depot"
  | "levres"
  | "visage"
  | "raccord"
  | "decor-ia";

/** Morceau retouché à reposer dans la piste (temps de la PRISE, comme les morceaux du Décor IA). */
export interface MorceauEffet {
  /** Identifiant de l'effet (passage). */
  id: string;
  source: "effet";
  debutSec: number;
  finSec: number;
  fichierCle: string;
  /** Fondu de raccord appliqué aux deux bouts du passage (s). */
  fonduSec: number;
  /** Fenêtre 9:16 d'extraction dans la source (px) : le cadrage recadre le morceau dans CETTE fenêtre. */
  fenetre?: { x: number; y: number; largeur: number; hauteur: number };
}

/** Ce qui est montré à Will quand l'effet n'a pas pu être fait (règle d'or : la vidéo sort quand même). */
export const MESSAGE_EFFET_RATE = "Effet non réussi — Réessayer";
