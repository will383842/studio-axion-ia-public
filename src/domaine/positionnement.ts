/**
 * POSITIONNEMENT DE WILL, règles partagées (lot A2). PUR : importable partout (contrôles centraux, tableau, chaîne).
 * « Jamais faites-le vous-même, on s'occupe de tout pour vous » ; jamais d'annonce d'outil.
 * Le mot « vous-même » seul n'est PAS une faute : il décrit une douleur (« vous le faites vous-même chaque lundi »).
 * Les formules (« faites-le », « fais-le ») valent dans les deux adresses (vous et tu) ; les suites d'impératifs sans -ez
 * (« Liste… Coche… ») ne se lisent qu'en « tu ».
 */
import type { Adresse } from "./types";

function norm(t: string): string {
  return t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’`ʼ]/g, "'").replace(/\s+/g, " ").trim();
}

/**
 * Formules de « faites-le vous-même » (texte normalisé). « faites-le » seulement avec le tiret (« faites le calcul » n'en
 * est pas une) et sans la suite qui confie la tâche à une équipe (« avec nous », « par votre équipe », « tester »…).
 */
export const FAITES_LE_VOUS_MEME =
  /(?:^|[^a-z])(par vous[- ]memes?|vous[- ]memes?|a vous de jouer|faites le vous[- ]memes?|lancez[- ]vous|faites ce test|faites-le(?! (?:avec|par|tester|verifier|installer|faire|configurer)\b)|testez-le(?! avec\b)|essayez-le(?! avec\b)|installez-le(?! avec\b)|copiez ce prompt|pas besoin de nous|pas besoin d'un expert|pas besoin d'aide|sans aide|tout seul comme)(?=$|[^a-z])/;

/** Les mêmes formules au tutoiement. */
export const FAIS_LE_TOI_MEME =
  /(?:^|[^a-z])(par toi[- ]memes?|toi[- ]memes?|a toi de jouer|fais le toi[- ]memes?|lance[- ]toi|fais ce test|fais-le(?! (?:avec|par|tester|verifier|installer|faire|configurer)\b)|teste-le(?! avec\b)|essaie-le(?! avec\b)|installe-le(?! avec\b)|copie ce prompt)(?=$|[^a-z])/;

export const NOUVEAUTE_OUTIL =
  /(?:^|[^a-z])(vient de sortir|viennent de sortir|vient d'etre (?:lance|lancee|annonce|annoncee|publie|publiee)|vient de lancer|viennent de lancer|vient d'annoncer|viennent d'annoncer|vient de devoiler|nouvel outil|nouveaux outils|nouvelles? fonctionnalites?|derniere mise a jour|nouvelle mise a jour|(?:tout nouveau|toute nouvelle|nouvelle version|derniere version) (?:outil|fonctionnalite|ia|modele|version de \w+)|(?:nouvelle|derniere) version d(?:e |')(?:chatgpt|claude|gpt|gemini|midjourney|heygen|sora|copilot|l'ia)|annonce de la semaine|annonce (?:de la sortie|du lancement)|l'annonce d(?:e |')(?:openai|google|microsoft|anthropic|meta|apple|mistral)|fraichement sorti|j'ai teste les deux|j'ai teste pour vous)(?=$|[^a-z])/;

/**
 * Dispense AVANT la formule, dans la même proposition : la formule est niée ou c'est nous qui faisons (« vous n'avez plus à
 * le faire vous-même », « jamais faites-le… »).
 */
const DISPENSE_AVANT =
  /(?:^|[^a-z])(?:plus a |pas besoin de |sans |ne (?:\w+ )?pas |n'a(?:vez|s|i)? (?:plus |pas )|jamais |on s'en occupe|nous (?:le |la |les )?(?:faisons|gerons|mettons))/;
/**
 * Dispense APRÈS la formule, dans la même proposition : le travail est confié à nous (« installez-le avec notre équipe »).
 * Jamais quand « vous-même » suit la formule : c'est alors l'ordre lui-même (« faites-le vous-même, c'est simple pour
 * vous » : la virgule coupe la proposition ; « sans attendre » ou « avec notre guide » ne dispensent pas).
 */
const DISPENSE_APRES = /(?:^|[^a-z])(?:pour vous|pour toi|avec nous|avec notre equipe|par notre equipe|avec nos equipes|a notre place|on s'en occupe)/;
const ORDRE_VOUS_MEME = /(?:vous|toi)[- ]memes?/;

function phrases(texte: string): string[] {
  return norm(texte).split(/(?<=[.!?])\s+/);
}

/** « vous-même » ou « toi-même » seuls : une douleur décrite, pas une consigne (« par vous-même » en est une). */
const SEUL = /^(?:vous|toi)[- ]memes?$/;

function dispensee(phrase: string, debut: number, fin: number): boolean {
  const coupures = [...phrase.matchAll(/[,;:]/g)].map((m) => m.index!);
  const d = Math.max(-1, ...coupures.filter((c) => c < debut)) + 1;
  const f = coupures.find((c) => c >= fin) ?? phrase.length;
  const avant = phrase.slice(d, debut);
  const apres = phrase.slice(fin, f);
  if (DISPENSE_AVANT.test(avant)) return true;
  return !ORDRE_VOUS_MEME.test(apres) && DISPENSE_APRES.test(apres);
}

/** Premier repère de « faites-le vous-même » (vous ou tu) dans un texte, sinon `undefined`. Toutes les occurrences sont lues. */
export function diyFormule(texte: string): string | undefined {
  for (const phrase of phrases(texte)) {
    for (const motif of [FAITES_LE_VOUS_MEME, FAIS_LE_TOI_MEME]) {
      for (const m of phrase.matchAll(new RegExp(motif.source, "g"))) {
        if (SEUL.test(m[1])) continue;
        const debut = m.index! + m[0].indexOf(m[1]);
        if (!dispensee(phrase, debut, debut + m[1].length)) return m[1];
      }
    }
  }
  return undefined;
}

/** Conclusion : mêmes formules (la conclusion ne se juge pas sur un « vous-même » seul). */
export function faitLeVousMeme(texte: string): string | undefined {
  return diyFormule(texte);
}

/* ------------------------------------------------------------------ */
/* Tutoriel : une suite de consignes à l'impératif adressées au spectateur */
/* ------------------------------------------------------------------ */

/** Impératif en -ez (« listez », « cochez ») : pas « chez/assez/nez/rez/lez », pas l'inversion « savez-vous », « avez-vous ». */
const DEBUT_IMPERATIF = /^(?!(?:chez|assez|nez|rez|lez)\b)[a-z]{2,}ez\b(?!-(?:vous|nous)\b)/;

/** Verbes d'action courants à l'impératif au tutoiement (sans -ez) : lus seulement quand la vidéo tutoie. */
const VERBES_TU = new Set(
  "liste coche ecris note ouvre copie colle envoie cree fais teste installe lance essaie clique ajoute remplis compte choisis prends sauvegarde verifie relis active configure trie classe regroupe imagine".split(" "),
);

function estImperatif(phrase: string, adresse?: Adresse): boolean {
  if (phrase.endsWith("?")) return false;
  if (DEBUT_IMPERATIF.test(phrase)) return true;
  if (adresse !== "tu") return false;
  const premier = /^[a-z]+/.exec(phrase)?.[0];
  return !!premier && VERBES_TU.has(premier);
}

/** Une unité de lecture : une phrase, ou « Un. » + la phrase qui suit. `numerotee` : annoncée par un numéro dit ou par « D'abord/Ensuite/Puis/Enfin ». */
interface Unite {
  phrase: string;
  numerotee: boolean;
  imperatif: boolean;
}

function unites(texte: string, adresse?: Adresse): Unite[] {
  const brutes = phrases(texte);
  const out: Unite[] = [];
  for (let i = 0; i < brutes.length; i++) {
    let p = brutes[i];
    let numerotee = false;
    const enchainement = p.replace(/^(?:d'abord|ensuite|puis|enfin|premierement|deuxiemement|troisiemement|(?:premiere|deuxieme|troisieme|quatrieme|cinquieme|derniere) etape|etape \d+)\s*[,:)-]?\s+/, "");
    if (enchainement !== p) {
      p = enchainement;
      numerotee = true;
    }
    // « Un. » « Deux. » « Etape 3. » dits seuls : la phrase suivante porte le verbe.
    if (/^(?:un|une|deux|trois|quatre|cinq|etape \d+|\d+)[.:)]?$/.test(p) && brutes[i + 1]) {
      p = brutes[++i];
      numerotee = true;
    }
    out.push({ phrase: p, numerotee, imperatif: estImperatif(p, adresse) });
  }
  return out;
}

/** Les consignes à l'impératif d'un texte (phrases finies par « ? » exclues). */
export function consignesImperatives(texte: string, adresse?: Adresse): { phrase: string; numerotee: boolean }[] {
  return unites(texte, adresse).filter((u) => u.imperatif).map(({ phrase, numerotee }) => ({ phrase, numerotee }));
}

export const phrasesImperatives = (texte: string, adresse?: Adresse): string[] => consignesImperatives(texte, adresse).map((c) => c.phrase);

/** Une consigne qui dit que c'est NOUS qui faisons n'est pas un « faites-le vous-même ». */
const NOUS_FAISONS = /pour vous|pour toi|avec nous|avec notre equipe|par notre equipe|a notre place|on s'en occupe/;

/** Tutoriel NUMÉROTÉ (« Un. Listez… Deux. Cochez… ») : au moins 2 consignes annoncées par un numéro ou « D'abord ». Renvoie leur nombre, sinon 0. */
export function tutorielNumerote(texte: string, adresse?: Adresse): number {
  const n = unites(texte, adresse).filter((u) => u.imperatif && u.numerotee && !NOUS_FAISONS.test(u.phrase)).length;
  return n >= 2 ? n : 0;
}

/** Une phrase qui enchaîne au moins 3 impératifs séparés par des virgules (« Listez, cochez, écrivez, envoyez. ») : renvoie leur nombre, sinon 0. */
function listeVirgules(texte: string, adresse?: Adresse): number {
  let meilleure = 0;
  for (const phrase of phrases(texte)) {
    if (phrase.endsWith("?")) continue;
    const parties = phrase.split(/\s*,\s*/);
    const n = parties.filter((x) => estImperatif(x, adresse) && !NOUS_FAISONS.test(x)).length;
    if (parties.length >= 3 && n >= 3) meilleure = Math.max(meilleure, n);
  }
  return meilleure;
}

/**
 * TUTORIEL (anti-pattern A1) : au moins 2 consignes numérotées (`tutorielNumerote`), ou 3 impératifs en tête de phrase
 * QUI SE SUIVENT (une phrase qui n'en est pas une coupe la suite). Renvoie le nombre de consignes comptées, sinon 0.
 */
export function tutoriel(texte: string, adresse?: Adresse): number {
  const numerote = tutorielNumerote(texte, adresse);
  if (numerote) return numerote;
  const liste = listeVirgules(texte, adresse);
  if (liste) return liste;
  let serie = 0;
  let meilleure = 0;
  for (const u of unites(texte, adresse)) {
    serie = u.imperatif && !NOUS_FAISONS.test(u.phrase) ? serie + 1 : 0;
    meilleure = Math.max(meilleure, serie);
  }
  return meilleure >= 3 ? meilleure : 0;
}

/**
 * « Faites-le vous-même » partout dans le texte : une formule (`diyFormule`) ou un tutoriel (`tutoriel`). Renvoie le
 * repère trouvé, sinon `undefined`. Le mot « vous-même » seul ne compte pas.
 */
export function diyImperatif(texte: string, adresse?: Adresse): string | undefined {
  const formule = diyFormule(texte);
  if (formule) return formule;
  const n = tutoriel(texte, adresse);
  return n ? `${n} consignes à l'impératif de suite` : undefined;
}
