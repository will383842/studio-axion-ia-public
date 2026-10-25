/**
 * IMAGE → VIDÉO · Écoute de chaque version (lot L13, plan 50 § 7 : Q18, Q19 ; critique I3, I4).
 *
 * Q18 · ÉCOUTE : la piste VOIX SEULE de la version (celle envoyée au mixage, reconnue par l'empreinte de ses octets) est
 * transcrite (route `transcrire` du serveur, outil injecté) ; jamais le mixage, dont les bruitages et le son de clôture
 * font inventer Whisper. La transcription est ensuite :
 *  - BORNÉE à la durée de voix : tout mot qui commence après la fin de la voix (+ 0,3 s) est ignoré ;
 *  - FILTRÉE des phrases parasites connues de Whisper (« Sous-titres réalisés par… », « Merci d'avoir regardé »…),
 *    sauf si le script les dit vraiment ; les « euh » sont écartés (la voix les a déjà jugés, Q16) ;
 *  - comparée au script de la version (corps + question + fin ; corps seul sur LinkedIn) mot à mot, dans l'ordre
 *    (`memeMot`, nombres ramenés en lettres par `nombreEnLettres`) : ≥ 97 % des mots retrouvés, aucun ajout de plus de
 *    2 mots consécutifs, 100 % des chiffres du script entendus (valeur ET unité) et aucun chiffre entendu hors script.
 * Q19 · FIN DITE EN ENTIER, mesurée sur la VOIX SEULE (le son de clôture du mixage fausserait la mesure) : la dernière
 * phrase est entendue en entier (`occurrences`), son dernier mot est le dernier entendu, le son va jusqu'au bout du
 * dernier mot sans coupure nette, puis un silence MESURÉ d'au moins 300 ms ; sur le fichier final, la voix finit au moins
 * 1,5 s avant la fin (position connue par la ligne de temps) et la voix mixée est bien la piste contrôlée (empreinte).
 * Aucune mesure ne se saute : une donnée absente (piste illisible, transcription vide) = échec.
 *
 * ARGENT : la transcription est réservée AVANT l'appel (`budget.reserver`) ; un refus de réservation = aucun appel, et
 * le contrôle échoue (jamais réussi par défaut). Une transcription déjà obtenue pour la même empreinte est reprise.
 */
import type { MotHorodate } from "@/domaine/types";
import { estHesitation, finitPhrase, jetonsDits, memeMot, nombreEnLettres, occurrences, phrasesDuTexte, tokens, type JetonDit } from "@/briques/coupes/texte";
import { empreinteSon, REGLES_FIN_DE_VOIX_IV, SILENCE_FIN_MIN_SEC, type PisteVoixSeuleIV } from "./assemblage";
import { REGLES_SCENE_IV } from "./regles-scene";
import { REGLES_FIN_DE_VOIX, controlerFinDeVoix, lireWav, silencesMesures, type Son } from "./emprunts";
import { chiffresDuTexte } from "./regles";

/** Seuils de l'écoute (plan § 7, Q18-Q19). */
export const SEUILS_ECOUTE_IV = Object.freeze({
  /**
   * Seuil de REMARQUE : en dessous, la part des mots entendus est signalée en orange (contrôle indicatif, la vidéo continue).
   * Entre le plancher et ce seuil, c'est du bruit de transcription ou une prononciation : jamais un motif de refus.
   */
  retrouvesMin: 0.97,
  /**
   * PLANCHER BLOQUANT : en dessous (la voix manque vraiment, des phrases entières sont absentes), la vidéo est inutilisable
   * et reste refusée. Règle de Will : un défaut de détail signale, il ne bloque pas.
   */
  retrouvesPlancher: 0.9,
  /** VOIX ABSENTE : en dessous de cette part (ou transcription vide), Q18 BLOQUE. Entre ce seuil et le plancher, remarque seulement. */
  retrouvesAbsente: 0.5,
  /** Mots ajoutés consécutifs tolérés (au-delà : refus). */
  ajoutConsecutifMax: 2,
  /** Un mot transcrit qui commence plus de 0,3 s après la fin de la voix est ignoré (Whisper invente sur les silences). */
  margeBorneSec: 0.3,
  /** Silence mesuré après le dernier mot, sur la voix seule. */
  silenceFinMinSec: SILENCE_FIN_MIN_SEC,
  /** Voix finie au moins 1,5 s avant la fin du fichier final. */
  queueMinSec: REGLES_SCENE_IV.queueMin,
  /** Écart toléré entre la fin de voix de la ligne de temps et celle de la piste. */
  ecartFinVoixSec: 0.05,
});

/**
 * Phrases que Whisper écrit sur un silence ou un bruit (sous-titres de chaînes, formules de fin de vidéo). Une phrase
 * qui finit par « par » avale la suite de sa phrase transcrite (« … par la communauté d'Amara.org »), 6 mots au plus.
 */
export const PHRASES_PARASITES_WHISPER: readonly string[] = [
  "sous-titres réalisés par",
  "sous-titres réalisés para",
  "sous-titres fait par",
  "sous-titres par",
  "sous-titrage par",
  "sous-titrage st' 501",
  "sous-titrage société radio-canada",
  "sous-titrage ST 501",
  "merci d'avoir regardé cette vidéo",
  "merci d'avoir regardé",
  "merci de nous avoir regardés",
  "n'oubliez pas de vous abonner",
  "abonnez-vous à la chaîne",
  "à la prochaine",
  "amara.org",
];

const SUITE_PARASITE_MAX = 6;

/* ------------------------------------------------------------------ */
/* Transcription utile                                                   */
/* ------------------------------------------------------------------ */

/** Mot transcrit ramené à sa forme dite (« 80% » → « 80 pour cent », « 23h14 » → « 23 heures 14 »). */
export function formeDite(mot: string): string {
  return mot
    // « email » écrit d'un bloc par Whisper (v-6e4a06b9c718) : on remet le trait d'union, que la comparaison coupe de toute façon
    // (« e-mail », « email » et « e » « mail » donnent les mêmes jetons ; « week » « end » aussi).
    .replace(/(?<![\p{L}])(e)(mails?)(?![\p{L}])/giu, "$1-$2")
    .replace(/(?<![\p{L}])(week)(ends?)(?![\p{L}])/giu, "$1-$2")
    .replace(/(?<![\p{L}])(start)(ups?)(?![\p{L}])/giu, "$1-$2")
    .replace(/(?<![\p{L}])(check)(lists?)(?![\p{L}])/giu, "$1-$2")
    .replace(/(\d)[\s  ](?=\d{3}(?!\d))/g, "$1")
    .replace(/(\d+),(\d+)/g, "$1 virgule $2")
    .replace(/(\d+)\s?%/g, "$1 pour cent")
    .replace(/(\d+)\s?€/g, "$1 euros")
    .replace(/(\d{1,2})\s?h\s?(\d{2})(?!\d)/g, "$1 heures $2")
    .replace(/(\d+)\s?h(?![\p{L}\d])/gu, "$1 heures");
}

/** Formes comparables d'un texte dit ou entendu (nombres en lettres, unités dites). */
export function formesComparables(texte: string): string[] {
  return tokens(formeDite(texte)).flatMap((f) => (/^\d+$/.test(f) ? nombreEnLettres(Number(f)).split(" ") : [f]));
}

export interface TranscriptionUtile {
  /** Mots gardés, dans l'ordre. */
  mots: MotHorodate[];
  /** Mots écartés hors des bornes de la voix (commencent après la fin de voix + 0,3 s). */
  horsBornes: string[];
  /** Phrases parasites retirées (telles qu'entendues). */
  parasites: string[];
  /** « euh » et autres hésitations écartés. */
  hesitations: number;
}

/** « 4-20 » (« quatre-vingts ») → « 80 », « 4-20-5 » → « 85 », « 60-10 » → « 70 ». */
export function nombreComposeWhisper(mot: string): string {
  return mot
    .replace(/^4-20(?:-(1?\d))?(?!\d)/, (_x: string, n?: string) => String(80 + Number(n ?? 0)))
    .replace(/^60-(1\d)(?!\d)/, (_x: string, n: string) => String(60 + Number(n)));
}

/**
 * Whisper découpe parfois un mot en plusieurs « mots » (première vraie transcription, 18/10 : « Vingt » « -trois »,
 * « 80 » « % », « l » « 'analyse »). On les recolle avant toute comparaison : un fragment qui commence par un trait
 * d'union ou une apostrophe, ou un « % » / « € » seul qui suit un nombre, rejoint le mot qui le précède (début du premier,
 * fin du dernier). Les mots entiers ne changent pas.
 */
export function recollerMotsWhisper(mots: readonly MotHorodate[]): MotHorodate[] {
  const res: MotHorodate[] = [];
  const recolles = new Set<number>(); // indices des mots composés recollés : eux seuls sont convertis (« 60-12 » d'un bloc ne change pas)
  for (const m of mots) {
    const precedent = res[res.length - 1];
    // « quatre-vingts » écrit « 4 » « -20 » (v-6e4a06b9c718) : « 4 » « -20 » → « 4-20 », « 4-20 » « -5 » → « 4-20-5 », « 60 » « -10 » → « 60-10 ».
    const fin = "(?:%|[.,!?…]?$)";
    const compose = !!precedent && ((precedent.mot === "4" && new RegExp(`^-20${fin}`).test(m.mot)) || (precedent.mot === "4-20" && new RegExp(`^-1?\\d${fin}`).test(m.mot)) || (precedent.mot === "60" && new RegExp(`^-1\\d${fin}`).test(m.mot)));
    if (compose) recolles.add(res.length - 1);
    const fragment = compose || /^[-'’]\p{L}/u.test(m.mot) || (/^[%€]$/.test(m.mot) && !!precedent && /\d$/.test(precedent.mot));
    if (precedent && fragment) res[res.length - 1] = { ...precedent, mot: precedent.mot + m.mot, finSec: m.finSec };
    else res.push({ ...m });
  }
  return res.map((x, i) => (recolles.has(i) ? { ...x, mot: nombreComposeWhisper(x.mot) } : x));
}

/**
 * Transcription bornée à la durée de voix, débarrassée des phrases parasites et des hésitations. Une phrase parasite
 * que le script dit vraiment (« Merci d'avoir regardé » écrit par Will) n'est pas retirée.
 */
export function transcriptionUtile(motsBruts: readonly MotHorodate[], o: { finVoixSec: number; script: string }): TranscriptionUtile {
  const mots = recollerMotsWhisper(motsBruts);
  const borne = o.finVoixSec + SEUILS_ECOUTE_IV.margeBorneSec;
  const horsBornes: string[] = [];
  const dansBornes = mots.filter((m) => {
    const ok = Number.isFinite(m.debutSec) && m.debutSec <= borne + 1e-9;
    if (!ok) horsBornes.push(m.mot);
    return ok;
  });
  const script = formesComparables(o.script).join(" ");
  const formes = dansBornes.map((m) => formesComparables(m.mot));
  const retire = new Set<number>();
  const parasites: string[] = [];
  for (const p of PHRASES_PARASITES_WHISPER) {
    const cible = formesComparables(p);
    if (!cible.length || ` ${script} `.includes(` ${cible.join(" ")} `)) continue;
    for (let i = 0; i < dansBornes.length; i++) {
      if (retire.has(i)) continue;
      // Les formes des mots i, i+1… mises bout à bout commencent-elles par la phrase parasite ?
      const suite: string[] = [];
      let j = i;
      while (j < dansBornes.length && suite.length < cible.length) suite.push(...formes[j++]);
      if (suite.length < cible.length || !cible.every((c, k) => suite[k] === c)) continue;
      // « … par » : la suite de la phrase transcrite part avec elle.
      if (cible[cible.length - 1] === "par" || cible[cible.length - 1] === "para") {
        let n = 0;
        while (j < dansBornes.length && n < SUITE_PARASITE_MAX && !finitPhrase(dansBornes[j - 1].mot)) {
          j++;
          n++;
        }
      }
      for (let k = i; k < j; k++) retire.add(k);
      parasites.push(dansBornes.slice(i, j).map((m) => m.mot).join(" "));
      i = j - 1;
    }
  }
  let hesitations = 0;
  const gardes = dansBornes.filter((m, i) => {
    if (retire.has(i)) return false;
    if (estHesitation(m.mot)) {
      hesitations++;
      return false;
    }
    return true;
  });
  return { mots: gardes, horsBornes, parasites, hesitations };
}

/* ------------------------------------------------------------------ */
/* Comparaison au script                                                 */
/* ------------------------------------------------------------------ */

export interface ComparaisonEcoute {
  motsScript: number;
  retrouves: number;
  part: number;
  /** Suites de mots entendus qui ne sont pas dans le script (dans l'ordre), avec leur nombre de mots. */
  ajouts: { texte: string; mots: number; debutSec: number; /** Mots du script que cette suite remplace à l'oreille (même suite de sons) : elle n'est alors pas un ajout. */ remplace?: string }[];
  /** Passages du script non entendus (3 premiers mots de chaque trou). */
  manques: string[];
  /** Chiffres du script (clé « valeur|unité ») non entendus, et chiffres entendus hors script. */
  chiffresNonEntendus: string[];
  chiffresInventes: string[];
  /** Dernière phrase du script entendue en entier, son dernier mot étant le dernier entendu. */
  derniereEntiere: boolean;
  derniere: string;
  /** Dernier mot entendu (après filtrage), sur l'horloge de la piste. */
  dernierEntendu?: MotHorodate;
}

/** Plus longue suite commune (dans l'ordre) entre les formes du script et les jetons entendus, au sens de `memeMot`. */
function apparier(script: readonly string[], dits: readonly JetonDit[]): number[] {
  const n = script.length;
  const m = dits.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = memeMot(script[i], dits[j].forme) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  // Pour chaque forme du script, l'index du jeton entendu apparié (−1 : non entendu).
  const res = new Array<number>(n).fill(-1);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (memeMot(script[i], dits[j].forme) && L[i][j] === L[i + 1][j + 1] + 1) {
      res[i] = j;
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return res;
}

const cleChiffreDit = (c: { valeur: number | null; unite: string; brut: string }) => (c.valeur === null ? `plage|${c.brut.replace(/\s+/g, "").toLowerCase()}` : `${c.valeur}|${c.unite}`);
/** Clés des chiffres d'un texte (valeur ET unité). */
export function clesChiffresDits(texte: string): string[] {
  return chiffresDuTexte(texte).map(cleChiffreDit);
}
const lisible = (cle: string) => {
  const [v, u] = cle.split("|");
  return v === "plage" ? u : u === "nombre" ? v : `${v} ${u === "heure" ? "(heure)" : u}`;
};

/**
 * Clé sonore d'un texte : ce que l'oreille retient, pas l'orthographe (« chatbot ia » et « chat de Bottia » se
 * ressemblent). Minuscules, accents et tout ce qui n'est pas une lettre retirés, quelques sons ramenés à une
 * seule lettre, « h » et « e » supprimés, lettres doublées fusionnées. PUR.
 */
export function cleSonore(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z]/g, "")
    .replace(/t?ch|sh/g, "S")
    .replace(/qu|k|c(?=[aou])/g, "K")
    .replace(/ph/g, "f")
    .replace(/v/g, "b")
    .replace(/y/g, "i")
    .replace(/eau|au/g, "o")
    .replace(/h/g, "")
    .replace(/e/g, "")
    .replace(/(.)\1+/g, "$1");
}

/** Distance d'édition entre deux chaînes, ramenée à la plus longue (0 = identiques, 1 = rien en commun). */
function ecartNormalise(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > ECART_SONORE_MAX * Math.max(a.length, b.length)) return 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length] / Math.max(a.length, b.length, 1);
}

/** Écart sonore au-delà duquel une suite entendue n'est plus prise pour le passage du script qu'elle remplace. */
const ECART_SONORE_MAX = 0.3;
/** Clé sonore minimale du passage du script : un mot trop court se « ressemble » avec n'importe quoi. */
const CLE_SONORE_MIN = 5;
const MOT_DE_NOMBRE = /^(?:zero|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|treize|quatorze|quinze|seize|vingts?|trente|quarante|cinquante|soixante|cents?|mille|millions?|milliards?)$/;
const porteUnChiffre = (mots: readonly string[]) => mots.some((m) => /\d/.test(m) || MOT_DE_NOMBRE.test(cleAccents(m)));
const cleAccents = (m: string) => m.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Compare la transcription utile au script de la version. PUR. */
export function comparerAuScript(script: string, entendus: readonly MotHorodate[]): ComparaisonEcoute {
  const formes = formesComparables(script);
  const dits = jetonsDits(
    entendus.map((m) => ({ ...m, mot: formeDite(m.mot) })),
    () => true,
  ).flatMap((j) => (/^\d+$/.test(j.forme) ? nombreEnLettres(Number(j.forme)).split(" ").map((forme) => ({ forme, mot: j.mot })) : [j]));
  const paire = apparier(formes, dits);
  const retrouves = paire.filter((x) => x >= 0).length;

  // Ajouts : mots entendus dont aucun jeton n'est apparié, regroupés quand ils se suivent.
  const apparies = new Set(paire.filter((x) => x >= 0).map((j) => dits[j].mot));
  const ajouts: ComparaisonEcoute["ajouts"] = [];
  let courant: number[] = [];
  /** Passage du script (entre les deux mots appariés qui encadrent la suite) qu'elle remplace à l'oreille, s'il y en a un. */
  const remplacement = (suite: number[]): string | undefined => {
    const premier = suite[0];
    const dernier = suite[suite.length - 1];
    let avant = -1;
    let apres = formes.length;
    for (let i = 0; i < formes.length; i++) {
      if (paire[i] < 0) continue;
      const k = dits[paire[i]].mot;
      if (k < premier) avant = i;
      else if (k > dernier) {
        apres = i;
        break;
      }
    }
    const trou = formes.slice(avant + 1, apres);
    if (trou.length === 0 || suite.length > trou.length + 2) return undefined;
    const entendu = suite.map((k) => entendus[k].mot);
    if (porteUnChiffre(trou) || porteUnChiffre(formesComparables(entendu.join(" ")))) return undefined;
    const cleScript = cleSonore(trou.join(""));
    if (cleScript.length < CLE_SONORE_MIN) return undefined;
    return ecartNormalise(cleScript, cleSonore(entendu.join(""))) <= ECART_SONORE_MAX ? trou.join(" ") : undefined;
  };
  const fermer = () => {
    if (courant.length) {
      const remplace = remplacement(courant);
      ajouts.push({ texte: courant.map((k) => entendus[k].mot).join(" "), mots: courant.length, debutSec: entendus[courant[0]].debutSec, ...(remplace ? { remplace } : {}) });
    }
    courant = [];
  };
  entendus.forEach((_, k) => {
    if (apparies.has(k)) fermer();
    else courant.push(k);
  });
  fermer();

  // Manques : trous du script (premiers mots de chaque trou).
  const manques: string[] = [];
  for (let i = 0; i < formes.length; i++) {
    if (paire[i] >= 0 || (i > 0 && paire[i - 1] < 0)) continue;
    let j = i;
    while (j < formes.length && paire[j] < 0) j++;
    manques.push(`${formes.slice(i, Math.min(j, i + 3)).join(" ")}${j - i > 3 ? "…" : ""}`);
  }

  // Chiffres : valeur ET unité, lus de la même façon des deux côtés.
  const attendus = clesChiffresDits(script);
  const entendusCles = clesChiffresDits(entendus.map((m) => m.mot).join(" "));
  const chiffresNonEntendus = [...new Set(attendus.filter((c) => !entendusCles.includes(c)))].map(lisible);
  const chiffresInventes = [...new Set(entendusCles.filter((c) => !attendus.includes(c)))].map(lisible);

  // Dernière phrase entière, et rien d'entendu après elle.
  const phrases = phrasesDuTexte(script);
  const derniere = phrases[phrases.length - 1] ?? "";
  const formesDerniere = formesComparables(derniere);
  const occ = occurrences(formesDerniere, dits);
  const dernierEntendu = entendus[entendus.length - 1];
  const dernierApparie = paire[formes.length - 1];
  const derniereEntiere =
    formesDerniere.length > 0 &&
    occ.some((o) => o.complete) &&
    dernierApparie !== undefined &&
    dernierApparie >= 0 &&
    dits[dernierApparie].mot === entendus.length - 1;
  return {
    motsScript: formes.length,
    retrouves,
    part: formes.length ? retrouves / formes.length : 0,
    ajouts,
    manques,
    chiffresNonEntendus,
    chiffresInventes,
    derniereEntiere,
    derniere,
    ...(dernierEntendu ? { dernierEntendu } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Outils injectés et dépense                                            */
/* ------------------------------------------------------------------ */

/** Plafond prudent du coût d'une transcription (dollars par minute de voix), réservé avant chaque appel. */
export const TARIF_TRANSCRIPTION_USD_PAR_MINUTE = 0.006;
export const ETAPE_ECOUTE = "ecoute-iv";

/** Réservation d'un appel payant des contrôles finaux (transcription ou Claude) : le pire coût, AVANT l'appel. */
export interface DemandeReservationControleIV {
  appelId: string;
  videoId: string;
  etape: string;
  fournisseur: "transcription" | "claude";
  modele?: string;
  coutEstimeUsd: number;
}

export interface BudgetControlesIV {
  reserver: (demande: DemandeReservationControleIV) => Promise<{ ok: true } | { ok: false; message: string }>;
}

/** Demande à la route `transcrire` : la piste voix seule, bornée à sa durée de voix. */
export interface DemandeTranscriptionIV {
  appelId: string;
  /** Clé de la piste VOIX SEULE (jamais celle du mixage). */
  cle: string;
  empreinte: string;
  langue: "fr";
  /** Rien n'est transcrit au-delà (fin de voix + marge). */
  jusquaSec: number;
}

export interface OutilsEcouteIV {
  lireSon: (cle: string) => Promise<Uint8Array | null>;
  transcrire: (demande: DemandeTranscriptionIV) => Promise<{ mots: MotHorodate[] }>;
  budget: BudgetControlesIV;
}

export const idAppelEcoute = (videoId: string, empreinte: string) => `iv-ecoute-${videoId}-${empreinte}`;

export function coutTranscriptionUsd(dureeSec: number): number {
  return Math.max(1, Math.ceil(dureeSec / 60)) * TARIF_TRANSCRIPTION_USD_PAR_MINUTE;
}

/* ------------------------------------------------------------------ */
/* Écoute d'une version                                                  */
/* ------------------------------------------------------------------ */

export interface ConstatControle {
  ok: boolean;
  /** Non fait (donnée absente, appel refusé) : jamais compté comme réussi. */
  nonFait?: boolean;
  details: string[];
}

export interface EcouteVersionIV {
  /** WAV de la piste voix seule lisible et conforme à son empreinte (Q17 relu à la porte). */
  q17: ConstatControle;
  q18: ConstatControle;
  q19: ConstatControle;
  /** Remarques d'écoute NON bloquantes (part entre le plancher et le seuil) : orange à la porte, la vidéo continue. */
  q18Remarques?: string[];
  /** Clés « valeur|unité » des chiffres entendus (pour « dit ET montré »). */
  chiffresEntendus: string[];
  /** Texte entendu utile (pour les interdits et la phrase-choc). */
  texteEntendu: string;
  comparaison?: ComparaisonEcoute;
  utile?: TranscriptionUtile;
  /** Transcription brute obtenue (gardée pour une reprise sans repayer). */
  transcription?: MotHorodate[];
  appelPaye: boolean;
}

export interface EntreeEcouteIV {
  videoId: string;
  /** Script de la version : corps (+ question + fin), tel que validé. */
  script: string;
  piste: Pick<PisteVoixSeuleIV, "cle" | "empreinte" | "finVoixSec" | "dureeSec" | "mots">;
  /** Fichier final : durée (ligne de temps), fin de voix sur la ligne de temps, empreinte de la voix mixée. */
  final: { dureeSec: number; finVoixSec: number; empreinteVoixMixee: string | undefined };
  /** Transcription déjà obtenue pour cette empreinte (reprise sans repayer). */
  deja?: MotHorodate[];
  /** Faux : la vidéo est déjà refusée ; aucune dépense n'est engagée, Q18 est « non fait ». */
  depenseAutorisee: boolean;
}

const sec = (s: number) => `${s.toFixed(2).replace(".", ",")} s`;
const echec = (details: string[], nonFait = false): ConstatControle => ({ ok: false, ...(nonFait ? { nonFait } : {}), details });
const constat = (details: string[]): ConstatControle => ({ ok: details.length === 0, details });

/** Q19 sur la piste voix seule : son jusqu'au bout du dernier mot, sans coupure nette, puis ≥ 300 ms de silence mesuré. */
export function finSurLaVoixSeule(son: Son, dernierMotFinSec: number): string[] {
  const details: string[] = [];
  const verdict = controlerFinDeVoix(son, dernierMotFinSec, REGLES_FIN_DE_VOIX_IV);
  if (!verdict.ok) details.push(verdict.raison);
  const duree = son.echantillons.length / son.frequence;
  const final = silencesMesures(son).at(-1);
  const touchelaFin = final && final.finSec >= duree - REGLES_FIN_DE_VOIX.fenetreSec - 1e-6;
  const silence = touchelaFin ? final.finSec - Math.max(final.debutSec, dernierMotFinSec) : 0;
  if (silence < SEUILS_ECOUTE_IV.silenceFinMinSec - 1e-6) details.push(`après le dernier mot, le silence mesuré sur la voix seule dure ${sec(Math.max(0, silence))} (300 ms au moins) : la dernière phrase risque d'être coupée.`);
  return details;
}

/**
 * Q17 (relu), Q18 et Q19 d'une version. Lit la piste voix seule (WAV, empreinte), la fait transcrire (réservation
 * d'abord), puis compare. Ne lève jamais : toute panne devient un échec motivé.
 */
export async function ecouterVersionIV(e: EntreeEcouteIV, o: OutilsEcouteIV): Promise<EcouteVersionIV> {
  const vide = { chiffresEntendus: [] as string[], texteEntendu: "", appelPaye: false };
  // Q17 · la piste voix seule, en WAV, est bien celle produite (empreinte).
  let son: Son | null = null;
  const q17: string[] = [];
  let octets: Uint8Array | null = null;
  try {
    octets = await o.lireSon(e.piste.cle);
  } catch (err) {
    q17.push(`la piste voix seule n'a pas pu être lue (${(err as Error).message}).`);
  }
  if (!octets && !q17.length) q17.push("la piste voix seule est introuvable : l'écoute et la fin ne peuvent pas être contrôlées.");
  if (octets) {
    try {
      son = lireWav(octets);
    } catch (err) {
      q17.push(`la piste voix seule n'est pas un WAV lisible (${(err as Error).message}).`);
    }
    if (empreinteSon(octets) !== e.piste.empreinte) q17.push("la piste voix seule lue n'est pas celle produite par l'assemblage (empreinte différente).");
  }

  // Q19 · côté fichier final : la voix mixée est la piste contrôlée, et elle finit ≥ 1,5 s avant la fin.
  const q19Final: string[] = [];
  if (!e.final.empreinteVoixMixee) q19Final.push("l'empreinte de la voix mixée manque : impossible de relier le fichier final à la piste contrôlée.");
  else if (e.final.empreinteVoixMixee !== e.piste.empreinte) q19Final.push("la voix mixée dans le fichier final n'est pas la piste voix seule contrôlée (empreinte différente).");
  if (Math.abs(e.final.finVoixSec - e.piste.finVoixSec) > SEUILS_ECOUTE_IV.ecartFinVoixSec) q19Final.push(`la ligne de temps place la fin de la voix à ${sec(e.final.finVoixSec)}, la piste à ${sec(e.piste.finVoixSec)}.`);
  const queue = e.final.dureeSec - e.piste.finVoixSec;
  if (!(queue + 1e-6 >= SEUILS_ECOUTE_IV.queueMinSec)) q19Final.push(`la voix finit ${sec(queue)} avant la fin de la vidéo (1,5 s au moins).`);

  if (q17.length || !son) {
    return { ...vide, q17: echec(q17), q18: echec(["la piste voix seule n'est pas lisible : rien n'a été transcrit."], true), q19: echec([...q19Final, "la fin n'a pas pu être mesurée sur la voix seule."]) };
  }

  // Q18 · transcription (reprise, sinon réservation puis appel).
  let transcription = e.deja;
  let appelPaye = false;
  if (!transcription) {
    if (!e.depenseAutorisee) {
      return { ...vide, q17: constat([]), q18: echec(["écoute non lancée : la vidéo est déjà refusée par un autre contrôle, aucune dépense n'est engagée."], true), q19: echec([...q19Final, "la fin n'est pas confirmée sans l'écoute."], true) };
    }
    const appelId = idAppelEcoute(e.videoId, e.piste.empreinte);
    const r = await o.budget.reserver({ appelId, videoId: e.videoId, etape: ETAPE_ECOUTE, fournisseur: "transcription", coutEstimeUsd: coutTranscriptionUsd(e.piste.dureeSec) }).catch((err: Error) => ({ ok: false as const, message: err.message }));
    if (!r.ok) return { ...vide, q17: constat([]), q18: echec([`écoute non lancée : la dépense n'a pas pu être réservée (${r.message}).`], true), q19: echec([...q19Final, "la fin n'est pas confirmée sans l'écoute."], true) };
    try {
      appelPaye = true;
      transcription = (await o.transcrire({ appelId, cle: e.piste.cle, empreinte: e.piste.empreinte, langue: "fr", jusquaSec: +(e.piste.finVoixSec + SEUILS_ECOUTE_IV.margeBorneSec).toFixed(3) })).mots;
    } catch (err) {
      return { ...vide, appelPaye, q17: constat([]), q18: echec([`la transcription a échoué (${(err as Error).message}).`], true), q19: echec([...q19Final, "la fin n'est pas confirmée sans l'écoute."], true) };
    }
  }
  if (!Array.isArray(transcription) || transcription.length === 0) {
    return { ...vide, appelPaye, transcription: transcription ?? [], q17: constat([]), q18: echec(["la transcription de la voix seule est vide."]), q19: echec([...q19Final, "aucun dernier mot entendu."]) };
  }

  const utile = transcriptionUtile(transcription, { finVoixSec: e.piste.finVoixSec, script: e.script });
  const c = comparerAuScript(e.script, utile.mots);
  const q18: string[] = [];
  const q18Remarques: string[] = [];
  const phrasePart = `${Math.round(c.part * 1000) / 10} % des mots du script entendus dans l'ordre${c.manques.length ? ` ; manquent notamment : « ${c.manques.slice(0, 3).join(" », « ")} »` : ""}`;
  const partAssezBonne = c.part >= SEUILS_ECOUTE_IV.retrouvesPlancher - 1e-9;
  if (!partAssezBonne) q18.push(`${phrasePart} (${Math.round(SEUILS_ECOUTE_IV.retrouvesPlancher * 100)} % au moins : la voix manque).`);
  else if (c.part < SEUILS_ECOUTE_IV.retrouvesMin - 1e-9) q18Remarques.push(`${phrasePart} (${Math.round(SEUILS_ECOUTE_IV.retrouvesMin * 100)} % visés ; sans gravité, probablement la transcription).`);
  for (const a of c.ajouts.filter((x) => x.mots > SEUILS_ECOUTE_IV.ajoutConsecutifMax && !x.remplace)) q18.push(`la voix dit « ${a.texte} » (vers ${sec(a.debutSec)}), absent du script.`);
  for (const ch of c.chiffresNonEntendus) q18.push(`le chiffre « ${ch} » du script n'est pas entendu.`);
  for (const ch of c.chiffresInventes) q18.push(`le chiffre « ${ch} » est entendu mais n'est pas dans le script.`);

  const q19 = [...q19Final];
  if (!c.derniereEntiere) q19.push(`la dernière phrase (« ${c.derniere} ») n'est pas entendue en entier jusqu'à son dernier mot.`);
  const dernier = e.piste.mots.at(-1);
  if (!dernier) q19.push("la piste n'a aucun mot horodaté : la fin ne peut pas être mesurée.");
  // Heure du dernier mot : celle de l'aligneur sur la piste (celle de Whisper n'est qu'approchée).
  else q19.push(...finSurLaVoixSeule(son, dernier.finSec));

  return {
    q17: constat([]),
    q18: constat(q18),
    q19: constat(q19),
    q18Remarques,
    chiffresEntendus: clesChiffresDits(utile.mots.map((m) => m.mot).join(" ")),
    texteEntendu: utile.mots.map((m) => m.mot).join(" "),
    comparaison: c,
    utile,
    transcription,
    appelPaye,
  };
}
