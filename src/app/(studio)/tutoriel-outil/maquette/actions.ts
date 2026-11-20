"use server";

/**
 * T-EXT-V2-09 · Gestes de l'écran « Votre maquette ». Une action par geste ; la session est exigée et les deux réglages
 * (`tutoriel.entreePhrase`, `tutoriel.pieceCreeeClaude`) sont vérifiés EN TÊTE par le service, avant toute écriture :
 * éteint = « La création depuis une phrase n'est pas ouverte. ». Aucune de ces actions n'appelle Claude.
 */
import { revalidatePath } from "next/cache";
import type { DecisionChiffre } from "@/briques/donnees-video/relecture-chiffres";
import { essayer } from "@/services/_commun";
import { arreter, autreProposition, corrigerTexte, enregistrerApercu, garderPiece, type DemandeCorrection, type IssuePiece } from "@/services/tutoriel-piece-creee";

const chemin = (videoId: string) => `/tutoriel-outil/maquette/${videoId}`;

async function geste(videoId: string, f: () => Promise<IssuePiece>): Promise<IssuePiece> {
  const r = await essayer(f);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath(chemin(videoId));
  revalidatePath(`/tutoriel-outil/suivi/${videoId}`);
  return r.donnees;
}

/** Dépôt manuel de l'aperçu (fichier d'aperçu + images), tant que la voie automatique du poste n'existe pas. */
export async function deposerApercuAction(videoId: string, ids: string[]): Promise<IssuePiece> {
  return geste(videoId, () => enregistrerApercu(videoId, ids));
}

export async function garderPieceAction(videoId: string, empreinte: string, chiffres?: Record<string, DecisionChiffre>): Promise<IssuePiece> {
  return geste(videoId, () => garderPiece(videoId, { empreinte, chiffres }));
}

export async function corrigerTexteAction(videoId: string, demande: DemandeCorrection): Promise<IssuePiece> {
  return geste(videoId, () => corrigerTexte(videoId, demande));
}

export async function autrePropositionAction(videoId: string): Promise<IssuePiece> {
  return geste(videoId, () => autreProposition(videoId));
}

export async function arreterAction(videoId: string): Promise<IssuePiece> {
  return geste(videoId, () => arreter(videoId));
}
