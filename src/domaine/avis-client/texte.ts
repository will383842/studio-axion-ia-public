import { createHash } from "node:crypto";
import type { AvisClient } from "./types";

const POINTS = "…";

/** Texte égal, ou début du texte suivi de « … ». Jamais de correction. */
export function couperAvis(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  return texte.slice(0, Math.max(0, max)).trimEnd() + POINTS;
}

/** Vrai seulement si `affiche` est égal à `origine` ou en est une coupe exacte (« … » en tête et/ou en queue). */
export function texteFidele(origine: string, affiche: string): boolean {
  if (affiche === origine) return true;
  const debut = affiche.startsWith(POINTS);
  const fin = affiche.endsWith(POINTS);
  if (!debut && !fin) return false;
  let coeur = affiche;
  if (debut) coeur = coeur.slice(POINTS.length);
  if (fin && coeur.endsWith(POINTS)) coeur = coeur.slice(0, -POINTS.length);
  coeur = coeur.trim();
  return coeur.length > 0 && origine.includes(coeur);
}

/** sha256 hex de id + texte exact + note + date. */
export function empreinteAvis(avis: Pick<AvisClient, "id" | "texte" | "note" | "date">): string {
  return createHash("sha256").update(`${avis.id}${avis.texte}${avis.note}${avis.date}`).digest("hex");
}
