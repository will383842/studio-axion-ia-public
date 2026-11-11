/**
 * Stock de messages (STK-01) : définition UNIQUE du type. Rien n'est supprimé : on archive (date posée, texte conservé).
 */
import type { IdReseau } from "./types";

export interface MessageStock {
  id: string;
  texte: string;
  reseau?: IdReseau;
  /** Instant ISO (UTC) de mise en stock. */
  creeLe: string;
  /** Instant ISO (UTC) de l'archivage ; absent tant que le message est actif. */
  archiveLe?: string;
}

/** Rend une copie archivée et datée ; l'original n'est pas modifié. Un message déjà archivé garde sa date. */
export function archiverMessage(message: MessageStock, archiveLe: string): MessageStock {
  return { ...message, archiveLe: message.archiveLe ?? archiveLe };
}
