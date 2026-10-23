/**
 * BRIQUE COUPES (plan facecam v4, lot B ; EXIGENCES-WILL n° 6 et 7). PURE : aucun dépôt, aucun réseau.
 *
 * À partir de la transcription horodatée au mot de la PRISE D'ORIGINE (jamais modifiée), elle propose les passages à
 * retirer ; tout se rétablit d'un toucher (rétablir = assemblage seul).
 *  1. consignes « Monteur, … » repérées AVANT tout le reste, y compris dans les passages jetés (type `consigne`) ;
 *  2. avec le texte validé : chaque phrase est retrouvée dans la prise, et on garde sa DERNIÈRE occurrence complète
 *     (les essais abandonnés ou refaits sont des `reprise`) ; ce qui précède la première phrase est le `debut` à jeter,
 *     ce qui suit la dernière est la `fin` à jeter. Si trop peu de phrases sont retrouvées : bascule en vidéo libre ;
 *  3. sans texte (vidéo libre) : bavardage d'installation en début et en fin, redémarrages (« pardon », « je
 *     recommence », début de phrase répété) ;
 *  4. dans ce qui reste : « euh », mots bégayés et mots inachevés (`hesitation`) ;
 *  4 bis. (V6) aucune phrase en double : une suite d'au moins 4 mots redite à moins de 10 s est coupée la première
 *     fois (`reprise`), sauf si le texte validé la contient lui-même deux fois (répétition voulue) ;
 *  5. blancs de plus de 0,25 s ramenés à 0,10 s (dans une phrase) ou 0,15 s (entre deux phrases) ; une « chute » de
 *     0,35-0,6 s est gardée avant une phrase forte, 2 fois au plus par vidéo ;
 *  2 bis. mode texte : une reprise ABSORBÉE par l'alignement forcé (mots étirés, trous en pleine phrase) est retrouvée
 *     (`absorbees.ts`) ; la première tentative devient une `reprise` et les mots sont recalés sur la prise complète ;
 *  6. on coupe toujours entre deux mots, jamais dans un mot, bornes calées sur les images (25 i/s) ; on garde 3 images
 *     avant le premier mot et 7 images après le dernier (v4 n° 23 : fin 6 à 8 images après le dernier mot) ;
 *  7. (10/10) une phrase non retrouvée telle quelle mais DITE AUTREMENT à sa place (entre ses voisines retrouvées,
 *     passage gardé, assez de mots en commun) n'est plus « manquante » : les sous-titres y prennent les mots dits.
 */
import type { CoupeFacecam } from "@/domaine/facecam";
import type { MotHorodate } from "@/domaine/types";
import { reprisesAbsorbees } from "./absorbees";
import { reperesConsignes, type ConsigneReperee } from "./consignes";
import { corrigerLexique } from "./lexique";
import { estHesitation, estMotInacheve, finitPhrase, jetonsDits, memeMot, normaliser, occurrences, phrasesDuTexte, tokens, type Occurrence } from "./texte";

export { reperesConsignes, versConsignesFacecam, type ConsigneReperee } from "./consignes";
export { phrasesDuTexte, normaliser } from "./texte";
export { corrigerLexique, LEXIQUE_MARQUE } from "./lexique";
export { reprisesAbsorbees, REGLES_ABSORBEES, type RepriseAbsorbee } from "./absorbees";

export const VERSION_BRIQUE_COUPES = "coupes-1";

export interface ReglesCoupes {
  /** Un blanc plus long est raccourci (v4 n° 18 : 0,25 s). */
  seuilSilenceSec: number;
  /** Respiration gardée : dans une phrase, puis entre deux phrases (v4 n° 18 : 0,10 à 0,15 s). */
  respirationSec: [number, number];
  /** Avant le premier mot gardé (3 images) et après le dernier (7 images). */
  margeDebutSec: number;
  margeFinSec: number;
  /** Chute gardée avant une phrase forte : au moins, au plus. */
  chuteSec: [number, number];
  chutesMax: number;
  imagesParSec: number;
  /** Part des phrases du texte à retrouver ; en dessous, la vidéo est montée comme une vidéo libre. */
  phrasesTrouveesMin: number;
}

export const REGLES_COUPES_PAR_DEFAUT: ReglesCoupes = {
  seuilSilenceSec: 0.25,
  respirationSec: [0.1, 0.15],
  margeDebutSec: 0.12,
  margeFinSec: 0.28,
  chuteSec: [0.35, 0.6],
  chutesMax: 2,
  imagesParSec: 25,
  phrasesTrouveesMin: 0.6,
};

export interface EntreeCoupes {
  /** Transcription horodatée au mot de toute la prise (temps de la prise d'origine). */
  mots: MotHorodate[];
  dureeSec: number;
  /** Texte validé (mode « je lis ») ; absent : vidéo libre. */
  texteValide?: string;
  /** Index des phrases fortes (phrases du texte, ou phrases dites en vidéo libre) choisies ailleurs (Claude, D2). */
  phrasesFortes?: number[];
  /**
   * Transcription LIBRE facultative (Whisper, temps de la prise), quand `mots` vient d'un alignement forcé du texte :
   * elle situe exactement le départ d'une reprise absorbée. Absente : départ estimé au débit de la personne.
   */
  motsLibres?: MotHorodate[];
  regles?: Partial<ReglesCoupes>;
}

/** Nouveaux temps d'un mot recalé sur la prise complète d'une reprise absorbée (repéré par son mot et son ancien début). */
export interface RecalageMot {
  mot: string;
  avantSec: number;
  debutSec: number;
  finSec: number;
}

export interface Intervalle {
  debutSec: number;
  finSec: number;
}

/** Une phrase du texte validé, retrouvée (ou non) dans la prise. */
export interface PhraseRetrouvee {
  index: number;
  texte: string;
  /** Occurrence gardée (temps de la prise), absente si la phrase n'a pas été retrouvée. */
  debutSec?: number;
  finSec?: number;
  couverture: number;
  /** Nombre d'essais entendus (1 = dite une fois ; 2 et plus = reprise). */
  essais: number;
  /**
   * (10/10) Phrase non retrouvée telle quelle mais DITE AUTREMENT à sa place, passage gardé au montage : ses temps
   * (prise), la part des mots du texte entendus, et les mots dits (lexique de marque appliqué) pour les sous-titres.
   */
  diteAutrement?: { debutSec: number; finSec: number; recouvrement: number; texteDit: string };
}

export interface PlanCoupes {
  version: string;
  mode: "texte" | "libre";
  /** Le texte validé n'a pas été retrouvé : bascule en vidéo libre (état « texte non retrouvé »). */
  texteNonRetrouve: boolean;
  /** Coupes proposées, triées, sans chevauchement (temps de la prise). */
  coupes: CoupeFacecam[];
  /** Passages gardés : le complément des coupes. */
  gardes: Intervalle[];
  consignes: ConsigneReperee[];
  /** Mode texte : chaque phrase du texte et l'occurrence gardée. */
  phrases: PhraseRetrouvee[];
  /** Chutes gardées avant une phrase forte (temps de la prise). */
  chutes: Intervalle[];
  /** Mode texte : mots recalés après une reprise absorbée (à appliquer aux mots de la prise : `appliquerRecalages`). */
  recalages: RecalageMot[];
  dureeSourceSec: number;
  dureeSortieSec: number;
}

type Statut = "garde" | Exclude<CoupeFacecam["type"], "silence">;

const arrondi = (x: number) => +x.toFixed(3);

/* ------------------------------------------------------------------ */
/* Mode texte : dernière occurrence complète de chaque phrase          */
/* ------------------------------------------------------------------ */

interface ChoixTexte {
  phrases: PhraseRetrouvee[];
  /** Pour chaque phrase retrouvée : premier et dernier mot (index de la transcription). */
  bornes: ({ premier: number; dernier: number } | null)[];
}

function choisirOccurrences(mots: MotHorodate[], texte: string, exclus: Set<number>): ChoixTexte {
  const phrasesTexte = phrasesDuTexte(texte);
  const dits = jetonsDits(mots, (i) => !exclus.has(i) && !estHesitation(mots[i].mot));
  const occ = phrasesTexte.map((p) => occurrences(tokens(p), dits));
  const choix: (Occurrence | null)[] = phrasesTexte.map(() => null);
  // À rebours : la dernière phrase prend sa dernière occurrence complète, chaque phrase précédente la dernière qui
  // finit avant le départ de la suivante. On garde ainsi le dernier essai complet de chaque phrase.
  let limite = dits.length;
  for (let j = phrasesTexte.length - 1; j >= 0; j--) {
    const possibles = occ[j].filter((o) => o.fin < limite);
    const complete = possibles.filter((o) => o.complete).sort((a, b) => b.debut - a.debut)[0];
    const meilleure = complete ?? possibles.filter((o) => o.couverture >= 0.5).sort((a, b) => b.couverture - a.couverture || b.debut - a.debut)[0];
    if (!meilleure) continue;
    choix[j] = meilleure;
    limite = meilleure.debut;
  }
  return {
    phrases: phrasesTexte.map((texteP, index) => {
      const o = choix[index];
      return {
        index,
        texte: texteP,
        ...(o ? { debutSec: mots[dits[o.debut].mot].debutSec, finSec: mots[dits[o.fin].mot].finSec } : {}),
        couverture: o ? +o.couverture.toFixed(2) : 0,
        essais: occ[index].length,
      };
    }),
    bornes: choix.map((o) => (o ? { premier: dits[o.debut].mot, dernier: dits[o.fin].mot } : null)),
  };
}

/** Mots gardés regardés après un passage écarté pour y chercher son début redit (≈ une à deux phrases). */
const PORTEE_REDITE = 40;

/**
 * Dans le doute, on GARDE (une phrase de trop vaut mieux qu'une phrase perdue). Un passage écarté entre deux phrases
 * retrouvées n'est une `reprise` que s'il est RÉELLEMENT redit ensuite : ses premiers mots (3 au plus) reviennent tels
 * quels dans ce qui est gardé juste après — tout de suite (« Si vous sentez que… / Si vous sentez que du temps… »), ou
 * un peu plus loin pour un passage d'au moins 2 mots. Sinon c'est une phrase dite une seule fois que l'alignement n'a
 * pas su rattacher (mots mal entendus, fin mal transcrite, « ? » isolé) : elle reste.
 */
function garderCeQuiNEstPasRedit(mots: MotHorodate[], statut: Statut[], exclus: Set<number>): void {
  const compte = (i: number) => !exclus.has(i) && !estHesitation(mots[i].mot);
  let i = 0;
  while (i < mots.length) {
    if (statut[i] !== "reprise") {
      i++;
      continue;
    }
    let f = i;
    while (f + 1 < mots.length && (statut[f + 1] === "reprise" || exclus.has(f + 1))) f++;
    const passage = jetonsDits(mots.slice(i, f + 1), (k) => compte(i + k)).map((j) => j.forme);
    const suite: string[] = [];
    for (let k = f + 1; k < mots.length && suite.length < PORTEE_REDITE; k++) {
      if (statut[k] === "garde" && compte(k)) suite.push(...tokens(mots[k].mot));
    }
    const n = Math.min(3, passage.length);
    const reditA = (p: number) => passage.slice(0, n).every((forme, k) => p + k < suite.length && memeMot(forme, suite[p + k]));
    const redit = n > 0 && (reditA(0) || (n >= 2 && suite.some((_, p) => p > 0 && reditA(p))));
    if (!redit) for (let k = i; k <= f; k++) if (statut[k] === "reprise") statut[k] = "garde";
    i = f + 1;
  }
}

/* ------------------------------------------------------------------ */
/* Mode libre : bavardage, redémarrages                                */
/* ------------------------------------------------------------------ */

const BAVARDAGE_DEBUT = /^(ok|okay|bon|alors|allez|attends?|c ?est bon|c ?est parti|ca tourne|ca enregistre|on y va|vas ?y|action|top|je commence|on commence|c ?est bon ca tourne|ca marche|test|un deux)\b/;
const BAVARDAGE_FIN = /^(voila|c ?est bon|coupe|coupez|stop|termine|c ?est fini|ok|okay|et voila|bon)\b/;
const MARQUEURS_REPRISE = /\b(pardon|je recommence|je reprends|on recommence|on reprend|je refais|attendez|attends|non pardon|zut|mince)\b/;

function phrasesDites(mots: MotHorodate[], exclus: Set<number>): number[][] {
  const phrases: number[][] = [];
  let cour: number[] = [];
  let precedent = -1;
  mots.forEach((m, i) => {
    if (exclus.has(i)) return;
    if (cour.length && precedent >= 0 && m.debutSec - mots[precedent].finSec >= 0.7) {
      phrases.push(cour);
      cour = [];
    }
    cour.push(i);
    precedent = i;
    if (finitPhrase(m.mot)) {
      phrases.push(cour);
      cour = [];
    }
  });
  if (cour.length) phrases.push(cour);
  return phrases;
}

const formeDe = (mots: MotHorodate[], idx: number[]) => idx.map((i) => tokens(mots[i].mot).join(" ")).join(" ").trim();

function statutsLibres(mots: MotHorodate[], statut: Statut[], exclus: Set<number>): number[][] {
  const phrases = phrasesDites(mots, exclus);
  const marquer = (idx: number[], s: Statut) => idx.forEach((i) => (statut[i] = s));
  // Bavardage d'installation (phrases courtes du début et de la fin).
  let p0 = 0;
  while (p0 < phrases.length - 1 && phrases[p0].length <= 8 && BAVARDAGE_DEBUT.test(formeDe(mots, phrases[p0]))) marquer(phrases[p0++], "debut");
  let p1 = phrases.length - 1;
  while (p1 > p0 && phrases[p1].length <= 6 && BAVARDAGE_FIN.test(formeDe(mots, phrases[p1]))) marquer(phrases[p1--], "fin");
  for (let p = p0; p <= p1; p++) {
    const idx = phrases[p];
    const forme = formeDe(mots, idx);
    const suivante = p < p1 ? tokens(formeDe(mots, phrases[p + 1])) : [];
    const t = tokens(forme);
    // Début de phrase répété : « Si vous sentez que… / Si vous sentez que du temps vous échappe. »
    const prefixe = Math.min(3, t.length);
    if (suivante.length >= prefixe && prefixe >= 2 && t.slice(0, prefixe).every((x, k) => x === suivante[k]) && t.length <= suivante.length + 2) {
      marquer(idx, "reprise");
      continue;
    }
    const m = MARQUEURS_REPRISE.exec(forme);
    if (!m) continue;
    if (t.length <= 5) {
      // « Pardon, je recommence. » : la phrase et celle d'avant (abandonnée) sont retirées.
      marquer(idx, "reprise");
      if (p > p0 && statut[phrases[p - 1][0]] === "garde") marquer(phrases[p - 1], "reprise");
      continue;
    }
    // Marqueur au milieu : on retire du début de la phrase jusqu'au marqueur compris.
    const motsMarqueur = tokens(m[0]).length;
    let lus = 0;
    for (const i of idx) {
      statut[i] = "reprise";
      lus += tokens(mots[i].mot).length;
      if (lus >= tokens(forme.slice(0, m.index)).length + motsMarqueur) break;
    }
  }
  return phrases;
}

/* ------------------------------------------------------------------ */
/* Hésitations dans ce qui est gardé                                   */
/* ------------------------------------------------------------------ */

function marquerHesitations(mots: MotHorodate[], statut: Statut[]): void {
  const gardes = statut.map((s, i) => (s === "garde" ? i : -1)).filter((i) => i >= 0);
  for (const i of gardes) if (estHesitation(mots[i].mot) || estMotInacheve(mots[i].mot)) statut[i] = "hesitation";
  // Bégaiement : « le le », « il faut il faut » → le premier est retiré.
  const restants = statut.map((s, i) => (s === "garde" ? i : -1)).filter((i) => i >= 0);
  for (const taille of [2, 1]) {
    for (let k = 0; k + 2 * taille <= restants.length; k++) {
      const a = restants.slice(k, k + taille);
      const b = restants.slice(k + taille, k + 2 * taille);
      if (a.some((i) => statut[i] !== "garde") || b.some((i) => statut[i] !== "garde")) continue;
      const fa = a.map((i) => normaliser(mots[i].mot)).join(" ");
      const fb = b.map((i) => normaliser(mots[i].mot)).join(" ");
      const proches = mots[b[0]].debutSec - mots[a[taille - 1]].finSec < 0.6;
      if (fa && fa === fb && proches && (taille > 1 || fa.length <= 4) && !finitPhrase(mots[a[taille - 1]].mot)) a.forEach((i) => (statut[i] = "hesitation"));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Phrases en double (V6 P0 n° 8)                                      */
/* ------------------------------------------------------------------ */

export const REGLES_DOUBLES = {
  /** Une redite compte à partir de 4 mots identiques à la suite. */
  motsMin: 4,
  /** … dite à moins de 10 s (entre la fin de la première et le début de la seconde). */
  ecartMaxSec: 10,
} as const;

/** Une suite de mots dite deux fois : index des mots de la première et de la seconde fois. */
export interface Double {
  premier: number[];
  second: number[];
  texte: string;
}

/** Suites de `motsMin` formes que le texte validé contient lui-même deux fois (répétition voulue : jamais coupée). */
function repetitionsVoulues(texte: string | undefined): Set<string> {
  const voulues = new Set<string>();
  if (!texte) return voulues;
  const t = tokens(texte);
  const vues = new Map<string, number>();
  for (let i = 0; i + REGLES_DOUBLES.motsMin <= t.length; i++) {
    const cle = t.slice(i, i + REGLES_DOUBLES.motsMin).join(" ");
    vues.set(cle, (vues.get(cle) ?? 0) + 1);
    if ((vues.get(cle) ?? 0) >= 2) voulues.add(cle);
  }
  return voulues;
}

/**
 * Suites de mots dites deux fois parmi les mots `gardes` (index, dans l'ordre), hésitations ignorées. La plus longue
 * suite commune est prise (au moins `motsMin` formes) ; la seconde fois commence au plus `ecartMaxSec` après la fin de
 * la première, et les deux ne se chevauchent pas.
 */
function doublesParmi(mots: MotHorodate[], gardes: number[], texteValide?: string): Double[] {
  const voulues = repetitionsVoulues(texteValide);
  // Une forme par jeton (« l'entreprise » → « l », « entreprise »), rattachée à son mot.
  const seq: { mot: number; forme: string }[] = [];
  for (const i of gardes) if (!estHesitation(mots[i].mot)) for (const f of tokens(mots[i].mot)) seq.push({ mot: i, forme: f });
  const doubles: Double[] = [];
  const pris = new Set<number>();
  for (let a = 0; a < seq.length; a++) {
    if (pris.has(a)) continue;
    let meilleur: { b: number; n: number } | null = null;
    for (let b = a + REGLES_DOUBLES.motsMin; b < seq.length; b++) {
      if (mots[seq[b].mot].debutSec - mots[seq[a].mot].finSec > REGLES_DOUBLES.ecartMaxSec + 30) break;
      let n = 0;
      while (a + n < b && b + n < seq.length && seq[a + n].forme === seq[b + n].forme) n++;
      if (n < REGLES_DOUBLES.motsMin) continue;
      const finPremier = mots[seq[a + n - 1].mot].finSec;
      if (mots[seq[b].mot].debutSec - finPremier > REGLES_DOUBLES.ecartMaxSec) continue;
      if (seq.slice(a, a + n).map((x) => x.forme).some((_, k, f) => k + REGLES_DOUBLES.motsMin <= f.length && voulues.has(f.slice(k, k + REGLES_DOUBLES.motsMin).join(" ")))) continue;
      if (!meilleur || n > meilleur.n) meilleur = { b, n };
    }
    if (!meilleur) continue;
    const premier = [...new Set(seq.slice(a, a + meilleur.n).map((x) => x.mot))];
    const second = [...new Set(seq.slice(meilleur.b, meilleur.b + meilleur.n).map((x) => x.mot))];
    if (premier.some((i) => second.includes(i))) continue;
    doubles.push({ premier, second, texte: premier.map((i) => mots[i].mot).join(" ") });
    for (let k = a; k < a + meilleur.n; k++) pris.add(k);
    for (let k = meilleur.b; k < meilleur.b + meilleur.n; k++) pris.add(k);
  }
  return doubles;
}

/**
 * Suites de mots entendues DEUX FOIS dans le montage (`gardes` : passages gardés de la prise) : le contrôle « aucune
 * phrase en double » (EXIGENCES-WILL l. 27).
 */
export function doublesDansLesGardes(mots: MotHorodate[], gardes: Intervalle[], texteValide?: string): Double[] {
  const dedans = (m: MotHorodate) => gardes.some((g) => (m.debutSec + m.finSec) / 2 >= g.debutSec - 1e-6 && (m.debutSec + m.finSec) / 2 <= g.finSec + 1e-6);
  return doublesParmi(mots, mots.map((m, i) => (dedans(m) ? i : -1)).filter((i) => i >= 0), texteValide);
}

/* ------------------------------------------------------------------ */
/* Phrases dites autrement (10/10)                                     */
/* ------------------------------------------------------------------ */

export const REGLES_DITE_AUTREMENT = {
  /** Part des mots de la phrase du texte entendus dans le passage, dans l'ordre. */
  recouvrementMin: 0.5,
  /** Part des mots dits du passage qui viennent de la phrase (un long passage sans rapport n'est pas la phrase). */
  precisionMin: 0.5,
} as const;

/** Plus longue sous-suite commune de deux suites de formes (mots proches acceptés : « possible » / « possibles »). */
function communs(a: string[], b: string[]): number {
  let prec = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cour = [0];
    for (let j = 1; j <= b.length; j++) cour[j] = memeMot(a[i - 1], b[j - 1]) ? prec[j - 1] + 1 : Math.max(prec[j], cour[j - 1]);
    prec = cour;
  }
  return prec[b.length];
}

/** Mots dits d'un passage, mis au propre pour les sous-titres : lexique de marque, majuscule et ponctuation finale du texte. */
function texteDitPropre(mots: string[], phraseTexte: string): string {
  const m = corrigerLexique(mots.filter((x) => tokens(x).length));
  if (!m.length) return "";
  if (/^[A-ZÀ-Ý]/.test(phraseTexte.trim())) m[0] = m[0].charAt(0).toUpperCase() + m[0].slice(1);
  const fin = /[.?!…]+["»”]?$/.exec(phraseTexte.trim())?.[0];
  const n = m.length - 1;
  if (fin) m[n] = m[n].replace(/[\s ]*[?!:;,.…]+$/, "") + (/^[?!]/.test(fin) ? ` ${fin}` : fin);
  return m.join(" ");
}

/**
 * Une phrase du texte non retrouvée, seule entre deux phrases retrouvées, est « dite autrement » quand le passage
 * GARDÉ entre ses voisines en reprend assez de mots dans l'ordre (et ne dit pas surtout autre chose). Rien ne change
 * aux coupes : la phrase garde `debutSec` absent ; seul l'état et le texte des sous-titres sont ajoutés.
 */
function reconnaitreDitesAutrement(mots: MotHorodate[], statut: Statut[], phrases: PhraseRetrouvee[], bornes: ChoixTexte["bornes"]): PhraseRetrouvee[] {
  return phrases.map((p, j) => {
    const avant = bornes[j - 1];
    const apres = bornes[j + 1];
    if (bornes[j] || !avant || !apres) return p;
    const idx = range(avant.dernier + 1, apres.premier).filter((i) => statut[i] === "garde" && !estHesitation(mots[i].mot) && !estMotInacheve(mots[i].mot) && tokens(mots[i].mot).length);
    if (!idx.length) return p;
    const dits = idx.flatMap((i) => tokens(mots[i].mot));
    const attendus = tokens(p.texte);
    const n = communs(attendus, dits);
    const recouvrement = n / Math.max(1, attendus.length);
    if (recouvrement < REGLES_DITE_AUTREMENT.recouvrementMin || n / dits.length < REGLES_DITE_AUTREMENT.precisionMin) return p;
    const texteDit = texteDitPropre(idx.map((i) => mots[i].mot), p.texte);
    if (!texteDit) return p;
    return { ...p, diteAutrement: { debutSec: mots[idx[0]].debutSec, finSec: mots[idx[idx.length - 1]].finSec, recouvrement: +recouvrement.toFixed(2), texteDit } };
  });
}

/**
 * Le texte des sous-titres en mode texte : les phrases gardées au montage, dans l'ordre, et pour une phrase dite
 * autrement les mots réellement dits (calés ensuite sur leurs vrais instants, au lieu d'un trou).
 */
export function texteDesSousTitres(phrases: PhraseRetrouvee[]): string {
  return phrases.flatMap((p) => (p.debutSec !== undefined ? [p.texte] : p.diteAutrement ? [p.diteAutrement.texteDit] : [])).join(" ");
}

/* ------------------------------------------------------------------ */
/* Phrases fortes (chute gardée avant)                                 */
/* ------------------------------------------------------------------ */

const DEBUTS_FORTS = /^(mais|resultat|la verite|le probleme|sauf que|attention|et la|et pourtant|imaginez|le secret|voici)\b/;

function scorePhraseForte(texte: string): number {
  const t = tokens(texte);
  let s = 0;
  if (/!["»”]?\s*$/.test(texte)) s += 2;
  if (/\?["»”]?\s*$/.test(texte)) s += 1;
  if (/\d/.test(texte)) s += 1;
  if (DEBUTS_FORTS.test(t.join(" "))) s += 1;
  if (t.length <= 6) s += 1;
  if (t.length > 14) s -= 2;
  return s;
}

/* ------------------------------------------------------------------ */
/* Construction des coupes                                             */
/* ------------------------------------------------------------------ */

function libelleDe(type: CoupeFacecam["type"], debutSec: number, finSec: number, mots: MotHorodate[], idx: number[]): string {
  const duree = `${(finSec - debutSec).toFixed(1).replace(".", ",")} s`;
  const extrait = (n: number) => {
    const t = idx.slice(0, n).map((i) => mots[i].mot).join(" ").replace(/[.,;:!?…]+$/, "");
    return idx.length > n ? `${t}…` : t;
  };
  switch (type) {
    case "debut":
      return `Début à jeter (${duree})`;
    case "fin":
      return `Fin à jeter (${duree})`;
    case "reprise":
      return idx.length ? `Phrase reprise : « ${extrait(7)} »` : `Phrase reprise (${duree})`;
    case "consigne":
      return `Consigne au monteur : « ${extrait(8)} »`;
    case "hesitation":
      return idx.length ? `Hésitation : « ${extrait(3)} »` : "Hésitation";
    default:
      return `Blanc de ${duree}`;
  }
}

/**
 * Calcule le plan de coupes. Ne lève jamais : une transcription vide rend une vidéo gardée en entier (aucune coupe).
 */
export function calculerCoupes(e: EntreeCoupes): PlanCoupes {
  const r: ReglesCoupes = { ...REGLES_COUPES_PAR_DEFAUT, ...e.regles };
  const mots = [...e.mots].filter((m) => Number.isFinite(m.debutSec) && Number.isFinite(m.finSec) && m.finSec >= m.debutSec).sort((a, b) => a.debutSec - b.debutSec);
  const duree = Math.max(e.dureeSec, mots.length ? mots[mots.length - 1].finSec : 0);
  const vide: PlanCoupes = { version: VERSION_BRIQUE_COUPES, mode: e.texteValide ? "texte" : "libre", texteNonRetrouve: false, coupes: [], gardes: [{ debutSec: 0, finSec: arrondi(duree) }], consignes: [], phrases: [], chutes: [], recalages: [], dureeSourceSec: duree, dureeSortieSec: duree };
  if (!mots.length) return vide;

  // 1. Consignes, avant tout le reste.
  const consignes = reperesConsignes(mots);
  const statut: Statut[] = mots.map(() => "garde");
  const exclus = new Set<number>();
  for (const c of consignes) for (let i = c.premierMot; i <= c.dernierMot; i++) exclus.add(i);

  // 2-3. Texte validé, sinon vidéo libre.
  let mode: PlanCoupes["mode"] = "libre";
  let texteNonRetrouve = false;
  let phrases: PhraseRetrouvee[] = [];
  /** Premier mot de chaque phrase gardée, et son texte (pour la chute). */
  let debutsPhrases: { mot: number; texte: string; index: number }[] = [];
  const recalages: RecalageMot[] = [];
  /** Reprises absorbées : première tentative retirée, mots recalés sur la prise complète. */
  const absorbees: { debutSec: number; finSec: number; idx: number[] }[] = [];
  let bornes: ChoixTexte["bornes"] = [];
  if (e.texteValide?.trim()) {
    const choix = choisirOccurrences(mots, e.texteValide, exclus);
    bornes = choix.bornes;
    const trouvees = choix.bornes.filter(Boolean).length;
    if (choix.phrases.length && trouvees / choix.phrases.length >= r.phrasesTrouveesMin) {
      mode = "texte";
      phrases = choix.phrases;
      const gardesTexte = new Set<number>();
      choix.bornes.forEach((b) => {
        if (b) for (let i = b.premier; i <= b.dernier; i++) gardesTexte.add(i);
      });
      const premier = Math.min(...choix.bornes.filter((b) => b).map((b) => b!.premier));
      const dernier = Math.max(...choix.bornes.filter((b) => b).map((b) => b!.dernier));
      mots.forEach((_, i) => {
        if (gardesTexte.has(i)) return;
        statut[i] = i < premier ? "debut" : i > dernier ? "fin" : "reprise";
      });
      garderCeQuiNEstPasRedit(mots, statut, exclus);
      debutsPhrases = choix.bornes.flatMap((b, index) => (b ? [{ mot: b.premier, texte: choix.phrases[index].texte, index }] : []));
      // 2 bis. Reprises absorbées par l'alignement forcé : mots recalés sur la prise complète (copies, jamais l'entrée).
      const gardesTexte2 = statut.map((st, i) => (st === "garde" && !exclus.has(i) ? i : -1)).filter((i) => i >= 0);
      for (const rep of reprisesAbsorbees(mots, gardesTexte2, debutsPhrases.map((d) => d.mot), e.motsLibres)) {
        for (const x of rep.recalages) {
          recalages.push({ mot: mots[x.index].mot, avantSec: mots[x.index].debutSec, debutSec: x.debutSec, finSec: x.finSec });
          mots[x.index] = { ...mots[x.index], debutSec: x.debutSec, finSec: x.finSec };
        }
        absorbees.push({ debutSec: rep.debutSec, finSec: rep.finSec, idx: rep.recalages.map((x) => x.index) });
      }
      if (absorbees.length) {
        phrases = phrases.map((p) => {
          const b = choix.bornes[p.index];
          if (!b) return p;
          const touchee = absorbees.some((z) => z.idx.some((i) => i >= b.premier && i <= b.dernier));
          return { ...p, debutSec: mots[b.premier].debutSec, finSec: mots[b.dernier].finSec, ...(touchee ? { essais: Math.max(2, p.essais) } : {}) };
        });
      }
    } else {
      texteNonRetrouve = true;
    }
  }
  if (mode === "libre") {
    const dites = statutsLibres(mots, statut, exclus);
    debutsPhrases = dites
      .map((idx, index) => ({ idx, index }))
      .filter(({ idx }) => statut[idx[0]] === "garde")
      .map(({ idx, index }) => ({ mot: idx[0], texte: idx.map((i) => mots[i].mot).join(" "), index }));
  }
  for (const i of exclus) statut[i] = "consigne";

  // 4. Hésitations dans ce qui est gardé.
  marquerHesitations(mots, statut);
  // 4 bis. (V6) Aucune phrase en double : la première fois est coupée (on garde le dernier essai, comme en mode texte).
  for (const d of doublesParmi(mots, statut.map((st, i) => (st === "garde" ? i : -1)).filter((i) => i >= 0), e.texteValide)) {
    for (const i of d.premier) statut[i] = "reprise";
  }
  // 7. (10/10) Phrases dites autrement, d'après les mots finalement gardés.
  if (mode === "texte") phrases = reconnaitreDitesAutrement(mots, statut, phrases, bornes);

  const gardes = statut.map((s, i) => (s === "garde" ? i : -1)).filter((i) => i >= 0);
  if (!gardes.length) return { ...vide, mode, texteNonRetrouve, consignes, phrases };

  // 5. Chutes : avant les phrases fortes (choisies ailleurs, sinon les mieux notées), 2 au plus.
  const fortes = new Set<number>();
  const candidates = debutsPhrases.filter((d) => {
    if (absorbees.some((z) => z.idx[0] === d.mot)) return false;
    const k = gardes.indexOf(d.mot);
    return k > 0 && mots[d.mot].debutSec - mots[gardes[k - 1]].finSec >= r.chuteSec[0];
  });
  const choisies = e.phrasesFortes
    ? candidates.filter((d) => e.phrasesFortes!.includes(d.index))
    : candidates.map((d) => ({ d, s: scorePhraseForte(d.texte) })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s || a.d.mot - b.d.mot).map((x) => x.d);
  choisies.slice(0, r.chutesMax).forEach((d) => fortes.add(d.mot));

  // 6. Coupes : avant le premier mot gardé, entre deux mots gardés, après le dernier.
  const image = 1 / r.imagesParSec;
  const versLeHaut = (x: number) => Math.ceil(x / image - 1e-6) * image;
  const versLeBas = (x: number) => Math.floor(x / image + 1e-6) * image;
  const coupes: CoupeFacecam[] = [];
  const chutes: Intervalle[] = [];
  const ajouter = (type: CoupeFacecam["type"], debut: number, fin: number, idx: number[]) => {
    const d = arrondi(Math.max(0, versLeHaut(debut)));
    const f = arrondi(Math.min(duree, fin >= duree - 1e-6 ? duree : versLeBas(fin)));
    if (f - d < image - 1e-6) return;
    const precedente = coupes[coupes.length - 1];
    if (precedente && precedente.type === type && Math.abs(precedente.finSec - d) < 1e-6) {
      precedente.finSec = f;
      precedente.libelle = libelleDe(type, precedente.debutSec, f, mots, idx);
      return;
    }
    coupes.push({ id: `${type}-${Math.round(d * 100)}`, type, debutSec: d, finSec: f, libelle: libelleDe(type, d, f, mots, idx) });
  };
  /** Découpe une zone retirée [debut, fin] selon les mots retirés qu'elle contient (consigne, reprise, hésitation…). */
  const retirerZone = (debut: number, fin: number, retires: number[], typeVide: CoupeFacecam["type"], idxLibelle: number[] = []) => {
    if (!retires.length) return ajouter(typeVide, debut, fin, idxLibelle);
    const groupes: { type: Statut; idx: number[] }[] = [];
    for (const i of retires) {
      const g = groupes[groupes.length - 1];
      if (g && g.type === statut[i]) g.idx.push(i);
      else groupes.push({ type: statut[i], idx: [i] });
    }
    let d = debut;
    groupes.forEach((g, k) => {
      const suivant = groupes[k + 1];
      const f = suivant ? (mots[g.idx[g.idx.length - 1]].finSec + mots[suivant.idx[0]].debutSec) / 2 : fin;
      ajouter(g.type as CoupeFacecam["type"], d, f, g.idx);
      d = f;
    });
  };

  const premier = gardes[0];
  retirerZone(0, mots[premier].debutSec - r.margeDebutSec, range(0, premier), "debut");
  for (let k = 0; k + 1 < gardes.length; k++) {
    const a = gardes[k];
    const b = gardes[k + 1];
    const retires = range(a + 1, b);
    const blanc = mots[b].debutSec - mots[a].finSec;
    // Première tentative d'une reprise absorbée : plus aucun mot dedans, c'est une `reprise` (pas un blanc).
    const absorbee = absorbees.find((z) => z.idx[0] === b);
    const finDePhrase = finitPhrase(mots[a].mot) || debutsPhrases.some((d) => d.mot === b);
    let cible = finDePhrase ? r.respirationSec[1] : r.respirationSec[0];
    if (fortes.has(b) && !retires.length && !absorbee) {
      cible = Math.min(blanc, r.chuteSec[1]);
      chutes.push({ debutSec: arrondi(mots[b].debutSec - cible), finSec: arrondi(mots[b].debutSec) });
    }
    if (!retires.length && blanc <= r.seuilSilenceSec) continue;
    if (!retires.length && blanc <= cible + image) continue;
    const apresA = retires.length ? Math.min(cible / 2, Math.max(0.02, mots[retires[0]].debutSec - mots[a].finSec - 0.02)) : cible / 2;
    const avantB = retires.length ? Math.min(cible / 2, Math.max(0.02, mots[b].debutSec - mots[retires[retires.length - 1]].finSec - 0.02)) : cible / 2;
    retirerZone(mots[a].finSec + apresA, mots[b].debutSec - avantB, retires, absorbee ? "reprise" : "silence", absorbee?.idx ?? []);
  }
  const dernier = gardes[gardes.length - 1];
  retirerZone(mots[dernier].finSec + r.margeFinSec, duree, range(dernier + 1, mots.length), "fin");

  const gardesSec = complement(coupes, duree);
  return {
    version: VERSION_BRIQUE_COUPES,
    mode,
    texteNonRetrouve,
    coupes,
    gardes: gardesSec,
    consignes,
    phrases,
    chutes,
    recalages,
    dureeSourceSec: arrondi(duree),
    dureeSortieSec: arrondi(gardesSec.reduce((s, g) => s + g.finSec - g.debutSec, 0)),
  };
}

function range(debut: number, fin: number): number[] {
  return Array.from({ length: Math.max(0, fin - debut) }, (_, k) => debut + k);
}

/** Les passages gardés : le complément des coupes dans [0, durée]. */
export function complement(coupes: Pick<CoupeFacecam, "debutSec" | "finSec">[], dureeSec: number): Intervalle[] {
  const triees = [...coupes].sort((a, b) => a.debutSec - b.debutSec);
  const gardes: Intervalle[] = [];
  let t = 0;
  for (const c of triees) {
    if (c.debutSec > t + 1e-6) gardes.push({ debutSec: arrondi(t), finSec: arrondi(c.debutSec) });
    t = Math.max(t, c.finSec);
  }
  if (dureeSec > t + 1e-6) gardes.push({ debutSec: arrondi(t), finSec: arrondi(dureeSec) });
  return gardes;
}

/* ------------------------------------------------------------------ */
/* Rétablir, temps du montage, résumé, contrôles                       */
/* ------------------------------------------------------------------ */

/** Les coupes réellement appliquées (Will en a rétabli certaines d'un toucher : rétablir = assemblage seul). */
export function coupesAppliquees(coupes: CoupeFacecam[], retablies: string[] = []): CoupeFacecam[] {
  const r = new Set(retablies);
  return coupes.filter((c) => !r.has(c.id));
}

/** Passages gardés après les rétablissements de Will. */
export function gardesApres(plan: Pick<PlanCoupes, "coupes" | "dureeSourceSec">, retablies: string[] = []): Intervalle[] {
  return complement(coupesAppliquees(plan.coupes, retablies), plan.dureeSourceSec);
}

/** Instant du montage correspondant à un instant de la prise ; `null` s'il tombe dans un passage retiré. */
export function versMontage(tSec: number, gardes: Intervalle[]): number | null {
  let cumul = 0;
  for (const g of gardes) {
    if (tSec < g.debutSec - 1e-6) return null;
    if (tSec <= g.finSec + 1e-6) return arrondi(cumul + Math.min(tSec, g.finSec) - g.debutSec);
    cumul += g.finSec - g.debutSec;
  }
  return null;
}

/** Instant de la prise correspondant à un instant du montage. */
export function versPrise(tMontageSec: number, gardes: Intervalle[]): number {
  let reste = Math.max(0, tMontageSec);
  for (const g of gardes) {
    const d = g.finSec - g.debutSec;
    if (reste <= d + 1e-9) return arrondi(g.debutSec + reste);
    reste -= d;
  }
  return gardes.length ? gardes[gardes.length - 1].finSec : 0;
}

/** Les mots entendus dans le montage, horodatés sur le temps du montage (pour les sous-titres et la réalisation). */
export function motsDuMontage(mots: MotHorodate[], gardes: Intervalle[]): MotHorodate[] {
  const sortie: MotHorodate[] = [];
  for (const m of mots) {
    const milieu = (m.debutSec + m.finSec) / 2;
    const g = gardes.find((x) => milieu >= x.debutSec && milieu <= x.finSec);
    if (!g) continue;
    const d = versMontage(Math.max(m.debutSec, g.debutSec), gardes);
    const f = versMontage(Math.min(m.finSec, g.finSec), gardes);
    if (d === null || f === null) continue;
    sortie.push({ ...m, debutSec: d, finSec: f });
  }
  return sortie;
}

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60) === 60 ? 59 : Math.round(s % 60)).padStart(2, "0")}`;

/** « 3 passages retirés, 2:11 devient 1:34 » (blancs et hésitations comptés à part, ils ne sont pas des « passages »). */
export function resumeCoupes(plan: Pick<PlanCoupes, "coupes" | "dureeSourceSec">, retablies: string[] = []): string {
  const appliquees = coupesAppliquees(plan.coupes, retablies);
  const passages = appliquees.filter((c) => c.type !== "silence" && c.type !== "hesitation").length;
  const sortie = complement(appliquees, plan.dureeSourceSec).reduce((s, g) => s + g.finSec - g.debutSec, 0);
  const nom = passages > 1 ? "passages retirés" : "passage retiré";
  return `${passages} ${nom}, ${minutes(plan.dureeSourceSec)} devient ${minutes(sortie)}`;
}

export interface ControleCoupes {
  /** Phrases du texte absentes du montage (mode texte). */
  phrasesManquantes: number[];
  /** (10/10) Phrases du texte dites autrement, entendues dans le montage : ni manquantes, ni alerte. */
  phrasesDitesAutrement: number[];
  /** Consignes encore audibles (une consigne rétablie, par exemple). */
  consignesAudibles: ConsigneReperee[];
  /** Coupes tombant dans un mot gardé (ne doit jamais arriver). */
  coupesDansUnMot: string[];
  /**
   * V6 : suites de mots entendues deux fois dans le montage (la première fois, son instant dans la prise). Une redite
   * rétablie par Will y apparaît aussi : c'est une alerte bloquante.
   */
  phrasesEnDouble: { texte: string; debutSec: number }[];
}

/** Les mots de la prise avec les recalages d'un plan (reprise absorbée) ; les autres mots sont rendus tels quels. */
export function appliquerRecalages(mots: MotHorodate[], recalages: RecalageMot[] | undefined): MotHorodate[] {
  if (!recalages?.length) return mots;
  const restants = [...recalages];
  return mots.map((m) => {
    const k = restants.findIndex((r) => r.mot === m.mot && Math.abs(r.avantSec - m.debutSec) < 1e-3);
    if (k < 0) return m;
    const [r] = restants.splice(k, 1);
    return { ...m, debutSec: r.debutSec, finSec: r.finSec };
  });
}

/** Le texte validé du plan (mode texte), pour reconnaître une répétition voulue. */
const texteDuPlan = (plan: PlanCoupes) => (plan.mode === "texte" ? plan.phrases.map((p) => p.texte).join(" ") : undefined);

/**
 * Une phrase du texte est présente quand la plupart de ses mots sont entendus dans le montage. (Avant le 10/10, seul
 * le MILIEU de la phrase était regardé : il tombait parfois dans un blanc raccourci, et la phrase, pourtant gardée,
 * était dite « absente du montage ».)
 */
export function controlerCoupes(plan: PlanCoupes, motsPrise: MotHorodate[], retablies: string[] = []): ControleCoupes {
  const mots = appliquerRecalages(motsPrise, plan.recalages);
  const gardes = gardesApres(plan, retablies);
  const dedans = (t: number) => gardes.some((g) => t >= g.debutSec - 1e-6 && t <= g.finSec + 1e-6);
  const recouvre = (i: Intervalle) => gardes.some((g) => i.finSec > g.debutSec + 0.02 && i.debutSec < g.finSec - 0.02);
  const appliquees = coupesAppliquees(plan.coupes, retablies);
  const motsGardes = mots.filter((m) => dedans((m.debutSec + m.finSec) / 2));
  const phraseEntendue = (debut: number, fin: number) => {
    const siens = mots.filter((m) => m.debutSec >= debut - 1e-3 && m.finSec <= fin + 1e-3);
    if (!siens.length) return dedans((debut + fin) / 2);
    return siens.filter((m) => dedans((m.debutSec + m.finSec) / 2)).length / siens.length >= 0.5;
  };
  const diteEntendue = (p: PhraseRetrouvee) => !!p.diteAutrement && phraseEntendue(p.diteAutrement.debutSec, p.diteAutrement.finSec);
  const texte = plan.mode === "texte" ? plan.phrases : [];
  return {
    phrasesManquantes: texte.filter((p) => (p.debutSec === undefined ? !diteEntendue(p) : !phraseEntendue(p.debutSec, p.finSec!))).map((p) => p.index),
    phrasesDitesAutrement: texte.filter((p) => p.debutSec === undefined && diteEntendue(p)).map((p) => p.index),
    consignesAudibles: plan.consignes.filter(recouvre),
    phrasesEnDouble: doublesDansLesGardes(mots, gardes, texteDuPlan(plan)).map((d) => ({ texte: d.texte, debutSec: mots[d.premier[0]].debutSec })),
    coupesDansUnMot: appliquees.filter((c) => motsGardes.some((m) => (c.debutSec > m.debutSec + 0.01 && c.debutSec < m.finSec - 0.01) || (c.finSec > m.debutSec + 0.01 && c.finSec < m.finSec - 0.01))).map((c) => c.id),
  };
}
