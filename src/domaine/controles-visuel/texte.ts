/** Détections sur un texte français (chiffres, tutoiement, sortant, anglais) : pures, sans liste de voix en dur. */
import { chiffresDe } from "../image-video/chiffres";

/** Minuscules, sans accent, sans ponctuation, espaces réduits : sert à comparer deux titres. */
export function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Mots d'un texte (lettres, chiffres, apostrophes et traits d'union internes). */
export function mots(texte: string): string[] {
  return texte.match(/[\p{L}\p{N}]+(?:['’‘ʼ-][\p{L}\p{N}]+)*/gu) ?? [];
}

// --- Sortant (QV-121) ---------------------------------------------------------------------------------------------

const EMAIL = /(?<![\p{L}\p{N}._%+-])[\p{L}\p{N}._%+-]{1,64}@[\p{L}\p{N}-]{1,63}(?:\.[\p{L}\p{N}-]{1,63}){0,5}/gu;
/** Un numéro commence par 0 ou + et ne prolonge pas un autre nombre (« 10 000 000 », « 2026-10-19 » n'en sont pas). */
const TELEPHONE = /(?<![\p{N}][ .\-\u00A0\u202F]?)(?:\+\d|0\d)(?:[ .\-\u00A0\u202F]?\d){6,}/gu;
const PSEUDO = /(?<![\p{L}\p{N}_.@])@[\p{L}\p{N}_]{2,}/gu;
const HASHTAG = /(?<![\p{L}\p{N}&])#[\p{L}\p{N}_]+/gu;

export type GenreSortant = "e-mail" | "numéro de téléphone" | "pseudo" | "hashtag";

/** Éléments qui renvoient vers l'extérieur : adresse, numéro, @pseudo, #mot-dièse. */
export function sortantsDans(texte: string): { genre: GenreSortant; extrait: string }[] {
  const res: { genre: GenreSortant; extrait: string }[] = [];
  const t = texte.normalize("NFKC");
  for (const [genre, re] of [["e-mail", EMAIL], ["numéro de téléphone", TELEPHONE], ["pseudo", PSEUDO], ["hashtag", HASHTAG]] as const) {
    for (const m of t.matchAll(re)) res.push({ genre, extrait: m[0] });
  }
  return res;
}

/** Texte sans ses numéros de téléphone : un numéro est signalé comme « sortant », pas comme chiffre. */
export function sansTelephones(texte: string): string {
  return texte.replace(TELEPHONE, " ");
}

// --- Chiffres ------------------------------------------------------------------------------------------------------

/** « un » et « une » sont des articles : ils ne comptent pas comme chiffre. */
const NOMBRES_EN_LETTRES = new Set([
  ...["zero", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "vingt", "vingts", "trente", "quarante", "cinquante", "soixante", "cent", "cents", "mille", "million", "millions", "milliard", "milliards"],
  // ordinaux sans suffixe régulier, fractions et quantités
  ...["premier", "premiere", "premiers", "premieres", "second", "seconds", "seconde", "secondes", "moitie", "moities", "demi", "demie", "demis", "demies", "tiers", "quart", "quarts", "double", "doubles", "triple", "triples", "quadruple", "quadruples", "dizaine", "dizaines", "douzaine", "douzaines", "quinzaine", "quinzaines", "vingtaine", "vingtaines", "trentaine", "trentaines", "centaine", "centaines", "millier", "milliers"],
  // belgicismes
  ...["septante", "huitante", "octante", "nonante"],
]);
const ORDINAL = /(deux|trois|quatr|cinqu|six|sept|huit|neuv|dix|onz|douz|treiz|quatorz|quinz|seiz|vingt|trent|cent|mill|quarant|cinquant|soixant|septant|huitant|octant|nonant|million|milliard)iemes?$/;
const ROMAIN = /(?<![\p{L}\p{N}])([IVXLC]{1,6})(er|re|ème|e)?(?![\p{L}\p{N}])/gu;
const ROMAIN_VALIDE = /^(C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
/** Sigles qui ont la forme d'un nombre romain sans en être un. */
const ROMAIN_SIGLES = new Set(["CV", "XL", "XXL"]);
const CONTEXTE_ROMAIN = new Set([
  "siecle", "siecles", "chapitre", "chapitres", "tome", "tomes", "acte", "actes", "partie", "livre", "volume", "article", "section", "annexe", "dynastie",
  "louis", "francois", "henri", "charles", "philippe", "jean", "pie", "napoleon", "guillaume", "richard", "edouard", "alexandre", "nicolas", "leon", "benoit", "gregoire", "clement", "urbain", "innocent", "paul", "george", "georges",
]);
/** Début d'un nombre quand « neuf » précède : seul un pluriel ou un grand nombre en fait un compte. */
const SUITE_NEUF_NOMBRE = new Set(["cent", "cents", "mille", "million", "millions", "milliard", "milliards"]);
const MOTS_OUTILS_EN_S = new Set(["dans", "sans", "vos", "nos", "les", "des", "ces", "mes", "ses", "vers", "plus", "pas", "vous", "nous", "tous", "alors", "apres", "avec", "sous", "puis"]);
const AVANT_NEUF_NOMBRE = new Set(["reste", "restent", "restait", "avons", "avez", "ont", "sont", "sommes", "etions", "etaient", "faut", "fait", "font", "compte", "comptons", "comptent", "reussi", "obtenu", "gagne"]);

function neufEstNombre(avant: string, suite: string): boolean {
  const m = /^\s+(\p{L}+)/u.exec(suite);
  if (!m) return AVANT_NEUF_NOMBRE.has(avant);
  const suivant = normaliser(m[1]!);
  return SUITE_NEUF_NOMBRE.has(suivant) || (/[sx]$/.test(suivant) && !MOTS_OUTILS_EN_S.has(suivant));
}

/**
 * Plafond de candidats romains examinés (borne le coût sur un texte piégé). Limite assumée : un vrai chiffre romain
 * précédé de plus de 200 candidats « I/V/X/L/C » isolés (ex. 200 élisions « L'/C' ») n'est pas vu.
 */
const MAX_ESSAIS_ROMAIN = 200;

/** Premier chiffre romain de forme valide, avec suffixe ordinal (XXIe, Ier) ou mot de contexte (Louis XIV, chapitre IV). */
function premierRomain(texte: string, limite = Infinity): { brut: string; index: number } | undefined {
  let essais = 0;
  for (const m of texte.matchAll(ROMAIN)) {
    const [brut, nombre = "", suffixe = ""] = m;
    const index = m.index ?? 0;
    if (index > limite || ++essais > MAX_ESSAIS_ROMAIN) break;
    if (ROMAIN_SIGLES.has(nombre) || !ROMAIN_VALIDE.test(nombre)) continue;
    const avant = /(\p{L}+)\s*$/u.exec(texte.slice(Math.max(0, index - 30), index))?.[1];
    const apres = /^\s*(\p{L}+)/u.exec(texte.slice(index + brut.length, index + brut.length + 30))?.[1];
    const contexte = (avant !== undefined && CONTEXTE_ROMAIN.has(normaliser(avant))) || (apres !== undefined && CONTEXTE_ROMAIN.has(normaliser(apres)));
    const ier = nombre === "I" && (suffixe === "er" || suffixe === "re");
    if (ier || (nombre.length > 1 && suffixe !== "") || contexte) return { brut, index };
  }
  return undefined;
}

/** Plus longs candidats : « cinquantiemes », « milliardiemes » (13) ; plus courts : « six », « dix » (3). */
function estNombreEnLettres(mot: string): boolean {
  if (mot.length < 3 || mot.length > 14) return false;
  const n = normaliser(mot);
  return NOMBRES_EN_LETTRES.has(n) || ORDINAL.test(n);
}

/** Premier nombre en lettres, ordinal ou chiffre romain du texte (« neuf » adjectif exclu), avec sa position. */
function premierEnLettres(texte: string): { brut: string; index: number } | undefined {
  let precedent = "";
  for (const m of texte.matchAll(/\p{L}+/gu)) {
    const mot = m[0];
    const index = m.index ?? 0;
    const avant = precedent;
    precedent = mot;
    if (!estNombreEnLettres(mot)) continue;
    if (normaliser(mot) === "neuf") {
      const suite = texte.slice(index + mot.length);
      if (!neufEstNombre(normaliser(avant), suite)) continue;
    }
    const romain = premierRomain(texte, index);
    return romain && romain.index < index ? { brut: romain.brut, index: romain.index } : { brut: mot, index };
  }
  const romain = premierRomain(texte);
  return romain ? { brut: romain.brut, index: romain.index } : undefined;
}

/** Premier chiffre écrit (en nombre, en lettres ou romain) dans le texte, tel qu'écrit, ou `undefined`. */
export function premierChiffre(texte: string): string | undefined {
  const propre = sansTelephones(texte.normalize("NFKC"));
  const enNombre = chiffresDe(propre)[0];
  const enLettres = premierEnLettres(propre);
  if (enNombre) return !enLettres || propre.indexOf(enNombre.brut) <= enLettres.index ? enNombre.brut : enLettres.brut;
  if (enLettres) return enLettres.brut;
  // Filet : tout autre chiffre (A4, H24, x2, ٣…) est un chiffre.
  return /\p{N}/u.test(propre) ? /\S{0,20}\p{N}\S{0,20}/u.exec(propre)?.[0] : undefined;
}

// --- Tutoiement ----------------------------------------------------------------------------------------------------

const MOT_ENTIER = "(?<![\\p{L}])";
const TUTOIEMENT = new RegExp(
  "(?<![\\p{L}\\p{N}])(?:" +
    "(?:tu|ta|tes|toi|te)(?![\\p{L}\\p{N}])" +
    // possessifs « tien » : après un article seulement ; « tiens » seul sauf après « je » (« je tiens à… »)
    `|(?<=${MOT_ENTIER}(?:le|la|les)\\s+)tien(?:ne)?s?(?![\\p{L}\\p{N}])` +
    `|(?<!${MOT_ENTIER}(?:je|j['’‘ʼ](?:y|en)|nous)\\s+)tiens(?![\\p{L}\\p{N}])` +
    // « ton » : possessif, sauf tonalité (le ton, un ton, du ton, bon ton, même ton, ce ton, changer de ton, ton sur ton)
    `|ton(?![\\p{L}\\p{N}])(?<!${MOT_ENTIER}(?:le|un|du|au|bon|même|ce|cet|votre|notre|son|leur|mon|quel|quelle)\\s+ton)(?<!${MOT_ENTIER}(?:chang|baiss|hauss)\\p{L}*\\s+de\\s+ton)(?<!${MOT_ENTIER}ton\\s+sur\\s+ton)(?!\\s+sur\\s+ton(?![\\p{L}\\p{N}]))` +
    "|t['’‘ʼ](?=\\p{L})" +
    ")",
  "iu",
);
const J_AIDE = /(?<![\p{L}\p{N}])j['’‘ʼ]aide(?![\p{L}\p{N}])/iu;

/** Premier mot de tutoiement (tu, ton, ta, tes, toi, te, tien…, t') ; l'impératif de 2e personne n'est pas détecté, ou `undefined`. */
export function tutoiementDans(texte: string): string | undefined {
  return TUTOIEMENT.exec(texte)?.[0];
}

export function contientJAide(texte: string): boolean {
  return J_AIDE.test(texte);
}

// --- Anglais -------------------------------------------------------------------------------------------------------

/** Liste fermée de mots-outils anglais, hors mots aussi français (a, on, or, an, but, me…). */
const MOTS_ANGLAIS = new Set(
  ["the", "is", "are", "was", "were", "and", "of", "to", "in", "for", "with", "this", "that", "you", "your", "it", "we", "our", "can", "will", "be", "have", "has", "not", "from", "at", "by", "they", "their", "what", "how", "all"],
);
export const SEUIL_ANGLAIS = 0.15;
export const MOTS_MIN_ANGLAIS = 5;

/** Part de mots-outils anglais, ou `undefined` si le texte a moins de 5 mots. */
export function partAnglais(texte: string): number | undefined {
  const m = mots(texte).map((x) => x.toLowerCase());
  if (m.length < MOTS_MIN_ANGLAIS) return undefined;
  return m.filter((x) => MOTS_ANGLAIS.has(x)).length / m.length;
}
