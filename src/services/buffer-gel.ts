/**
 * LOT A1 — BUFFER GELÉ EN LECTURE SEULE. Réglage `buffer.gele` : ABSENT = GELÉ ; seul le booléen `false` dégèle.
 * Gelé : le studio n'appelle plus Buffer (synchro d'états, comptes, « Tester », relecture d'un envoi Buffer, chiffres, envoi).
 * Ce qui est en base reste LU (comptes figés `buffer.canaux`, publications). Rien n'est effacé, ici ni chez Buffer.
 * Tests seulement : `STUDIO_BUFFER_GEL_DEFAUT=degele` inverse le DÉFAUT (réglage absent), jamais en production.
 */
import "server-only";
import { ErreurStudio, lireParametre } from "./_commun";

export const PARAM_GELE = "buffer.gele";
export const PHRASE_GEL = "L'ancien outil de programmation est gelé en lecture seule : il n'est plus appelé. Les vidéos partent par le nouvel outil.";

export async function bufferGele(): Promise<boolean> {
  const v = await lireParametre<unknown>(PARAM_GELE, undefined);
  if (v === false) return false;
  if (v === true) return true;
  return !(process.env.NODE_ENV !== "production" && process.env.STUDIO_BUFFER_GEL_DEFAUT === "degele");
}

export function erreurGel(): ErreurStudio {
  return new ErreurStudio("BUFFER_GELE", PHRASE_GEL);
}
