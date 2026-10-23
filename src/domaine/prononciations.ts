/**
 * PRONONCIATIONS — fonctions PURES (posées par l'architecte le 02/10 ; propriété du lot A1, `docs/BRANCHEMENTS-EXECUTION.md`,
 * consigne `PRONONCIATIONS-SYSTEME.md`).
 *
 * Point UNIQUE où la liste de la Bibliothèque devient la liste envoyée à une voix ou figée dans une commande
 * (`prononciationsActives`) : la fabrication (`services/fabrication.ts`) et les écoutes (`services/personnages.ts`)
 * l'appellent sans rien savoir des règles. On y trouve aussi :
 *  - n° 6 : les variantes d'un mot (casse, pluriel simple, avec ou sans tiret / espace) — `cleMot`, `motifMot`, `contientMot` ;
 *  - n° 7 : la façon d'écrire (sous-titres) distincte de la façon de dire (voix) ;
 *  - n° 8 : la portée (toutes les voix, une voix, un personnage) ;
 *  - n° 2 : la détection des mots à risque dans un script (sigles, noms propres, anglicismes, chiffres avec unités,
 *    orthographe inhabituelle) avec une proposition de prononciation ; simulée par règles tant qu'aucune clé Claude ;
 *  - n° 4 : la lecture d'une liste collée « mot = prononciation » ;
 *  - n° 5 et 9 : l'usage dans les vidéos et le contrôle des vidéos fabriquées AVANT l'ajout d'un mot ;
 *  - n° 10 : la liste de départ.
 */
import type { Id, Prononciation } from "./types";

/** À qui la liste est destinée (portée : une voix, un personnage). */
export interface ContextePrononciation {
  voixId?: Id;
  personnageId?: Id;
}

/** Une entrée telle que la voix et les sous-titres la reçoivent (contrat de `CommandeFabrication.prononciations`). */
export interface PrononciationAppliquee {
  mot: string;
  prononciation: string;
  /** Graphie des sous-titres quand elle diffère de `mot` (n° 7, lot A1). */
  ecriture?: string;
}

/* ------------------------------------------------------------------ */
/* n° 6 — variantes d'un mot                                            */
/* ------------------------------------------------------------------ */

/** Forme comparable d'un mot : minuscules, sans accent, sans tiret, espace ni ponctuation (« Axion-IA » = « axion ia »). */
export function cleMot(mot: string): string {
  return mot
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/€/g, "eur")
    .replace(/%/g, "pct")
    .replace(/&/g, "et")
    .replace(/[^a-z0-9]/g, "");
}

/** Un pluriel simple (« PV » → « PVs », « Excel » → « Excels ») est accepté pour un mot qui finit par une lettre. */
export function pluralisable(mot: string): boolean {
  const c = cleMot(mot);
  return c.length >= 2 && /[a-z]$/.test(c) && !/[sxz]$/.test(c);
}

/** Un sigle : 2 à 6 lettres capitales, sans rien d'autre (« IA », « RGPD »). */
const SIGLE = /^\p{Lu}{2,6}$/u;

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Motif d'un mot et de ses variantes dans un texte : casse ignorée, tiret / espace facultatifs entre les parties
 * (« Axion-IA », « AXION IA », « AxionIA »), pluriel simple ; sauf un mot courant en minuscules à trait d'union (trait d'union exigé). Bornes : ni lettre ni chiffre de part et d'autre.
 */
export function motifMot(mot: string, options: { pluriel?: boolean } = {}): RegExp {
  const parties = mot
    .trim()
    .split(/[-\s\u00a0]+/)
    .filter(Boolean);
  const pluriel = (options.pluriel ?? true) && pluralisable(mot) ? "(?:s|x)?" : "";
  // L0b (15/10) : un mot fait d'un seul sigle (« IA », « RGPD ») reconnaît aussi sa forme à points (« I.A. », « I.A »),
  // jamais au milieu d'un autre sigle (« P.I.A. », « I.A.B. »).
  if (parties.length === 1 && SIGLE.test(parties[0])) {
    const points = [...parties[0]].map(echapper).join("\\.");
    return new RegExp(`(?<![\\p{L}\\p{N}])(?<!\\p{L}\\.)(?:${points}\\.?|${echapper(parties[0])}${pluriel})(?![\\p{L}\\p{N}])(?!\\.\\p{L})`, "giu");
  }
  return new RegExp(`(?<![\\p{L}\\p{N}])${sourceMotif(mot)}${pluriel}(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * Source du motif des parties d'un mot, liaisons comprises. Un mot courant en minuscules qui porte un trait d'union
 * (« peut-être », « peut-être pas ») exige, entre ses parties, la liaison qu'il a : « - » là où il a un tiret, une espace
 * là où il a une espace ; sans cela, « il peut être utile » (le verbe) serait changé aussi. Les noms, sigles et mots sans
 * tiret gardent la souplesse (tiret, espace ou rien). Partagé avec la brique sous-titres (graphie imposée).
 */
export function sourceMotif(mot: string): string {
  const morceaux = mot.trim().split(/([-\s\u00a0]+)/).filter(Boolean);
  const strict = mot.includes("-") && mot === mot.toLowerCase();
  let source = "";
  for (const m of morceaux) {
    if (!/^[-\s\u00a0]+$/.test(m)) source += echapper(m);
    else source += strict ? (m.includes("-") ? "-" : "[\\s\\u00a0]") : "[-\\s\\u00a0]?";
  }
  return source;
}

/** Le texte contient-il le mot (ou l'une de ses variantes) ? */
export function contientMot(texte: string, mot: string): boolean {
  if (!mot.trim()) return false;
  return motifMot(mot).test(texte);
}

/** Les variantes d'écriture d'un mot que la voix et les sous-titres reconnaissent (montrées dans la feuille d'ajout). */
export function variantesMot(mot: string): string[] {
  const m = mot.trim();
  if (!m) return [];
  const parties = m.split(/[-\s]+/).filter(Boolean);
  const formes = new Set<string>([m, m.toUpperCase(), m.toLowerCase()]);
  // Un mot courant en minuscules à trait d'union ne se reconnaît qu'avec son trait d'union : pas de forme espacée ou collée.
  if (parties.length > 1 && !(m.includes("-") && m === m.toLowerCase())) {
    formes.add(parties.join("-"));
    formes.add(parties.join(" "));
    formes.add(parties.join(""));
  }
  if (pluralisable(m)) formes.add(`${m}s`);
  return [...formes];
}

/* ------------------------------------------------------------------ */
/* n° 7, 8 — liste appliquée (portée, façon d'écrire)                   */
/* ------------------------------------------------------------------ */

/** L'entrée vaut-elle pour cette voix / ce personnage ? Sans portée : toutes les voix. */
export function appliqueA(p: Pick<Prononciation, "portee">, contexte: ContextePrononciation): boolean {
  const portee = p.portee;
  if (!portee || (!portee.voixId && !portee.personnageId)) return true;
  if (portee.voixId && portee.voixId !== contexte.voixId) return false;
  if (portee.personnageId && portee.personnageId !== contexte.personnageId) return false;
  return true;
}

const estReservee = (p: Pick<Prononciation, "portee">) => !!(p.portee?.voixId || p.portee?.personnageId);

/** Motif identique à celui de la brique sous-titres (graphie imposée) : sert à savoir si la brique saura afficher `ecriture`. */
function motifBrique(mot: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${sourceMotif(mot)}(?![\\p{L}\\p{N}])`, "iu");
}

/**
 * Prononciations à appliquer pour une voix ou un personnage (entrées rangées exclues).
 *  - portée (n° 8) : une entrée réservée à une autre voix / un autre personnage est écartée ; pour un même mot, l'entrée
 *    réservée prime sur l'entrée générale, puis la plus récente ;
 *  - façon d'écrire (n° 7) : la brique sous-titres impose la graphie de `mot` ; l'entrée est donc émise avec
 *    `mot = ecriture` (la brique affiche ainsi « 35 h » pour « 35h », « TELEOS » pour « Teleos »). Si la brique ne sait
 *    pas reconnaître la forme saisie à partir de l'écriture, une entrée de la forme saisie est émise AVANT (la voix la
 *    reconnaît ; les sous-titres la gardent telle quelle).
 */
export function prononciationsActives(liste: Prononciation[], contexte: ContextePrononciation = {}): PrononciationAppliquee[] {
  const parCle = new Map<string, Prononciation>();
  for (const p of liste) {
    if (p.archiveLe || !p.mot.trim() || !p.prononciation.trim() || !appliqueA(p, contexte)) continue;
    const cle = cleMot(p.mot);
    const deja = parCle.get(cle);
    if (!deja) {
      parCle.set(cle, p);
      continue;
    }
    const prime = estReservee(p) !== estReservee(deja) ? estReservee(p) : (p.modifieLe ?? p.creeLe) > (deja.modifieLe ?? deja.creeLe);
    if (prime) parCle.set(cle, p);
  }
  const avant: PrononciationAppliquee[] = [];
  const principales: PrononciationAppliquee[] = [];
  const emis = new Set<string>();
  for (const p of parCle.values()) {
    const ecriture = p.ecriture?.trim();
    const affiche = ecriture && ecriture !== p.mot ? ecriture : p.mot;
    // Deux entrées qui s'affichent pareil (« 35h » et « trente-cinq heures » écrits « 35 h ») : la première garde l'écriture.
    if (affiche !== p.mot && !motifBrique(affiche).test(p.mot)) avant.push({ mot: p.mot, prononciation: p.prononciation, ecriture: affiche });
    if (emis.has(cleMot(affiche))) continue;
    emis.add(cleMot(affiche));
    principales.push(affiche === p.mot ? { mot: p.mot, prononciation: p.prononciation } : { mot: affiche, prononciation: p.prononciation, ecriture: affiche });
  }
  return [...avant, ...principales];
}

/** Graphie affichée d'une entrée dans les sous-titres. */
export function graphie(p: Pick<Prononciation, "mot" | "ecriture">): string {
  return p.ecriture?.trim() || p.mot;
}

/**
 * Substitue les prononciations dans un texte court (écoute d'essai, « Écouter » d'une pastille) : la plus longue d'abord,
 * variantes comprises. La fabrication, elle, passe par `moteurs/montage-avocat/report.ts` (qui garde la correspondance).
 */
export function substituerPrononciations(texte: string, liste: { mot: string; prononciation: string }[]): string {
  let sortie = texte;
  for (const p of [...liste].filter((x) => x.mot.trim() && x.prononciation.trim()).sort((a, b) => cleMot(b.mot).length - cleMot(a.mot).length)) {
    // L0b : un sigle à points qui finit la phrase (« … par l'I.A. Puis », « … par l'I.A. » en fin de texte) garde le point.
    sortie = sortie.replace(motifMot(p.mot), (trouve: string, position: number, tout: string) => {
      const finDePhrase = trouve.endsWith(".") && /^(?:\s*$|\s+[«"“(]?[\p{Lu}\p{N}])/u.test(tout.slice(position + trouve.length));
      return finDePhrase ? `${p.prononciation}.` : p.prononciation;
    });
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* n° 1 — phrase d'écoute avant / après                                 */
/* ------------------------------------------------------------------ */

/** Phrase type lue par la voix par défaut pour écouter un mot (« Chez Axion-IA, nous… »). */
export function phraseEcoute(mot: string): string {
  return `Chez ${mot.trim()}, nous vous expliquons tout simplement.`;
}

/** Les deux textes à faire lire : AVANT (le mot tel quel) et APRÈS (la prononciation à sa place). */
export function textesAvantApres(mot: string, prononciation: string): { avant: string; apres: string } {
  const avant = phraseEcoute(mot);
  return { avant, apres: prononciation.trim() ? phraseEcoute(prononciation) : avant };
}

/* ------------------------------------------------------------------ */
/* n° 2 — détection des mots à risque                                   */
/* ------------------------------------------------------------------ */

export type RaisonRisque = "sigle" | "nom-propre" | "anglicisme" | "chiffre" | "inhabituel";

export interface MotARisque {
  /** Le mot tel qu'il apparaît la première fois dans le script. */
  mot: string;
  raison: RaisonRisque;
  occurrences: number;
  /** Proposition de prononciation (sigle épelé, nombre en lettres), à écouter avant d'ajouter. */
  suggestion?: string;
}

export const LIBELLES_RAISON: Record<RaisonRisque, string> = {
  sigle: "Sigle",
  "nom-propre": "Nom propre",
  anglicisme: "Mot anglais",
  chiffre: "Chiffre",
  inhabituel: "Mot rare",
};

/** Lettres épelées à la française (« PV » → « pé-vé »). */
const LETTRES: Record<string, string> = {
  a: "a",
  b: "bé",
  c: "cé",
  d: "dé",
  e: "eu",
  f: "èf",
  g: "jé",
  h: "ache",
  i: "i",
  j: "ji",
  k: "ka",
  l: "èl",
  m: "èm",
  n: "èn",
  o: "o",
  p: "pé",
  q: "ku",
  r: "èr",
  s: "èss",
  t: "té",
  u: "u",
  v: "vé",
  w: "double-vé",
  x: "iks",
  y: "i-grec",
  z: "zèd",
};

/** Sigle épelé lettre à lettre ; les chiffres en lettres (« B2B » → « bé-deux-bé »). */
export function epelerSigle(sigle: string): string {
  return sigle
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .filter((c) => /[a-z0-9]/i.test(c))
    .map((c) => (/\d/.test(c) ? nombreEnLettres(Number(c)) : LETTRES[c.toLowerCase()]))
    .join("-");
}

const UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const DIZAINES = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];

function moinsDeCent(n: number): string {
  if (n <= 16) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  if (n < 70) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? DIZAINES[d] : u === 1 ? `${DIZAINES[d]} et un` : `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${moinsDeCent(n - 60)}`;
  const reste = n - 80;
  return reste === 0 ? "quatre-vingts" : `quatre-vingt-${moinsDeCent(reste)}`;
}

function moinsDeMille(n: number): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (!c) return moinsDeCent(r);
  const centaine = c === 1 ? "cent" : `${UNITES[c]} cent${r === 0 ? "s" : ""}`;
  return r === 0 ? centaine : `${centaine} ${moinsDeCent(r)}`;
}

/** Nombre entier (0 à 999 999 999) en lettres, orthographe traditionnelle (« 135 » → « cent trente-cinq »). */
export function nombreEnLettres(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 999_999_999) return String(n);
  n = Math.floor(n);
  if (n < 1000) return moinsDeMille(n);
  if (n < 1_000_000) {
    const m = Math.floor(n / 1000);
    const r = n % 1000;
    const milliers = m === 1 ? "mille" : `${moinsDeMille(m).replace(/(cent|vingt)s$/, "$1")} mille`;
    return r ? `${milliers} ${moinsDeMille(r)}` : milliers;
  }
  const mi = Math.floor(n / 1_000_000);
  const r = n % 1_000_000;
  const millions = `${moinsDeMille(mi)} million${mi > 1 ? "s" : ""}`;
  return r ? `${millions} ${nombreEnLettres(r)}` : millions;
}

const UNITES_MESURE: { motif: string; singulier: string; pluriel: string }[] = [
  { motif: "k€", singulier: "mille euros", pluriel: "mille euros" },
  { motif: "M€", singulier: "million d'euros", pluriel: "millions d'euros" },
  { motif: "€", singulier: "euro", pluriel: "euros" },
  { motif: "%", singulier: "pour cent", pluriel: "pour cent" },
  { motif: "min", singulier: "minute", pluriel: "minutes" },
  { motif: "h", singulier: "heure", pluriel: "heures" },
  { motif: "km", singulier: "kilomètre", pluriel: "kilomètres" },
  { motif: "kg", singulier: "kilo", pluriel: "kilos" },
  { motif: "Mo", singulier: "méga-octet", pluriel: "méga-octets" },
  { motif: "Go", singulier: "giga-octet", pluriel: "giga-octets" },
  { motif: "ans", singulier: "an", pluriel: "ans" },
  { motif: "j", singulier: "jour", pluriel: "jours" },
];

// Unité collée ou séparée par une espace ; « % » et « € » ne sont pas des lettres : borne de fin assouplie pour eux.
const MOTIF_CHIFFRE = new RegExp(
  `(?<![\\p{L}\\p{N},.])(\\d{1,3}(?:[ \\u00a0]\\d{3})+|\\d+)(?:,(\\d+))?[ \\u00a0]?(${UNITES_MESURE.map((u) => echapper(u.motif)).join("|")})(?![\\p{L}\\p{N}])`,
  "gu",
);

/** « 35 h » → « trente-cinq heures » ; « 1,5 % » → « un virgule cinq pour cent ». */
export function chiffreEnLettres(entier: string, decimales: string | undefined, unite: string): string {
  const n = Number(entier.replace(/[ \u00a0]/g, ""));
  const u = UNITES_MESURE.find((x) => x.motif === unite);
  const zeros = decimales ? (/^0+/.exec(decimales)?.[0].length ?? 0) : 0;
  const virgule = decimales ? ` virgule ${"zéro ".repeat(Math.min(zeros, decimales.length - 1))}${nombreEnLettres(Number(decimales))}` : "";
  const pluriel = n >= 2 || !!decimales;
  return `${nombreEnLettres(n)}${virgule} ${u ? (pluriel ? u.pluriel : u.singulier) : unite}`.trim();
}

/** Mots anglais courants dans un script (liste locale ; la détection fine passera par Claude, simulée d'ici là). */
const ANGLICISMES = new Set(
  (
    "meeting meetings feedback startup start-up deadline business marketing newsletter cloud email e-mail mail mails team coach coaching " +
    "deal freelance challenge planning manager management leader leadership best-of benchmark brainstorming briefing call checklist " +
    "dashboard digital data design follow-up growth hacking insight inbox lead leads live login mindset networking open-space " +
    "outsourcing pitch podcast reporting retargeting reels replay scale-up showroom slide slides smartphone software storytelling story " +
    "stories target teasing timing tips to-do update upgrade web webinar week-end workshop chatbot bot no-code low-code prompt prompts " +
    "token tokens copilot workflow workflows pipeline saas"
  ).split(/\s+/),
);

/**
 * Mots français très courants (liste locale) : un mot en majuscule initiale au milieu d'une phrase qui n'en fait pas
 * partie est traité comme un nom propre.
 */
const COURANTS = new Set(
  (
    "a à au aux avec avant après alors aussi autre bien bon bonne bonjour ça ce cela celle celui ces cet cette chaque chez comme comment " +
    "dans de des deux dire dit donc du elle elles en encore enfin entre est et été être eux fait faire faut il ils je jamais jour " +
    "la le les leur leurs lui ma mais me même mes moi mon ne ni non nos notre nous on ou où par pas pendant peu peut plus pour pourquoi " +
    "quand que quel quelle qui quoi sa sans se ses si son sont sous sur ta te tes toi ton tous tout toute toutes très tu un une vos votre " +
    "vous voici voilà oui merci madame monsieur france français française paris europe internet lundi mardi mercredi jeudi vendredi samedi " +
    "dimanche janvier février mars avril mai juin juillet août septembre octobre novembre décembre premier première dernier dernière " +
    "attention résultat exemple conseil astuce question réponse étape point surtout ensuite puis"
  ).split(/\s+/),
);

/** Orthographe peu française (« k », « w », « sh », « th », « oo », « ee », finale « -ing ») : mot à écouter. */
function orthographeInhabituelle(mot: string): boolean {
  const m = mot.toLowerCase();
  if (m.length < 4 || COURANTS.has(m)) return false;
  return /(sh|th|oo|ee|ck|ght|ing$|^w|[^aeiouy]w|k[^h]|k$|[bcdfghjklmnpqrstvwxz]{4,})/.test(m);
}

const ELISION = /^(?:[ldjnmstc]|qu|jusqu|lorsqu|puisqu)['’]/i;

/**
 * Mots à risque d'un script (n° 2). Un mot déjà connu (ou l'une de ses variantes) n'est plus proposé. Les plus
 * fréquents d'abord, `limite` au plus.
 */
export function detecterMotsARisque(texte: string, connus: { mot: string; ecriture?: string; archiveLe?: string }[] = [], limite = 8): MotARisque[] {
  const clesConnues = new Set<string>();
  for (const c of connus) {
    if (c.archiveLe) continue;
    for (const f of [c.mot, c.ecriture ?? ""]) {
      const k = cleMot(f);
      if (k) clesConnues.add(k);
    }
  }
  const estConnu = (cle: string) => clesConnues.has(cle) || (/[sx]$/.test(cle) && clesConnues.has(cle.slice(0, -1)));
  const trouves = new Map<string, MotARisque & { rang: number }>();
  let rang = 0;
  const noter = (mot: string, raison: RaisonRisque, suggestion?: string) => {
    const cle = cleMot(mot);
    if (!cle || estConnu(cle)) return;
    const deja = trouves.get(cle);
    if (deja) deja.occurrences++;
    else trouves.set(cle, { mot, raison, occurrences: 1, suggestion, rang: rang++ });
  };

  // Les mots connus (variantes comprises : « Axion IA » pour « Axion-IA ») sont retirés du texte avant l'examen.
  let reste = texte;
  for (const c of connus) {
    if (c.archiveLe) continue;
    for (const f of [c.mot, c.ecriture ?? ""]) if (f.trim()) reste = reste.replace(motifMot(f), " ");
  }
  // Chiffres avec unités (« 35 h », « 135 € ») d'abord : ils couvrent plusieurs mots.
  for (const m of reste.matchAll(MOTIF_CHIFFRE)) noter(m[0].replace(/[ \u00a0]+/g, " "), "chiffre", chiffreEnLettres(m[1], m[2], m[3]));
  const sansChiffres = reste.replace(MOTIF_CHIFFRE, " ");

  // Mots : lettres, chiffres, tirets et apostrophes internes ; le début de phrase est repéré pour les noms propres.
  const motif = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*|[.!?…:]+/gu;
  let debutPhrase = true;
  for (const m of sansChiffres.matchAll(motif)) {
    const brut = m[0];
    if (/^[.!?…:]+$/.test(brut)) {
      debutPhrase = true;
      continue;
    }
    const mot = brut.replace(ELISION, "") || brut;
    const minuscule = mot.toLowerCase();
    const sigle = /^(?=(?:.*\p{Lu}){2})[\p{Lu}\p{N}]{2,}$/u.test(mot) || /^\p{Lu}+\p{N}+\p{Lu}*$/u.test(mot);
    if (sigle) noter(mot, "sigle", epelerSigle(mot));
    else if (ANGLICISMES.has(minuscule)) noter(mot, "anglicisme");
    else if (/\p{Ll}\p{Lu}/u.test(mot)) noter(mot, "nom-propre");
    else if (/^\p{Lu}/u.test(mot) && mot.length > 1 && !COURANTS.has(minuscule) && (!debutPhrase || orthographeInhabituelle(mot))) noter(mot, "nom-propre");
    else if (!/^\p{Lu}/u.test(mot) && orthographeInhabituelle(mot)) noter(mot, "inhabituel");
    debutPhrase = false;
  }
  return [...trouves.values()].sort((a, b) => b.occurrences - a.occurrences || a.rang - b.rang).slice(0, limite).map((r) => ({ mot: r.mot, raison: r.raison, occurrences: r.occurrences, suggestion: r.suggestion }));
}

/* ------------------------------------------------------------------ */
/* n° 4 — liste collée « mot = prononciation »                          */
/* ------------------------------------------------------------------ */

export type EtatLigneCollee = "nouveau" | "deja-dans-la-liste" | "doublon-du-collage" | "illisible";

export interface LigneCollee {
  numero: number;
  texte: string;
  mot: string;
  prononciation: string;
  /** Troisième partie facultative : « 35h = trente-cinq heures | 35 h ». */
  ecriture?: string;
  etat: EtatLigneCollee;
}

/**
 * Lit une liste collée, une ligne par mot : `mot = prononciation` (aussi `=>`, `→`, ` : ` ou une tabulation ; une
 * troisième partie après `|` donne la façon d'écrire). Les doublons (déjà dans la liste, ou deux fois dans le collage)
 * sont signalés, jamais enregistrés deux fois.
 */
export function lireListeCollee(texte: string, existants: { mot: string; archiveLe?: string }[] = []): LigneCollee[] {
  const connus = new Set(existants.filter((e) => !e.archiveLe).map((e) => cleMot(e.mot)));
  const vus = new Set<string>();
  const lignes: LigneCollee[] = [];
  texte.split(/\r?\n/).forEach((brute, i) => {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith("#")) return;
    const separateur = /\s*(?:=>|→|=|\t|\s:\s?|:\s)\s*/.exec(ligne);
    const gauche = separateur ? ligne.slice(0, separateur.index) : ligne;
    const droite = separateur ? ligne.slice(separateur.index + separateur[0].length) : "";
    const [prononciation, ecriture] = droite.split(/\s*\|\s*/);
    const base = { numero: i + 1, texte: ligne, mot: gauche.trim().slice(0, 60), prononciation: (prononciation ?? "").trim().slice(0, 120), ecriture: ecriture?.trim().slice(0, 60) || undefined };
    if (!separateur || !base.mot || !base.prononciation) return void lignes.push({ ...base, etat: "illisible" });
    const cle = cleMot(base.mot);
    const etat: EtatLigneCollee = connus.has(cle) ? "deja-dans-la-liste" : vus.has(cle) ? "doublon-du-collage" : "nouveau";
    vus.add(cle);
    lignes.push({ ...base, etat });
  });
  return lignes;
}

/* ------------------------------------------------------------------ */
/* n° 5, 9 — usage dans les vidéos, contrôle des vidéos déjà fabriquées */
/* ------------------------------------------------------------------ */

/** Nombre de textes (un par vidéo) qui contiennent le mot ou sa façon d'écrire. */
export function compterUtilisations(p: Pick<Prononciation, "mot" | "ecriture">, textes: string[]): number {
  return textes.filter((t) => contientMot(t, p.mot) || (!!p.ecriture && contientMot(t, p.ecriture))).length;
}

/** Une prononciation ajoutée (ou changée) APRÈS la fabrication d'une version qui contient le mot. */
export interface PrononciationAjouteeDepuis {
  id: Id;
  mot: string;
  prononciation: string;
}

/**
 * Contrôle de la fiche vidéo (n° 9) : entrées actives (pour la voix de la vidéo) dont le mot apparaît dans le texte de
 * la version, et que la commande de cette version n'appliquait pas (ou avec une autre prononciation).
 */
export function prononciationsAjouteesDepuis(
  version: { texte: string; prononciations: { mot: string; prononciation: string }[] },
  liste: Prononciation[],
  contexte: ContextePrononciation = {},
): PrononciationAjouteeDepuis[] {
  const appliquees = new Map(version.prononciations.map((p) => [cleMot(p.mot), p.prononciation.trim()]));
  const sortie: PrononciationAjouteeDepuis[] = [];
  for (const p of liste) {
    if (p.archiveLe || !p.prononciation.trim() || !appliqueA(p, contexte)) continue;
    if (!contientMot(version.texte, p.mot) && !(p.ecriture && contientMot(version.texte, p.ecriture))) continue;
    const avant = appliquees.get(cleMot(p.mot)) ?? (p.ecriture ? appliquees.get(cleMot(p.ecriture)) : undefined);
    if (avant === p.prononciation.trim()) continue;
    sortie.push({ id: p.id, mot: p.mot, prononciation: p.prononciation });
  }
  return sortie;
}

/* ------------------------------------------------------------------ */
/* n° 10 — liste de départ                                              */
/* ------------------------------------------------------------------ */

/** Liste de départ, à valider par Will à l'écoute (`source: 'depart'`, sans `ecouteeLe`). */
export const PRONONCIATIONS_DEPART: { mot: string; prononciation: string }[] = [
  { mot: "Axion-IA", prononciation: "axion i-a" },
  { mot: "IA", prononciation: "i-a" },
  { mot: "PV", prononciation: "pé-vé" },
  { mot: "RGPD", prononciation: "èr-jé-pé-dé" },
  { mot: "TVA", prononciation: "té-vé-a" },
  { mot: "PME", prononciation: "pé-èm-eu" },
  { mot: "TPE", prononciation: "té-pé-eu" },
  { mot: "CRM", prononciation: "cé-èr-èm" },
  { mot: "API", prononciation: "a-pé-i" },
  { mot: "SEO", prononciation: "èss-eu-o" },
  { mot: "Excel", prononciation: "ekssèl" },
  { mot: "Telegram", prononciation: "télégrame" },
  { mot: "ChatGPT", prononciation: "tchatte jé-pé-té" },
  { mot: "Claude", prononciation: "clôde" },
  { mot: "HeyGen", prononciation: "hé-djène" },
];
