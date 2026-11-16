// Normalisation d'un mot de déclenchement : PUR. Un mot = une seule suite A–Z / 0–9 (2 à 20), sans accents.
import { classerOpposition, MOTS_OPPOSITION, motsDe, NEGATIONS } from "./opposition";

export const RE_MOT_NORMALISE = /^[A-Z0-9]{2,20}$/;

/** Mot normalisé (NFKC, ponctuation/émojis de bord retirés, sans accents, majuscules), ou null si le format n'est pas respecté ou si c'est un mot d'opposition (liste fermée de opposition.ts : STOP, ARRETEZ, DESINSCRIRE…). */
export function normaliserMot(texte: unknown): string | null {
  if (typeof texte !== "string") return null;
  const t = texte.normalize("NFKC").trim().replace(/^[^\p{L}\p{N}]+/u, "").replace(/[^\p{L}\p{N}]+$/u, "");
  const m = t.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  if (!RE_MOT_NORMALISE.test(m) || /^\d+$/.test(m)) return null;
  return MOTS_OPPOSITION.includes(m) ? null : m;
}

/** Mots sans portée tolérés autour du mot (liste FERMÉE : tout autre mot, toute négation, fait refuser le texte). */
export const MOTS_NEUTRES_POLITESSE: readonly string[] = [
  "MERCI", "BEAUCOUP", "SVP", "STP", "S", "IL", "VOUS", "TE", "PLAIT", "BONJOUR", "BONSOIR", "SALUT", "OUI", "JE", "VEUX", "VOUDRAIS", "LE", "LA", "UN", "MOI",
  "POUR", "RECEVOIR", "ENVOYER", "PLEASE", "THANKS", "THANK", "YOU", "HELLO", "HI", "I", "WANT", "THE", "SEND", "ME",
];
const LONGUEUR_MAX_POLITESSE = 200;
const MOTS_MAX_POLITESSE = 8;

/**
 * Mot de déclenchement d'un commentaire qui l'accompagne de politesse (« GUIDE merci », « je veux le guide ») : forme canonique du mot du registre, ou null. PUR.
 * Liste blanche : 200 caractères au plus, aucune opposition ni doute, mentions « @xxx » retirées, ÉGALITÉ stricte avec un mot connu (jamais de préfixe),
 * exactement un mot distinct du registre, tous les autres mots dans la liste fermée de mots neutres, 8 mots au plus.
 */
export function motAvecPolitesse(texte: string, motsConnus: readonly string[]): string | null {
  if (typeof texte !== "string" || texte.length > LONGUEUR_MAX_POLITESSE) return null;
  if (classerOpposition(texte) !== "non") return null;
  const mots = motsDe(texte.normalize("NFKC").replace(/(^|\s)@[\p{L}\p{N}_.]+/gu, " "));
  if (mots.length === 0 || mots.length > MOTS_MAX_POLITESSE) return null;
  const registre = new Set(motsConnus.map((c) => normaliserMot(c)).filter((c): c is string => c !== null));
  const trouves = new Set<string>();
  for (const m of mots) {
    if (NEGATIONS.includes(m)) return null;
    if (registre.has(m)) trouves.add(m);
    else if (!MOTS_NEUTRES_POLITESSE.includes(m)) return null;
  }
  return trouves.size === 1 ? [...trouves][0] : null;
}
