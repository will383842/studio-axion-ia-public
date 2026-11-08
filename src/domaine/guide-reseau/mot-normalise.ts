// Normalisation d'un mot de déclenchement : PUR. Un mot = une seule suite A–Z / 0–9 (2 à 20), sans accents.
import { MOTS_OPPOSITION } from "./opposition";

export const RE_MOT_NORMALISE = /^[A-Z0-9]{2,20}$/;

/** Mot normalisé (NFKC, ponctuation/émojis de bord retirés, sans accents, majuscules), ou null si le format n'est pas respecté ou si c'est une opposition. */
export function normaliserMot(texte: unknown): string | null {
  if (typeof texte !== "string") return null;
  const t = texte.normalize("NFKC").trim().replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}]+$/u, "");
  const m = t.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  if (!RE_MOT_NORMALISE.test(m) || /^\d+$/.test(m)) return null;
  return MOTS_OPPOSITION.includes(m) ? null : m;
}
