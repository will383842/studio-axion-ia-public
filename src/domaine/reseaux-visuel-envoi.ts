/**
 * Liste UNIQUE des réseaux qui reçoivent un visuel depuis le calendrier.
 * Hors de `src/domaine/visuels/` à dessein : ce dossier est copié dans l'image de rendu.
 * Pinterest ne reçoit QUE une épingle (famille « epingle ») ; carrousels et infographies restent sur les trois réseaux historiques.
 */
import type { ReseauDeclinaison } from "./types";

/** Les trois réseaux des carrousels et infographies. */
export const RESEAUX_VISUEL_CLASSIQUES = ["linkedin", "instagram", "facebook"] as const;
export type ReseauVisuelClassique = (typeof RESEAUX_VISUEL_CLASSIQUES)[number];

export const RESEAUX_VISUEL_ENVOI = [...RESEAUX_VISUEL_CLASSIQUES, "pinterest"] as const;
export type ReseauVisuelEnvoi = (typeof RESEAUX_VISUEL_ENVOI)[number];

export function estReseauVisuelEnvoi(r: unknown): r is ReseauVisuelEnvoi {
  return typeof r === "string" && (RESEAUX_VISUEL_ENVOI as readonly string[]).includes(r);
}

/** Réseaux d'un visuel selon sa famille : une épingle ne va que sur Pinterest, tout autre visuel jamais sur Pinterest. */
export function reseauxEnvoiDeLaFamille(famille: string): readonly ReseauVisuelEnvoi[] {
  return famille === "epingle" ? ["pinterest"] : RESEAUX_VISUEL_CLASSIQUES;
}

/**
 * Pinterest dans le TOUR GÉNÉRAL du calendrier : FERMÉ. Constante de code (PR 5b d'une ligne pour l'ouvrir, après l'essai réel borné).
 * Fermé, seul l'essai d'UN créneau peut produire une ligne Pinterest.
 */
export const PINTEREST_TOUR_GENERAL = false;

/** Réseaux d'un créneau d'envoi : les déclinaisons vidéo, plus Pinterest. */
export type ReseauEnvoiCreneau = ReseauDeclinaison | "pinterest";
