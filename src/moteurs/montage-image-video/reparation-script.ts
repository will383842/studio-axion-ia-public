/**
 * IMAGE → VIDÉO · Réparation sans appel d'une phrase trop longue (Q09 : 12 mots au plus).
 *
 * Module PUR. On ne change JAMAIS un mot : on ajoute un point à une frontière sûre (après une virgule, ou avant un mot de
 * liaison) et on met la lettre suivante en majuscule. Jamais au milieu d'un nombre dit (« vingt et un dossiers », « trois
 * heures et demie »), ni contre une unité, ni après un déterminant ou une préposition. Une garde finale, champ par champ,
 * refuse toute coupe qui changerait les mots, leur nombre ou la lecture des chiffres (valeur ET unité). La phrase-choc
 * validée par Will et la question de commentaire ne sont jamais touchées.
 */
import { MOTS_PAR_PHRASE_MAX, aCorrigerParClaude, lectureChiffres, verifierScript, type ContexteRegles, type VerdictScript } from "./regles";
import { motsDits, schemaFicheImage, type FicheImage } from "@/domaine/image-video/fiche";

const MORCEAU_MIN = 3;
/** Mots de liaison devant lesquels on peut couper (« et » et « pour » sont ambigus avec les nombres : exclus). */
const LIAISONS = new Set(["mais", "donc", "car", "puis", "alors", "qui", "que", "ou", "sans", "avec", "parce", "quand", "puisque", "sinon"]);
const NOMBRES = new Set([
  "zero", "un", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
  "vingt", "vingts", "trente", "quarante", "cinquante", "soixante", "septante", "huitante", "nonante", "cent", "cents", "mille", "million", "millions",
  "milliard", "milliards", "virgule", "demi", "demie", "demis", "demies", "quart", "quarts", "sur",
]);
const UNITES = new Set([
  "heure", "heures", "minute", "minutes", "seconde", "secondes", "jour", "jours", "semaine", "semaines", "mois", "an", "ans", "euro", "euros", "pourcent", "pourcents",
]);
/** Déterminants et prépositions : jamais de coupe juste après eux (le mot qui suit leur appartient). */
const DETERMINANTS = new Set(["de", "du", "des", "le", "la", "les", "un", "une", "au", "aux", "chaque", "a", "en", "sur", "par", "l", "d", "pour", "dans", "et", "ou", "que", "qui", "ne", "ni"]);

const mot = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** Mot qui dit ou porte un nombre, ou une unité (chaque morceau d'un mot composé compte : « quatre-vingt-quinze »). */
function estNombreOuUnite(t: string): boolean {
  if (/\d/.test(t)) return true;
  return mot(t)
    .split(/[-']/)
    .some((p) => NOMBRES.has(p) || UNITES.has(p));
}

interface Jeton {
  debut: number;
  fin: number;
  texte: string;
  estMot: boolean;
}

/** Frontière sûre entre le jeton `i` et le suivant. */
function frontiereSure(a: Jeton, b: Jeton): boolean {
  if (!a.estMot || !b.estMot) return false;
  const virgule = a.texte.endsWith(",");
  const liaison = LIAISONS.has(mot(b.texte));
  if (!virgule && !liaison) return false;
  if (estNombreOuUnite(a.texte) || estNombreOuUnite(b.texte)) return false;
  if (DETERMINANTS.has(mot(a.texte)) || LIAISONS.has(mot(a.texte))) return false;
  // « pour cent » : « pour » ne se sépare pas de « cent » (couvert par le nombre), « pourcent » est une unité.
  return true;
}

/** Positions (jeton avant la coupe) qui ramènent chaque morceau à 12 mots au plus, 3 au moins, ou `null` (aucune coupe sûre). */
function coupes(jetons: Jeton[], debut: number, fin: number): number[] | null {
  const mots = jetons.slice(debut, fin + 1).filter((j) => j.estMot).length;
  if (mots <= MOTS_PAR_PHRASE_MAX) return [];
  const candidats: { i: number; gauche: number }[] = [];
  let gauche = 0;
  for (let i = debut; i < fin; i++) {
    if (jetons[i]!.estMot) gauche++;
    if (gauche >= MORCEAU_MIN && mots - gauche >= MORCEAU_MIN && frontiereSure(jetons[i]!, jetons[i + 1]!)) candidats.push({ i, gauche });
  }
  candidats.sort((x, y) => Math.abs(x.gauche - mots / 2) - Math.abs(y.gauche - mots / 2) || x.i - y.i);
  for (const { i } of candidats) {
    const g = coupes(jetons, debut, i);
    const d = g && coupes(jetons, i + 1, fin);
    if (g && d) return [...g, i, ...d];
  }
  return null;
}

/** Première lettre du mot (après un éventuel guillemet ou parenthèse ouvrants) en majuscule. */
function majuscule(t: string): string {
  return t.replace(/^([^\p{L}\p{N}]*)(\p{L})/u, (_m, tete: string, l: string) => tete + l.toUpperCase());
}

/** Phrase (entre deux signes de fin), coupée si elle dépasse 12 mots et si chaque coupe est sûre ; sinon rendue telle quelle. */
function couperPhrase(phrase: string): string {
  // Un guillemet ou une parenthèse ouvrants, seuls (« « plus »), se collent au mot qui les suit.
  const jetons: Jeton[] = [];
  let ouvrant = -1;
  for (const m of phrase.matchAll(/\S+/g)) {
    if (/^[«“"‘(\[]+$/u.test(m[0])) {
      if (ouvrant < 0) ouvrant = m.index!;
      continue;
    }
    const debut = ouvrant >= 0 ? ouvrant : m.index!;
    jetons.push({ debut, fin: m.index! + m[0].length, texte: phrase.slice(debut, m.index! + m[0].length), estMot: /[\p{L}\p{N}]/u.test(m[0]) });
    ouvrant = -1;
  }
  if (jetons.filter((j) => j.estMot).length <= MOTS_PAR_PHRASE_MAX) return phrase;
  const places = coupes(jetons, 0, jetons.length - 1);
  if (!places?.length) return phrase;
  let r = phrase;
  // De la fin au début : les positions déjà calculées restent valables.
  for (const i of [...places].reverse()) {
    const a = jetons[i]!;
    const b = jetons[i + 1]!;
    r = r.slice(0, b.debut) + majuscule(b.texte) + r.slice(b.fin);
    r = a.texte.endsWith(",") ? `${r.slice(0, a.fin - 1)}.${r.slice(a.fin)}` : `${r.slice(0, a.fin)}.${r.slice(a.fin)}`;
  }
  return r;
}

const normalises = (t: string) => motsDits(t).map((m) => m.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);

/** Lecture des chiffres d'un texte, valeur ET unité (celle de `regles.ts`, importée telle quelle). */
const lecture = (t: string) => {
  const { chiffres, calculs } = lectureChiffres(t);
  return JSON.stringify({ c: chiffres.map((x) => [x.valeur, x.unite]), k: calculs });
};

/** Garde finale : mêmes mots, même nombre de mots, même lecture des chiffres. */
function memeLecture(avant: string, apres: string): boolean {
  const a = normalises(avant);
  const b = normalises(apres);
  return a.length === b.length && a.every((m, i) => m === b[i]) && motsDits(avant).length === motsDits(apres).length && lecture(avant) === lecture(apres);
}

/**
 * Coupe les phrases de plus de 12 mots d'un texte dit, sans changer un mot ni la lecture d'un chiffre. Les espaces et les
 * retours à la ligne d'origine sont conservés. Rend le texte tel quel quand aucune coupe n'est sûre.
 */
export function couperPhrasesLongues(texteDit: string): string {
  // Phrase par phrase, sur les mêmes signes de fin que `phrasesDe` (le découpage garde les signes : rien n'est perdu) ;
  // une coupe que la garde refuse n'est pas gardée.
  const morceaux = texteDit.split(/([.!?:;…]+)/u);
  for (let i = 0; i < morceaux.length; i += 2) {
    const coupee = couperPhrase(morceaux[i]!);
    if (coupee === morceaux[i]) continue;
    const essai = [...morceaux.slice(0, i), coupee, ...morceaux.slice(i + 1)].join("");
    if (memeLecture(texteDit, essai)) morceaux[i] = coupee;
  }
  return morceaux.join("");
}

export interface ReparationLongues {
  fiche: FicheImage;
  verdict: VerdictScript;
  /** Refus de Claude qui restent sur la fiche coupée (vide : la fiche passe). */
  refus: string[];
  /** Où une phrase a été coupée (« écran e03 », « accroche 1 »). */
  coupes: string[];
}

/**
 * Coupe les phrases longues d'une fiche lue, puis la rejuge. `null` : rien à couper, fiche illisible, ou un refus NOUVEAU
 * apparaît après la coupe (la réparation est jetée : jamais de refus sur un texte que Claude n'a pas écrit).
 */
export function reparerPhrasesLonguesIV(brute: unknown, ctx: ContexteRegles): ReparationLongues | null {
  const forme = schemaFicheImage.safeParse(brute);
  if (!forme.success) return null;
  const avant = aCorrigerParClaude(verifierScript(forme.data, ctx)).map((m) => m.message);
  if (!avant.length) return null;

  const fiche = structuredClone(forme.data);
  const faits: string[] = [];
  for (const e of fiche.ecrans) {
    if (e.partie === "phrase-choc" || e.scene === "phrase-choc") continue;
    const nouveau = couperPhrasesLongues(e.texteDit);
    if (nouveau !== e.texteDit) {
      e.texteDit = nouveau;
      faits.push(`écran ${e.id}`);
    }
  }
  fiche.accroches.forEach((a, i) => {
    const nouveau = couperPhrasesLongues(a.texteDit);
    if (nouveau !== a.texteDit) {
      a.texteDit = nouveau;
      faits.push(`accroche ${i + 1}`);
    }
  });
  if (!faits.length) return null;

  const rejuge = schemaFicheImage.safeParse(fiche);
  if (!rejuge.success) return null;
  const verdict = verifierScript(rejuge.data, ctx);
  const refus = aCorrigerParClaude(verdict).map((m) => m.message);
  if (refus.some((m) => !avant.includes(m))) return null;
  return { fiche: rejuge.data, verdict, refus, coupes: faits };
}
