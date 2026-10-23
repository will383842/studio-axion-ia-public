/**
 * RESSEMBLANCE COMMUNE DES SCRIPTS (lot C1.1). PUR : aucune lecture de base, aucun appel payant.
 * Une même mesure pour tous les générateurs (cas concret, tableau, face caméra, image → vidéo…) ; rien n'est branché ici.
 *
 * Trois formes de ressemblance ; la copie et la paraphrase font refuser, le moule est seulement un signal (mesure : en service un
 * script est comparé à 60 anciens, le moule seul refusait à tort 2 scripts honnêtes sur 60) :
 *  - COPIE : une suite de `TAILLE_SIMILARITE` mots ou plus reprise d'un script antérieur (casse, ponctuation, accents ignorés) ;
 *  - PARAPHRASE : une phrase qui redit une phrase antérieure avec d'autres mots de liaison ou un autre ordre (mêmes racines
 *    de mots pleins, Jaccard >= `JACCARD_PARAPHRASE`, au moins `PLEINS_PARAPHRASE` mots pleins de chaque côté) ;
 *  - MOULE : la même charpente de phrase, mots pleins remplacés par « _ » (fenêtre de `FENETRE_MOULE` éléments, au moins
 *    `OUTILS_MOULE_MIN` mots outils dont `OUTILS_FORTS_MIN` non faibles, au moins `TROUS_MOULE_MIN` « _ »).
 * Les exclusions (promesse, faits, mot à commenter… que le cas doit redire) sont BLANCHIES dans le texte brut avant toute mesure.
 * Un script collé par Will (origine « will ») n'est JAMAIS contrôlé.
 */
import { echapper, texteCompare } from "@/domaine/controles-script/texte";

/** Séquences retenues pour la mémoire donnée à Claude (mots). */
export const TAILLE_MEMOIRE = 4;
/** Séquence reprise qui fait refuser le script (mots). */
export const TAILLE_SIMILARITE = 5;
/** Mots pleins au moins dans une séquence (sinon : mots outils, ce n'est pas une tournure). */
export const PLEINS_MIN = 2;
/** Mots outils (articles, prépositions, pronoms, auxiliaires, conjonctions), normalisés. */
export const MOTS_OUTILS = new Set(
  [
    "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux", "et", "ou", "en", "a", "y", "ne", "n", "pas",
    "que", "qu", "qui", "se", "s", "me", "m", "te", "t", "ce", "c", "ca", "cela", "il", "elle", "on", "ils", "elles", "je", "j",
    "tu", "nous", "vous", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre", "vos", "leur",
    "leurs", "dans", "sur", "sous", "par", "pour", "avec", "sans", "est", "sont", "etait", "etaient", "ete", "etre", "avoir",
    "ont", "avait", "as", "ai", "avons", "avez", "puis", "mais", "donc", "or", "ni", "si", "ici", "la",
  ].map((m) => texteCompare(m)),
);

export interface Mot {
  /** Mot tel qu'il est écrit (ponctuation de bord retirée). */
  brut: string;
  /** Mot normalisé (casse, accents, ponctuation, apostrophes). */
  cle: string;
  plein: boolean;
}

/** Phrases d'un texte dit, chacune en mots. Une séquence ne passe jamais d'une phrase à l'autre. */
export function phrases(texte: string): Mot[][] {
  return texte
    .split(/(?<=[.!?…])\s+/)
    .map((p) =>
      p
        .split(/\s+/)
        .map((brut): Mot | null => {
          const cle = texteCompare(brut).replace(/\s+/g, "");
          if (!/[a-z0-9]/.test(cle)) return null;
          const radical = cle.replace(/^(?:l|d|c|j|n|s|m|t|qu)'/, "");
          const nu = brut.replace(/^[«"“(\s]+|[»"”).,;:!?…\s]+$/g, "");
          return { brut: nu, cle, plein: !MOTS_OUTILS.has(cle) && !MOTS_OUTILS.has(radical) };
        })
        .filter((m): m is Mot => !!m),
    )
    .filter((p) => p.length > 0);
}

export interface Fenetre {
  cle: string;
  debut: number;
  fin: number;
  pleins: number;
}

export function fenetres(phrase: readonly Mot[], taille: number): Fenetre[] {
  const res: Fenetre[] = [];
  for (let i = 0; i + taille <= phrase.length; i++) {
    const m = phrase.slice(i, i + taille);
    res.push({ cle: m.map((x) => x.cle).join(" "), debut: i, fin: i + taille, pleins: m.filter((x) => x.plein).length });
  }
  return res;
}

/** Clés des fenêtres de `taille` mots des textes donnés, sans le filtre des mots pleins (ce que le cas doit redire). */
export function clesTolerees(textes: readonly string[], taille: number): Set<string> {
  return new Set(textes.flatMap((t) => phrases(t).flatMap((p) => fenetres(p, taille).map((f) => f.cle))));
}

/** Séquences (clés normalisées) de `taille` mots d'un texte, sans doublon, hors fenêtres de mots outils. */
export function sequencesDe(texte: string, taille: number = TAILLE_MEMOIRE): string[] {
  return [...new Set(phrases(texte).flatMap((p) => fenetres(p, taille).filter((f) => f.pleins >= PLEINS_MIN).map((f) => f.cle)))];
}

export interface Sequence {
  /** Forme normalisée (comparaison). */
  cle: string;
  /** Forme écrite dans le script (affichée à Claude et à Will). */
  texte: string;
  mots: number;
  /** Nombre de scripts qui la contiennent. */
  scripts: number;
}

export interface OptionsVariete {
  /** Textes que le cas courant doit redire : promesse, faits, ce qui reste humain, mot à commenter… Jamais comptés. */
  tolere?: readonly string[];
}

/** Séquences maximales (suites de fenêtres qualifiées qui se chevauchent) d'un texte pour une taille donnée. */
export function suites(texte: string, taille: number, tolerees: ReadonlySet<string>): { cle: string; texte: string; mots: number }[] {
  const res: { cle: string; texte: string; mots: number }[] = [];
  for (const p of phrases(texte)) {
    const couvert = new Array<boolean>(p.length).fill(false);
    for (const f of fenetres(p, taille)) {
      if (f.pleins < PLEINS_MIN || tolerees.has(f.cle)) continue;
      for (let k = f.debut; k < f.fin; k++) couvert[k] = true;
    }
    let debut = -1;
    for (let k = 0; k <= p.length; k++) {
      if (couvert[k] && debut < 0) debut = k;
      if (!couvert[k] && debut >= 0) {
        const m = p.slice(debut, k);
        res.push({ cle: m.map((x) => x.cle).join(" "), texte: m.map((x) => x.brut).join(" "), mots: m.length });
        debut = -1;
      }
    }
  }
  return res;
}


/**
 * Les séquences de `TAILLE_SIMILARITE` mots ou plus de `script` déjà dites dans `anterieurs` (hors `tolere`), suites
 * maximales, les plus longues d'abord.
 */
export function copiesDe(script: string, anterieurs: readonly string[], options: OptionsVariete = {}): Sequence[] {
  const dites = new Set(anterieurs.flatMap((a) => sequencesDe(a, TAILLE_SIMILARITE)));
  if (!dites.size) return [];
  const tolerees = clesTolerees(options.tolere ?? [], TAILLE_SIMILARITE);
  const reprises = new Set([...dites].filter((c) => !tolerees.has(c)));
  const res: Sequence[] = [];
  for (const p of phrases(script)) {
    const couvert = new Array<boolean>(p.length).fill(false);
    for (const f of fenetres(p, TAILLE_SIMILARITE)) if (reprises.has(f.cle) && f.pleins >= PLEINS_MIN) for (let k = f.debut; k < f.fin; k++) couvert[k] = true;
    let debut = -1;
    for (let k = 0; k <= p.length; k++) {
      if (couvert[k] && debut < 0) debut = k;
      if (!couvert[k] && debut >= 0) {
        const m = p.slice(debut, k);
        res.push({ cle: m.map((x) => x.cle).join(" "), texte: m.map((x) => x.brut).join(" "), mots: m.length, scripts: anterieurs.filter((a) => sequencesDe(a, TAILLE_SIMILARITE).some((c) => ` ${m.map((x) => x.cle).join(" ")} `.includes(` ${c} `))).length });
        debut = -1;
      }
    }
  }
  return res.sort((a, b) => b.mots - a.mots);
}

/* ------------------------------------------------------------------ */
/* Exclusions blanchies dans le texte brut                              */
/* ------------------------------------------------------------------ */

/** Pliage des accents À LONGUEUR CONSTANTE (un caractère donne un caractère) : les positions restent celles du texte brut. */
function plier(t: string): string {
  return t
    .split("")
    .map((c) => {
      const bas = c.toLowerCase();
      const base = bas.normalize("NFD")[0] ?? bas;
      return base.length === 1 ? base : bas.length === 1 ? bas : c;
    })
    .join("")
    .replace(/[’`ʼ]/g, "'");
}

/**
 * Retire du texte brut les passages que le cas doit redire. Chaque passage trouvé est remplacé par un point suivi d'espaces
 * (même longueur) : aucune séquence ne peut donc traverser le trou. Un passage ne se trouve qu'entre deux limites de mot
 * (« AUTO » ne blanchit pas l'intérieur d'« automatisé ») ; espaces doublés et retours à la ligne comptent comme un espace.
 * Texte rendu tel quel sans exclusion.
 */
export function blanchirExclusions(texte: string, exclusions: readonly string[] = []): string {
  let res = texte;
  const motifs = [...exclusions]
    .map((e) => plier(e).trim())
    .filter(Boolean)
    .sort((x, y) => y.length - x.length)
    .map((e) => new RegExp(`(?<![\\p{L}\\p{N}])${e.split(/\s+/).map(echapper).join("\\s+")}(?![\\p{L}\\p{N}])`, "gu"));
  for (const re of motifs) {
    for (const m of [...plier(res).matchAll(re)]) {
      const i = m.index ?? 0;
      res = `${res.slice(0, i)}.${" ".repeat(m[0].length - 1)}${res.slice(i + m[0].length)}`;
    }
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Paraphrase                                                           */
/* ------------------------------------------------------------------ */

export const JACCARD_PARAPHRASE = 0.6;
export const PLEINS_PARAPHRASE = 4;

const SUFFIXES = ["aient", "erent", "ement", "ees", "ent", "ons", "ait", "ant", "ez", "er", "es", "ee", "e", "s", "x"];

/** Racine grossière d'un mot (sans accents) : rapproche « classe », « classent », « classer ». */
export function racine(mot: string): string {
  let m = texteCompare(mot).replace(/\s+/g, "").replace(/^(?:l|d|c|j|n|s|m|t|qu)'/, "");
  for (const s of SUFFIXES) {
    if (m.length - s.length >= 3 && m.endsWith(s)) {
      m = m.slice(0, -s.length);
      break;
    }
  }
  return m;
}

export interface Paraphrase {
  nouvelle: string;
  ancienne: string;
  proximite: number;
}

const racinesPleines = (p: readonly Mot[]): Set<string> => new Set(p.filter((m) => m.plein).map((m) => racine(m.cle)));

/** Phrases de `script` qui en redisent une d'`anterieurs` avec les mêmes racines de mots pleins (Jaccard >= 0,6). */
export function paraphrasesDe(script: string, anterieurs: readonly string[]): Paraphrase[] {
  const anciennes = anterieurs.flatMap((a) => phrases(a).map((p) => ({ p, r: racinesPleines(p) }))).filter((x) => x.r.size >= PLEINS_PARAPHRASE);
  const res: Paraphrase[] = [];
  for (const p of phrases(script)) {
    const r = racinesPleines(p);
    if (r.size < PLEINS_PARAPHRASE) continue;
    let meilleure: Paraphrase | null = null;
    for (const a of anciennes) {
      let commun = 0;
      for (const x of r) if (a.r.has(x)) commun++;
      const proximite = commun / (r.size + a.r.size - commun);
      if (proximite >= JACCARD_PARAPHRASE && (!meilleure || proximite > meilleure.proximite)) {
        meilleure = { nouvelle: p.map((m) => m.brut).join(" "), ancienne: a.p.map((m) => m.brut).join(" "), proximite: +proximite.toFixed(2) };
      }
    }
    if (meilleure) res.push(meilleure);
  }
  return res;
}

/* ------------------------------------------------------------------ */
/* Moule                                                                */
/* ------------------------------------------------------------------ */

export const FENETRE_MOULE = 6;
export const OUTILS_MOULE_MIN = 3;
export const OUTILS_FORTS_MIN = 2;
export const TROUS_MOULE_MIN = 2;

/** Mots outils FAIBLES : trop courants pour faire une charpente à eux seuls. */
const OUTILS_FAIBLES = new Set(["le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "et", "en", "a", "au", "aux"]);

export interface Moule {
  /** Charpente : mots outils gardés, mots pleins remplacés par « _ ». */
  cle: string;
  /** Les mots écrits dans le script qui la portent. */
  texte: string;
}

/** Charpentes d'un texte : fenêtres de 6 éléments (jamais à cheval sur deux phrases) qui passent les seuils. */
export function moulesDe(texte: string): Map<string, Moule> {
  const res = new Map<string, Moule>();
  for (const p of phrases(texte)) {
    for (let i = 0; i + FENETRE_MOULE <= p.length; i++) {
      const w = p.slice(i, i + FENETRE_MOULE);
      const elements = w.map((m) => (m.plein ? "_" : m.cle));
      const outils = elements.filter((e) => e !== "_");
      const forts = outils.filter((e) => !OUTILS_FAIBLES.has(e));
      if (outils.length < OUTILS_MOULE_MIN || forts.length < OUTILS_FORTS_MIN || elements.length - outils.length < TROUS_MOULE_MIN) continue;
      const cle = elements.join(" ");
      if (!res.has(cle)) res.set(cle, { cle, texte: w.map((m) => m.brut).join(" ") });
    }
  }
  return res;
}

/** Charpentes de `script` déjà présentes dans `anterieurs`. */
export function moulesCommuns(script: string, anterieurs: readonly string[]): Moule[] {
  const dites = new Set(anterieurs.flatMap((a) => [...moulesDe(a).keys()]));
  return [...moulesDe(script).values()].filter((m) => dites.has(m.cle));
}

/* ------------------------------------------------------------------ */
/* Verdict commun                                                       */
/* ------------------------------------------------------------------ */

export interface ResultatRessemblance {
  copies: Sequence[];
  paraphrases: Paraphrase[];
  moules: Moule[];
  /** Une copie ou une paraphrase au moins. Le moule est un SIGNAL (`moules`), jamais un refus à lui seul. */
  ressemble: boolean;
}

/** Compare un script aux anciens ; les `exclusions` sont blanchies du texte brut des deux côtés. */
export function comparerScripts(nouveau: string, anciens: readonly string[], exclusions: readonly string[] = []): ResultatRessemblance {
  const n = blanchirExclusions(nouveau, exclusions);
  const a = anciens.map((x) => blanchirExclusions(x, exclusions));
  const copies = copiesDe(n, a);
  const paraphrases = paraphrasesDe(n, a);
  const moules = moulesCommuns(n, a);
  return { copies, paraphrases, moules, ressemble: copies.length > 0 || paraphrases.length > 0 };
}

export type OrigineScript = "will" | "claude" | "code";

export interface ResultatControleRessemblance extends ResultatRessemblance {
  /** false : script de Will, jamais contrôlé. */
  controle: boolean;
}

/** Contrôle d'un script rendu : un script collé par Will (origine « will ») n'est jamais contrôlé ni refusé. */
export function controlerRessemblance(entree: { texte: string; anciens: readonly string[]; origine: OrigineScript; exclusions?: readonly string[] }): ResultatControleRessemblance {
  if (entree.origine === "will") return { controle: false, copies: [], paraphrases: [], moules: [], ressemble: false };
  return { controle: true, ...comparerScripts(entree.texte, entree.anciens, entree.exclusions) };
}
