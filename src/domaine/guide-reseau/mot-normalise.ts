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

/** Politesses seules tolérées autour du mot (liste FERMÉE : ni pronom, ni article, ni verbe, ni « oui »). « S'il vous plaît » n'est accepté que comme séquence exacte (voir SEQUENCES_POLITESSE). */
export const MOTS_NEUTRES_POLITESSE: readonly string[] = [
  "MERCI", "BEAUCOUP", "SVP", "STP", "PLAIT", "BONJOUR", "BONSOIR", "SALUT", "PLEASE", "THANKS", "THANK", "HELLO", "HI",
];
/** Séquences exactes de mots acceptées (jamais IL, VOUS ou S isolés). */
const SEQUENCES_POLITESSE: readonly (readonly string[])[] = [["S", "IL", "VOUS", "PLAIT"], ["SIL", "VOUS", "PLAIT"]];
/** Un mot collé à un point, une barre oblique ou un arobase (« le.guide », « le/guide », « a@b ») : refusé, ces séparateurs ne deviennent pas des espaces. */
const RE_MOT_COLLE = /[\p{L}\p{N}][./@\\]+[\p{L}\p{N}]|(^|\s)[./@\\]+[\p{L}\p{N}]/u;
const LONGUEUR_MAX_POLITESSE = 200;
const MOTS_MAX_POLITESSE = 8;

/**
 * Mot de déclenchement d'un commentaire qui l'accompagne de politesse (« GUIDE merci », « merci GUIDE », « GUIDE s'il vous plaît ») : forme canonique du mot du registre, ou null. PUR.
 * Liste blanche : 200 caractères au plus, aucune opposition ni doute, mentions « @xxx » retirées, ÉGALITÉ stricte avec un mot connu (jamais de préfixe),
 * exactement un mot distinct du registre, tous les autres mots dans la liste fermée de politesses (ou la séquence exacte « s'il vous plaît »), 8 mots au plus.
 */
export function motAvecPolitesse(texte: string, motsConnus: readonly string[]): string | null {
  if (typeof texte !== "string" || texte.length > LONGUEUR_MAX_POLITESSE) return null;
  if (classerOpposition(texte) !== "non") return null;
  const sansMentions = texte.normalize("NFKC").replace(/(^|\s)@[\p{L}\p{N}_.]+/gu, " ");
  if (RE_MOT_COLLE.test(sansMentions)) return null;
  const mots = motsDe(sansMentions);
  if (mots.length === 0 || mots.length > MOTS_MAX_POLITESSE) return null;
  const registre = new Set(motsConnus.map((c) => normaliserMot(c)).filter((c): c is string => c !== null));
  const trouves = new Set<string>();
  for (let i = 0; i < mots.length; i++) {
    const m = mots[i];
    const seq = SEQUENCES_POLITESSE.find((q) => q.every((x, k) => mots[i + k] === x));
    if (seq) {
      i += seq.length - 1;
      continue;
    }
    if (NEGATIONS.includes(m)) return null;
    if (registre.has(m)) trouves.add(m);
    else if (!MOTS_NEUTRES_POLITESSE.includes(m)) return null;
  }
  return trouves.size === 1 ? [...trouves][0] : null;
}
