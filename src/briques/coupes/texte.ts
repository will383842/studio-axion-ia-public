/**
 * BRIQUE COUPES — outils de texte (plan facecam v4, lot B). PUR.
 *
 * Comparaison des mots dits (transcription horodatée, Whisper ou aligneur) avec le texte validé : formes comparables,
 * découpe en phrases, mots d'hésitation, et recherche de TOUTES les occurrences d'une phrase dans la prise (une
 * occurrence peut être abandonnée en route : c'est une reprise).
 */
import type { MotHorodate } from "@/domaine/types";
import { normaliser } from "@/briques/calage/report";

export { normaliser };

/** « euh », « heu », « hum »… : jamais gardés (coupe de type `hesitation`). */
const HESITATIONS = new Set(["euh", "heu", "euhh", "euuh", "hum", "hmm", "hm", "mmh", "mh", "bah", "ben", "pfff", "pff"]);

export function estHesitation(mot: string): boolean {
  return HESITATIONS.has(normaliser(mot));
}

/** Mot coupé en son milieu par Whisper (« impor- », « ré… ») : faux départ. */
export function estMotInacheve(mot: string): boolean {
  return /[-‐–—]$/.test(mot.trim()) || /\w(…|\.\.\.)$/.test(mot.trim());
}

/** Fin de phrase : point, point d'exclamation ou d'interrogation, points de suspension. */
export function finitPhrase(mot: string): boolean {
  return /[.?!…]["»”'\s ]*$/.test(mot);
}

/** Les phrases du texte validé, dans l'ordre (coupées après . ! ? …). Les blocs vides sont écartés. */
export function phrasesDuTexte(texte: string): string[] {
  return texte
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!…]["»”]?)\s+/)
    .map((p) => p.trim())
    .filter((p) => tokens(p).length > 0);
}

const UNITES = ["zero", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const DIZAINES = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre vingt", "quatre vingt"];

function centaine(n: number): string {
  if (n <= 16) return UNITES[n];
  if (n < 20) return `dix ${UNITES[n - 10]}`;
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10 + (d === 7 || d === 9 ? 10 : 0);
    if (!u) return DIZAINES[d];
    return `${DIZAINES[d]}${(u === 1 || u === 11) && d < 8 ? " et" : ""} ${centaine(u)}`;
  }
  const c = Math.floor(n / 100);
  const reste = n % 100;
  return `${c > 1 ? `${UNITES[c]} ` : ""}cent${reste ? ` ${centaine(reste)}` : ""}`;
}

/** Un nombre écrit en chiffres, dit en lettres (Whisper écrit « 1 », « 45 » ; le texte « Un », « quarante-cinq »). */
export function nombreEnLettres(n: number): string {
  if (n < 1000) return centaine(n);
  const milliers = Math.floor(n / 1000);
  const reste = n % 1000;
  return `${milliers > 1 ? `${centaine(milliers)} ` : ""}mille${reste ? ` ${centaine(reste)}` : ""}`;
}

/**
 * Formes comparables des mots d'une phrase (« l'entreprise » → « l », « entreprise » ; ponctuation retirée). Les nombres
 * en chiffres sont ramenés en lettres (« 45 » → « quarante », « cinq »), comme « quarante-cinq » écrit dans le texte.
 */
export function tokens(phrase: string): string[] {
  return phrase
    .split(/[\s'’\-]+/)
    .map(normaliser)
    .flatMap((f) => (/^\d{1,6}$/.test(f) ? nombreEnLettres(Number(f)).split(" ") : [f]))
    .filter(Boolean);
}

/** Distance d'édition bornée (tolérance aux fautes de Whisper sur les noms : « Calliopée » / « Certifexemple »). */
function distance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  let prec = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cour = [i];
    for (let j = 1; j <= n; j++) cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prec = cour;
  }
  return prec[n];
}

/** Marques de genre et de nombre que Whisper entend ou non (« quel » / « quelle », « leur » / « leurs »). */
const ACCORDS = new Set(["e", "s", "es", "le", "les", "x"]);

/**
 * Deux formes comparables désignent-elles le même mot ? Égalité, accord entendu ou non (« quel » / « quelle »,
 * « leur » / « leurs » : même mot d'au moins 3 lettres, suivi d'une marque de genre ou de nombre), ou proximité pour
 * les mots de 5 lettres et plus. « que » et « quel » restent deux mots différents.
 */
export function memeMot(a: string, b: string): boolean {
  if (a === b) return true;
  const [court, long] = a.length <= b.length ? [a, b] : [b, a];
  if (court.length >= 3 && long.startsWith(court) && ACCORDS.has(long.slice(court.length))) return true;
  if (court.length < 5) return false;
  return distance(a, b) / long.length <= 0.25;
}

/** Un mot de la transcription ramené à des formes comparables (Whisper colle parfois « l'équipe » en un seul mot). */
export interface JetonDit {
  forme: string;
  /** Index du mot de la transcription d'où vient la forme. */
  mot: number;
}

export function jetonsDits(mots: MotHorodate[], retenir: (i: number) => boolean): JetonDit[] {
  const j: JetonDit[] = [];
  mots.forEach((m, i) => {
    if (!retenir(i)) return;
    for (const forme of tokens(m.mot)) j.push({ forme, mot: i });
  });
  return j;
}

/** Une occurrence (complète ou abandonnée) d'une phrase du texte dans la prise. */
export interface Occurrence {
  /** Index (dans les jetons dits) du premier et du dernier jeton reconnus. */
  debut: number;
  fin: number;
  /** Part des mots de la phrase reconnus (0-1). */
  couverture: number;
  /** La phrase est dite jusqu'au bout (fin reconnue, couverture ≥ 75 %). */
  complete: boolean;
}

/** Mots dits ou mots du texte qu'on accepte de sauter pour se recaler après un raté (Whisper entend mal). */
const RECALAGE_MAX = 3;

/**
 * Après un raté (dits[t] ≠ phrase[j]), le plus petit saut (a mots dits, b mots du texte) qui retombe sur le même mot ET
 * le confirme par le mot suivant (ou par la fin de la phrase) : « deux vies » ↔ « devis », « aideaux » ↔ « aides
 * autant », « à Calliopee » ↔ « grâce à Certifexemple ». Aucun recalage : la phrase est abandonnée ici.
 */
function recaler(phrase: string[], dits: JetonDit[], j: number, t: number): [number, number] | null {
  let meilleur: [number, number] | null = null;
  for (let a = 0; a <= RECALAGE_MAX; a++) {
    for (let b = 0; b <= RECALAGE_MAX; b++) {
      if ((!a && !b) || (meilleur && a + b >= meilleur[0] + meilleur[1])) continue;
      const tt = t + a;
      const jj = j + b;
      if (tt >= dits.length || jj >= phrase.length || !memeMot(dits[tt].forme, phrase[jj])) continue;
      const confirme = jj === phrase.length - 1 || (tt + 1 < dits.length && memeMot(dits[tt + 1].forme, phrase[jj + 1]));
      if (confirme) meilleur = [a, b];
    }
  }
  return meilleur;
}

/**
 * Toutes les occurrences d'une phrase : chaque départ possible (l'un des 3 premiers mots) est déroulé mot à mot. Un
 * raté (mot mal entendu, mot dit de trop, mot du texte sauté) est franchi si l'on retombe sur deux mots de suite de la
 * phrase un peu plus loin (3 mots au plus de chaque côté) ; sinon l'occurrence s'arrête là (phrase abandonnée).
 * Une occurrence qui commence dans une autre déjà trouvée (même départ décalé) n'est pas comptée deux fois.
 */
export function occurrences(phrase: string[], dits: JetonDit[]): Occurrence[] {
  const n = phrase.length;
  if (!n) return [];
  const trouvees: Occurrence[] = [];
  const departs = Math.min(3, n);
  for (let i = 0; i < dits.length; i++) {
    let s = -1;
    for (let k = 0; k < departs; k++) if (memeMot(dits[i].forme, phrase[k])) { s = k; break; }
    if (s < 0) continue;
    if (trouvees.some((o) => i >= o.debut && i <= o.fin)) continue;
    let j = s;
    let t = i;
    let reconnus = 0;
    let dernier = i;
    let finReconnue = false;
    while (j < n && t < dits.length) {
      if (memeMot(dits[t].forme, phrase[j])) {
        reconnus++;
        dernier = t;
        if (j >= n - Math.min(2, n)) finReconnue = finReconnue || j === n - 1 || (n >= 4 && j === n - 2);
        j++;
        t++;
        continue;
      }
      const saut = recaler(phrase, dits, j, t);
      if (!saut) break;
      // Seul le premier mot reconnu, puis des mots dits de trop : faux départ (« claires ET classées. Et vous
      // comprendrez »). On repart du vrai début, un peu plus loin, au lieu d'avaler les mots d'une autre phrase.
      if (reconnus === 1 && saut[0] > saut[1]) {
        reconnus = 0;
        break;
      }
      t += saut[0];
      j += saut[1];
    }
    const couverture = reconnus / n;
    if (reconnus === 0 || (n >= 3 && reconnus < 2)) continue;
    trouvees.push({ debut: i, fin: dernier, couverture, complete: finReconnue && couverture >= 0.75 });
  }
  return trouvees;
}
