/**
 * SOCLE QUALITÉ · RÉPÉTITIONS DANS UN SCRIPT (banc à l'aveugle du 17/10). PUR. Observation seulement.
 *
 * Quatre défauts, tous lus sur les phrases du CORPS (accroche comprise) :
 *  1. `identique`  : une phrase (minuscules, sans accents ni ponctuation) qui réapparaît à l'identique ;
 *  2. `proche`     : deux phrases dont les mots de plus de 3 lettres se recouvrent (Jaccard ≥ SEUIL_JACCARD), ou dont la
 *                    plus courte est presque contenue dans l'autre quand elles se suivent (« la même idée juste après »),
 *                    ou qui se suivent MOT À MOT à deux ou trois mots près (suite de mots communs, dans l'ordre : la
 *                    redite « Le devis part le lendemain, sans que personne y pense » reprise en fin de script avec
 *                    deux ou trois mots changés, que le recouvrement des mots pleins ne voit pas) ;
 *  3. `idee`       : trois mots pleins qui se suivent, repris dans plus de TOLERANCE_IDEE phrases ;
 *  4. `remplissage`: des phrases creuses seules (« Mais non. », « C'est tout. ») qui font au moins 20 % du texte.
 * Les mots fonctionnels (nous, vous, pour, dans…) ne comptent jamais pour (3). L'APPEL FINAL imposé (banque, base 7)
 * est hors du corps : il n'est ni comparé aux phrases du corps, ni signalé.
 */
import { texteCompare } from "@/domaine/controles-script/texte";

/** Recouvrement (Jaccard sur les mots de plus de 3 lettres) à partir duquel deux phrases sont « très proches ». */
export const SEUIL_JACCARD = 0.8;
/** Part de la plus courte phrase retrouvée dans la phrase d'à côté (phrases qui se suivent) pour parler de redite. */
export const SEUIL_CONTENU = 0.6;
/** Au moins ce nombre de mots pleins dans la plus courte phrase pour appliquer le seuil précédent. */
export const MOTS_PLEINS_MIN_CONTENU = 3;
/**
 * Redite à quelques mots près (calibrage du 18/10/2026 ; AVANT : seul le recouvrement de mots pleins, qui ne voit pas une
 * phrase reprise avec 2 ou 3 mots changés : son Jaccard tombe à 0,4 ou 0,5, sous le seuil de 0,8). La plus longue suite de
 * mots communs, dans l'ordre (LCS), doit couvrir au moins SEUIL_SEQUENCE de la plus longue phrase ET SEUIL_SEQUENCE_COURTE
 * de la plus courte, qui a au moins MOTS_SEQUENCE_MIN mots (sous 6 mots, un refrain court reste permis).
 */
export const SEUIL_SEQUENCE = 0.6;
export const SEUIL_SEQUENCE_COURTE = 0.75;
export const MOTS_SEQUENCE_MIN = 6;
/** Les mots d'une idée ne comptent qu'au-delà de cette longueur (donc « plus de 3 lettres »). */
export const LONGUEUR_MOT_PLEIN = 3;
/** Une phrase n'est une redite (identique ou proche) qu'à partir de ce nombre de mots (les refrains courts, « Quinze minutes. », restent permis). */
export const MOTS_REDITE_MIN = 4;
/** Une même suite de 3 mots pleins peut revenir jusqu'à 2 fois (l'appel de positionnement peut revenir une fois en fin). */
export const TOLERANCE_IDEE = 2;
/** Une phrase de remplissage a ce nombre de mots au plus. */
export const MOTS_REMPLISSAGE_MAX = 3;
/** Les phrases de remplissage sont tolérées sous cette part du texte (en mots). */
export const PART_REMPLISSAGE_MAX = 0.2;

export type GenreRepetition = "identique" | "proche" | "idee" | "remplissage";

export interface Repetition {
  genre: GenreRepetition;
  /** Clé stable (sert à voir si une correction AJOUTE une répétition). */
  cle: string;
  /** Phrase d'origine concernée (la seconde, en cas de redite). */
  phrase: string;
  message: string;
}

/** Mots fonctionnels de plus de 3 lettres : jamais comptés comme idée. */
const FONCTIONNELS = new Set(
  "nous vous votre vos notre nos leur leurs cette ces cela celui celle dans pour avec sans mais donc alors aussi elle elles ils sont etre fait faire etait tout tous toute toutes plus moins tres bien comme quand ainsi apres avant entre chez vers sous sur par que qui quoi dont ont avez avons peut peuvent faut fois encore deja jamais toujours ici voila voici meme autre autres chaque quel quelle".split(" "),
);
/** Mots d'une phrase creuse seule. */
const CREUX = new Set("mais non oui voila c est tout cest ca ce et ou alors donc bref ok voici".split(" "));

function mots(phrase: string): string[] {
  return texteCompare(phrase).replace(/['-]/g, " ").split(" ").filter(Boolean);
}
const cleDe = (phrase: string) => mots(phrase).join(" ");
const pleins = (phrase: string) => mots(phrase).filter((m) => m.length > LONGUEUR_MOT_PLEIN && !FONCTIONNELS.has(m));

/** Les phrases d'un texte dit. */
export function phrasesDuCorps(textes: readonly string[]): string[] {
  return textes.flatMap((t) => t.split(/(?<=[.!?…])\s+/)).map((p) => p.trim()).filter((p) => mots(p).length > 0);
}

function estRemplissage(phrase: string): boolean {
  const m = mots(phrase);
  return m.length > 0 && m.length <= MOTS_REMPLISSAGE_MAX && m.every((x) => CREUX.has(x) || (FONCTIONNELS.has(x) && !/\d/.test(x)));
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

/** Longueur de la plus longue suite de mots communs, dans l'ordre (programmation dynamique, phrases courtes). */
function suiteCommune(a: readonly string[], b: readonly string[]): number {
  let prec = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prec[j - 1] + 1 : Math.max(prec[j], cur[j - 1]);
    prec = cur;
  }
  return prec[b.length];
}

/** Deux phrases qui se suivent mot à mot à quelques mots près (voir `SEUIL_SEQUENCE`). */
function memeSuiteDeMots(p: string, q: string): boolean {
  const a = mots(p);
  const b = mots(q);
  const court = Math.min(a.length, b.length);
  if (court < MOTS_SEQUENCE_MIN) return false;
  const commun = suiteCommune(a, b);
  return commun / Math.max(a.length, b.length) >= SEUIL_SEQUENCE && commun / court >= SEUIL_SEQUENCE_COURTE;
}

/**
 * Cherche les répétitions dans le corps du script (accroche, segments…). `appel` : l'appel final imposé, hors corps ;
 * toute phrase du corps qui le reprend est retirée de la comparaison (jamais comptée comme redite de l'appel).
 */
export function trouverRepetitions(corps: readonly string[], appel = ""): Repetition[] {
  const clesAppel = new Set(phrasesDuCorps([appel]).map(cleDe));
  const phrases = phrasesDuCorps(corps).filter((p) => !clesAppel.has(cleDe(p)));
  const out: Repetition[] = [];
  const vues = new Map<string, number>();
  const jointes = new Set<number>();

  // 1. identiques
  phrases.forEach((p, i) => {
    const k = cleDe(p);
    if (!estRemplissage(p) && mots(p).length >= MOTS_REDITE_MIN && vues.has(k)) {
      out.push({ genre: "identique", cle: `identique:${k}`, phrase: p, message: `Phrase dite deux fois à l'identique : « ${p} »` });
      jointes.add(i);
    } else if (!vues.has(k)) vues.set(k, i);
  });

  // 2. très proches (ou la plus courte presque contenue dans la voisine)
  phrases.forEach((p, i) => {
    if (jointes.has(i) || estRemplissage(p)) return;
    const a = new Set(pleins(p));
    if (a.size < MOTS_PLEINS_MIN_CONTENU) return;
    for (let j = 0; j < i; j++) {
      const q = phrases[j];
      if (cleDe(q) === cleDe(p) || estRemplissage(q)) continue;
      const b = new Set(pleins(q));
      const court = a.size <= b.size ? a : b;
      const long = court === a ? b : a;
      if (b.size < MOTS_PLEINS_MIN_CONTENU) continue;
      const contenu = court.size >= MOTS_PLEINS_MIN_CONTENU && j === i - 1 && [...court].filter((x) => long.has(x)).length / court.size >= SEUIL_CONTENU;
      if ((a.size >= MOTS_REDITE_MIN && b.size >= MOTS_REDITE_MIN && jaccard(a, b) >= SEUIL_JACCARD) || contenu || memeSuiteDeMots(p, q)) {
        out.push({ genre: "proche", cle: `proche:${[cleDe(q), cleDe(p)].sort().join("|")}`, phrase: p, message: `Phrase presque identique à une autre : « ${p} » (voir « ${q} »)` });
        jointes.add(i);
        break;
      }
    }
  });

  // 3. même idée sous trop de phrases (trois mots pleins qui se suivent)
  const suites = new Map<string, Set<number>>();
  phrases.forEach((p, i) => {
    const m = mots(p).filter((x) => x.length > LONGUEUR_MOT_PLEIN && !FONCTIONNELS.has(x) && !CREUX.has(x));
    for (let k = 0; k + 3 <= m.length; k++) {
      const t = m.slice(k, k + 3).join(" ");
      suites.set(t, (suites.get(t) ?? new Set()).add(i));
    }
  });
  const deja = new Set<number>();
  for (const [t, ix] of suites) {
    if (ix.size <= TOLERANCE_IDEE) continue;
    const derniere = Math.max(...ix);
    if ([...ix].every((i) => jointes.has(i) || deja.has(i))) continue;
    [...ix].forEach((i) => deja.add(i));
    out.push({ genre: "idee", cle: `idee:${t}`, phrase: phrases[derniere], message: `La même idée (« ${t} ») revient dans ${ix.size} phrases.` });
  }

  // 4. remplissage seul, à partir de 20 % du texte
  const total = phrases.reduce((s, p) => s + mots(p).length, 0);
  const creuses = phrases.filter(estRemplissage);
  const motsCreux = creuses.reduce((s, p) => s + mots(p).length, 0);
  if (creuses.length && total > 0 && motsCreux / total >= PART_REMPLISSAGE_MAX) {
    out.push({ genre: "remplissage", cle: "remplissage", phrase: creuses[0], message: `Phrases de remplissage seules (« ${creuses[0]} »…) : ${Math.round((100 * motsCreux) / total)} % du texte.` });
  }
  return out;
}

/** Le relevé, en lignes pour le relecteur (consigne : supprime la répétition, ne réécris pas le reste). */
export function alertesRepetitions(corps: readonly string[], appel = ""): string[] {
  return trouverRepetitions(corps, appel).map((r) => `REPETITION : ${r.message} — supprime la répétition, ne réécris pas le reste.`);
}

/**
 * Garde-fou de relecture : parmi des corrections de segments (texte vide = suppression), garde celles qui n'AJOUTENT
 * aucune répétition au corps (accroche + segments). Appliquées l'une après l'autre.
 */
export function garderSansNouvelleRepetition<C extends { segmentIndex: number; texte: string }>(
  accroche: string,
  segments: readonly { texte: string }[],
  corrections: readonly C[],
  appel = "",
): { gardees: C[]; refusees: string[] } {
  const courants = segments.map((s) => s.texte);
  const clesDe = (segs: readonly string[]) => new Set(trouverRepetitions([accroche, ...segs], appel).map((r) => r.cle));
  let connues = clesDe(courants);
  const gardees: C[] = [];
  const refusees: string[] = [];
  for (const x of corrections) {
    if (!segments[x.segmentIndex]) {
      gardees.push(x);
      continue;
    }
    const essai = courants.map((t, i) => (i === x.segmentIndex ? x.texte : t));
    const apres = clesDe(essai);
    const ajoutee = [...apres].find((k) => !connues.has(k));
    if (ajoutee) {
      refusees.push(`REPETITION : correction du segment ${x.segmentIndex} refusée (elle ajoute une répétition : ${ajoutee.split(":")[0]})`);
      continue;
    }
    courants[x.segmentIndex] = x.texte;
    connues = apres;
    gardees.push(x);
  }
  return { gardees, refusees };
}
