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
  // fractions et quantités (« premier », « première », « second », « seconde » sont des adjectifs : ni nombre ni chiffre)
  ...["seconds", "secondes", "moitie", "moities", "demi", "demie", "demis", "demies", "tiers", "quart", "quarts", "double", "doubles", "triple", "triples", "quadruple", "quadruples", "dizaine", "dizaines", "douzaine", "douzaines", "quinzaine", "quinzaines", "vingtaine", "vingtaines", "trentaine", "trentaines", "centaine", "centaines", "millier", "milliers"],
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

const FIN_MOT = "(?![\\p{L}\\p{N}])";
/** Zones ou marchés : « premier du marché », « meilleur artisan de la région » (« le premier du mois » n'en est pas un). */
const NOM_CLASSEMENT = `(?:march[eé]|secteur|france|monde|r[eé]gion|d[eé]partement|ville|m[eé]tier|pays|europe|classement)${FIN_MOT}`;
const ZONE_NATIONALE = `de france${FIN_MOT}|en france${FIN_MOT}|au monde${FIN_MOT}|mondial${FIN_MOT}|mondiale${FIN_MOT}|national${FIN_MOT}|nationale${FIN_MOT}`;
/** « du marché », « de la région », « sur son marché », « dans le secteur », « en France », « au monde ». */
const SUR_ZONE = `(?:(?:du|de la|des|de l['’]?|d['’])\\s*${NOM_CLASSEMENT}|(?:sur|dans)\\s+(?:son|sa|ses|leur|leurs|notre|nos|votre|vos|le|la|les|l['’])\\s*${NOM_CLASSEMENT}|${ZONE_NATIONALE})`;
/** Acteurs : l'ENTREPRISE ou son offre face aux autres (« le premier client », « le premier salon » ordonnent un événement). */
const ACTEUR = `(?:cabinet|artisan|fournisseur|entreprise|soci[eé]t[eé]|solution|agence|prestataire|acteur|expert|sp[eé]cialiste|consultant|formateur|organisme|offre|service|outil|logiciel|plateforme|partenaire|r[eé]seau|marque|enseigne|commerce|atelier|bureau|studio|[eé]quipe)s?${FIN_MOT}`;
const SUITE_CLASSEMENT_DIRECTE = new RegExp(`^\\s+${SUR_ZONE}`, "iu");
/** « premier [grand] cabinet [d'expertise] de France » : un acteur, puis sa zone ; les mots avant l'acteur ne sont pas des prépositions. */
const SUITE_CLASSEMENT_PROCHE = new RegExp(
  `^(?:\\s+(?!(?:du|de|des|d|la|le|les|l)${FIN_MOT})\\p{L}+){0,2}?\\s+${ACTEUR}(?:\\s+[\\p{L}'’]+){0,3}?\\s+${SUR_ZONE}`,
  "iu",
);
const NUMERO_UN = /^\s*(?:°|o|º)?\s+un(?![\p{L}\p{N}])/iu;
const SUITE_LEADER = /^\s+(?:du|de|des|d['’]|sur|dans|en|au|mondial|mondiale|national|nationale|europ[eé]en)(?![\p{L}\p{N}])/iu;
/** « Nous sommes leaders », « elle est leader », « devenir leader » : l'entreprise se dit leader. */
const ETRE_LEADER = /(?:^|[^\p{L}])(?:sommes|suis|es|est|sont|êtes|etes|être|etre|devenir|devenu|devenue|devenus|devenues|rester|restons|reste|restent)\s+(?:(?:le|la|les|un|une|des|l['’])\s+)?$/iu;

/**
 * Classement affiché, porté par l'ENTREPRISE ou son offre face aux autres (« premier du marché », « première solution au monde »,
 * « meilleur artisan de la région », « leader du secteur », « nous sommes leaders », « numéro un »), ou `undefined`.
 */
function classementDe(texte: string, index: number, mot: string): string | undefined {
  const n = normaliser(mot);
  const suite = texte.slice(index + mot.length);
  const avant = texte.slice(Math.max(0, index - 12), index);
  if (/^premiere?s?$/.test(n) || /^meilleure?s?$/.test(n)) {
    const m = SUITE_CLASSEMENT_DIRECTE.exec(suite) ?? SUITE_CLASSEMENT_PROCHE.exec(suite);
    if (m) return `${mot}${m[0]}`;
    if (!/^premiere?s?$/.test(n)) return undefined;
    // Une place, un rang ou une position ne classent que dans « à la première place », « au premier rang », « en première position ».
    const rang = /^\s+(place|rang|position)(?![\p{L}\p{N}])/iu.exec(suite);
    if (rang && ((n === "premiere" && /(?:^|\s)[aà]\s+la\s+$/iu.test(avant) && rang[1]!.toLowerCase() !== "rang") || (n === "premier" && /(?:^|\s)au\s+$/iu.test(avant) && rang[1]!.toLowerCase() === "rang") || (n === "premiere" && /(?:^|\s)en\s+$/iu.test(avant) && rang[1]!.toLowerCase() === "position"))) return `${mot}${rang[0]}`;
    return undefined;
  }
  if (n === "leader" || n === "leaders") {
    const m = SUITE_LEADER.exec(suite);
    if (m) return `${mot}${m[0]}`;
    if (ETRE_LEADER.test(texte.slice(Math.max(0, index - 24), index))) return mot;
    // Seul en tête de phrase et sans suite (« Leader. ») : un titre qui se proclame ; « Leaders, voici… » est une apostrophe.
    return /(?:^|[.!?:;\n–—])\s*$/u.test(texte.slice(0, index)) && /^\s*(?:[.!?…]|$)/u.test(suite) ? mot : undefined;
  }
  if ((n === "numero" || n === "n") && NUMERO_UN.test(suite)) return `${mot}${/^\s*\S*\s+un/iu.exec(suite)?.[0] ?? ""}`;
  return undefined;
}

/** Premier classement affiché dans le texte (« premier du marché », « leader du secteur », « numéro un »), tel qu'écrit, ou `undefined`. */
export function classementDans(texte: string): string | undefined {
  const propre = sansTelephones(texte.normalize("NFKC"));
  for (const m of propre.matchAll(/\p{L}+/gu)) {
    const c = classementDe(propre, m.index ?? 0, m[0]);
    if (c) return c.trim();
  }
  return undefined;
}

const AVANT_SECONDE_DUREE = new Set(["une", "chaque", "par", "d", "quelques", "cette", "toute"]);
const SUITE_SECONDE_DUREE = /^(?:\s*(?:[.,;:!?)»]|$)|\s+(?:pour|de|a|à|et|ou|pres|près|seulement|plus|avant|apres|après|par|ne|sans|compte|suffit|suffisent)(?![\p{L}\p{N}]))/iu;

/** « seconde » est une durée après « une / chaque / par » quand aucun nom ne suit (« une seconde chance » est un ordinal ; « la seconde de trop », « à la seconde près » sont des expressions). */
function secondeDuree(avant: string, suite: string, mot: string): boolean {
  if (normaliser(mot) !== "seconde") return false;
  const a = normaliser(avant);
  if (a === "chaque" || a === "par") return true;
  return AVANT_SECONDE_DUREE.has(a) && SUITE_SECONDE_DUREE.test(suite);
}

/** Premier nombre en lettres, ordinal ou chiffre romain du texte (« neuf » adjectif exclu), avec sa position. */
function premierEnLettres(texte: string): { brut: string; index: number } | undefined {
  let precedent = "";
  for (const m of texte.matchAll(/\p{L}+/gu)) {
    const mot = m[0];
    const index = m.index ?? 0;
    const avant = precedent;
    precedent = mot;
    if (!estNombreEnLettres(mot) && !secondeDuree(avant, texte.slice(index + mot.length), mot)) continue;
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
/** « Ton variable », « Ton constant » : en tête de texte ou de phrase, « ton » suivi d'un adjectif ou verbe de tonalité est le nom commun. */
const TON_EN_TETE = "(?!(?<=(?:^|[.!?:;\\n–—])\\s*ton)\\s+(?:variable|constant|constante|juste|neutre|direct|sobre|uniforme|cohérent|adapté|employé|choisi|reste|change|varie|est|devient|doit|se)(?![\\p{L}\\p{N}]))";
const TUTOIEMENT = new RegExp(
  "(?<![\\p{L}\\p{N}])(?:" +
    "(?:tu|ta|tes|toi|te)(?![\\p{L}\\p{N}])" +
    // possessifs « tien » : après un article seulement ; « tiens » seul sauf après « je » (« je tiens à… »)
    `|(?<=${MOT_ENTIER}(?:le|la|les)\\s+)tien(?:ne)?s?(?![\\p{L}\\p{N}])` +
    `|(?<!${MOT_ENTIER}(?:je|j['’‘ʼ](?:y|en)|nous)\\s+)tiens(?![\\p{L}\\p{N}])` +
    // « ton » : possessif, sauf tonalité (le ton, un ton, du ton, bon ton, même ton, ce ton, changer de ton, ton sur ton)
    `|ton(?![\\p{L}\\p{N}])(?<!${MOT_ENTIER}(?:le|un|du|au|bon|même|ce|cet|votre|notre|son|leur|mon|quel|quelle)\\s+ton)(?<!${MOT_ENTIER}(?:chang|baiss|hauss)\\p{L}*\\s+de\\s+ton)(?<!${MOT_ENTIER}ton\\s+sur\\s+ton)(?!\\s+sur\\s+ton(?![\\p{L}\\p{N}]))${TON_EN_TETE}` +
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

/** Expressions bannies, comparées sans casse, sans accents et espaces ramenés à un seul. */
const EXPRESSIONS_BANNIES: readonly { libelle: string; motif: RegExp }[] = [
  { libelle: "Grenoble", motif: /(?<![a-z0-9])grenobl(?:e|ois|oise)s?(?![a-z0-9])/u },
  { libelle: "Aucun gain garanti", motif: /(?<![a-z0-9])aucuns? gains? (?:n'est |ne sont )?garantis?(?![a-z0-9])/u },
];

/** Libellés des expressions bannies présentes dans le texte (hors « J'aide », contrôlé à part). */
export function expressionsBannieDans(texte: string): string[] {
  const norme = texte
    .replace(/[\u00AD\u200B-\u200D\u2060]/gu, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’‘ʼ]/gu, "'")
    .replace(/\s+/gu, " ");
  return EXPRESSIONS_BANNIES.filter((e) => e.motif.test(norme)).map((e) => e.libelle);
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

const PAGES_EN_LETTRES: Record<string, number> = { une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };

/** Texte alternatif sans « N pages » quand N est le nombre de pages du carrousel lui-même (en lettres ou en chiffres). */
export function sansNombreDePages(texte: string, nbPages: number): string {
  return texte.replace(/(?<![\p{L}\p{N}])(\d{1,2}|[a-zéè]+)\s+pages?(?![\p{L}\p{N}])/giu, (tout, n: string) => {
    const valeur = /^\d+$/.test(n) ? Number(n) : PAGES_EN_LETTRES[normaliser(n)];
    return valeur === nbPages ? "pages" : tout;
  });
}
