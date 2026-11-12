/**
 * À TRAITER (PV4) · types et constantes PARTAGÉS, sans accès base ni module serveur. Importable côté navigateur
 * (composants « use client ») comme côté serveur. Ne rien importer ici qui touche pg, fs ou « server-only ».
 */
export const VARIABLE_INTERRUPTEUR_A_TRAITER = "A_TRAITER_ENABLED";
export const EXTRAIT_MAX = 140;

export const RESEAUX_A_TRAITER = ["linkedin", "tiktok", "youtube", "facebook", "instagram"] as const;
export type ReseauATraiter = (typeof RESEAUX_A_TRAITER)[number];
export const MOTIFS = ["echec_envoi", "mot_dans_phrase", "mot_inconnu", "mot_manuel"] as const;
export type Motif = (typeof MOTIFS)[number];
export type StatutATraiter = "a_traiter" | "fait" | "ignore";

export interface CarteATraiter {
  idEvenement: string;
  reseau: ReseauATraiter;
  /** Repère technique du post (identifiant), jamais un nom de personne. */
  post: string;
  /** Lien https du post, s'il est connu et sûr. */
  lienPost: string | null;
  /** Mot détecté (majuscules) ou null. */
  mot: string | null;
  motif: Motif;
  /** Extrait court du commentaire public, ÉCHAPPÉ. */
  extrait: string;
  creeLe: string;
  statut: StatutATraiter;
  /** Réponse proposée, validée par `controlerTexteSortant`, sinon null. */
  kit: string | null;
  /** La personne a demandé l'arrêt : AUCUNE action d'envoi, seulement classer la carte. Jamais d'identifiant ici. */
  opposee?: boolean;
}

export interface EntreeATraiter {
  idEvenement: string;
  reseau: string;
  post: string;
  lienPost?: string | null;
  mot?: string | null;
  motif: string;
  commentaire: string;
  reponse?: string | null;
  /** Vrai si la personne a demandé l'arrêt : pas de réponse proposée. */
  opposee?: boolean;
  creeLe?: string;
}

export type EtatVue = "desactive" | "normal" | "vide" | "illisible";
export interface VueATraiter {
  etat: EtatVue;
  cartes: CarteATraiter[];
  /** Compteur du menu : null quand l'interrupteur est éteint (ou la source illisible). */
  compteur: number | null;
}

export type ResultatChangement = { issue: "execute" | "simule" | "refuse"; raison: string };
const INVERSES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
/** Pour l'affichage seulement : React échappe lui-même, on rend donc le texte lisible. */
export const extraitLisible = (extrait: string): string => extrait.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => INVERSES[m]);
