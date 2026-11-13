/**
 * À TRAITER (PV4) · types et constantes PARTAGÉS, sans accès base ni module serveur. Importable côté navigateur
 * (composants « use client ») comme côté serveur. Ne rien importer ici qui touche pg, fs ou « server-only ».
 */
export const VARIABLE_INTERRUPTEUR_A_TRAITER = "A_TRAITER_ENABLED";
export const EXTRAIT_MAX = 140;

export const RESEAUX_A_TRAITER = [
  "linkedin",
  "tiktok",
  "youtube",
  "facebook",
  "instagram",
] as const;
export type ReseauATraiter = (typeof RESEAUX_A_TRAITER)[number];
export const MOTIFS = [
  "echec_envoi",
  "mot_dans_phrase",
  "mot_inconnu",
  "mot_manuel",
] as const;
export type Motif = (typeof MOTIFS)[number];
export type StatutATraiter = "a_traiter" | "fait" | "ignore";

/** Pourquoi aucun message privé n'est proposé (liste fermée). */
export type RaisonSansMessage =
  | "tiktok_sans_message_prive"
  | "textes_non_valides"
  | "mot_en_pause"
  | "mot_inconnu"
  | "deja_traite_pour_ce_mot";

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
  /** Empreintes opaques de la personne (une par espace, jamais l'identifiant brut), pour revérifier l'opposition à la lecture. */
  empreintes?: string[];
  /** Identifiant (kid) de la clé courante à la création : si elle change, la carte est traitée comme opposée (fermé). */
  kid?: string;
  /** LinkedIn/TikTok (file manuelle) : identifiant opaque du compte réseau concerné. Jamais un pseudo. */
  idCompte?: string;
  /** LinkedIn/TikTok : repère opaque de la cible (publication). Jamais un nom de personne. */
  cible?: string;
  /** LinkedIn/TikTok : titre court de la cible, ÉCHAPPÉ, jamais un nom de personne. */
  titreCible?: string;
  /** LinkedIn/TikTok : le message privé est-il à fabriquer à la main, ou indisponible ? */
  message?: "a_fabriquer" | "indisponible";
  /** Pourquoi aucun message n'est proposé (valeur fermée, jamais un texte libre). */
  raisonSansMessage?: RaisonSansMessage;
  /** Instant (ISO 8601) où le message a été copié à la main, pour le plafond de 24 h. */
  copieLe?: string;
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
  /** Identifiant opaque du contact : sert seulement à calculer les empreintes gardées dans la carte (jamais conservé). */
  idContact?: string | null;
  creeLe?: string;
}

export type EtatVue = "desactive" | "normal" | "vide" | "illisible";
export interface VueATraiter {
  etat: EtatVue;
  cartes: CarteATraiter[];
  /** Compteur du menu : null quand l'interrupteur est éteint (ou la source illisible). */
  compteur: number | null;
}

export type ResultatChangement = {
  issue: "execute" | "simule" | "refuse";
  raison: string;
};
const INVERSES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};
/** Pour l'affichage seulement : React échappe lui-même, on rend donc le texte lisible. */
export const extraitLisible = (extrait: string): string =>
  extrait.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => INVERSES[m]);
