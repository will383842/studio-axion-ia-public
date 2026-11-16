/** Extraits maison v4 (C4-U4.1) : lecture et écriture du préfixe `axion:`. Fonctions pures, jamais d'erreur levée. */
import type { RechercheAxion } from "./types";

export const PREFIXE_AXION = "axion:";

const MOTS_VIDES = new Set([
  "le", "la", "les", "l", "un", "une", "des", "de", "du", "d", "et", "ou", "a", "au", "aux", "en", "dans", "sur", "pour", "par", "avec",
  "the", "a", "an", "of", "and", "or", "in", "on", "to", "for", "with",
]);

const normaliser = (s: string) => s.trim().toLowerCase();

/** Vrai seulement pour une chaîne qui commence par `axion:` (casse et espaces de tête ignorés). */
export function estRechercheAxion(s: unknown): boolean {
  return typeof s === "string" && normaliser(s).startsWith(PREFIXE_AXION);
}

/** Mots-clés d'une recherche `axion:…`, ou `null` (autre texte, non-chaîne, aucun mot utile). Ne lève jamais. */
export function lireRechercheAxion(s: unknown): RechercheAxion | null {
  if (!estRechercheAxion(s)) return null;
  const corps = normaliser(s as string).slice(PREFIXE_AXION.length);
  const motsCles = corps.split(/[^\p{L}\p{N}]+/u).filter((m) => m && !MOTS_VIDES.has(m));
  return motsCles.length ? { motsCles } : null;
}

/** Écrit la chaîne `axion:mot1 mot2` (mots normalisés, vides retirés). */
export function ecrireRechercheAxion(motsCles: string[]): string {
  const mots = motsCles.flatMap((m) => normaliser(String(m)).split(/\s+/)).filter((m) => m && !MOTS_VIDES.has(m));
  return `${PREFIXE_AXION}${mots.join(" ")}`;
}
