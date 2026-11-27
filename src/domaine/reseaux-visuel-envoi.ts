/**
 * Liste UNIQUE des réseaux qui reçoivent un visuel (carrousel, infographie) depuis le calendrier.
 * Hors de `src/domaine/visuels/` à dessein : ce dossier est copié dans l'image de rendu.
 */
import type { ReseauDeclinaison } from "./types";

export const RESEAUX_VISUEL_ENVOI = ["linkedin", "instagram", "facebook"] as const;
export type ReseauVisuelEnvoi = (typeof RESEAUX_VISUEL_ENVOI)[number];

export function estReseauVisuelEnvoi(r: unknown): r is ReseauVisuelEnvoi {
  return typeof r === "string" && (RESEAUX_VISUEL_ENVOI as readonly string[]).includes(r);
}

/** Réseaux d'un créneau d'envoi : les déclinaisons vidéo, plus Pinterest (typage seulement, aucun envoi n'y est ouvert). */
export type ReseauEnvoiCreneau = ReseauDeclinaison | "pinterest";
