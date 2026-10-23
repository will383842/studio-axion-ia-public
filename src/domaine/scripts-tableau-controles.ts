/**
 * CONTRÔLES EN CODE DES SCRIPTS DU TABLEAU ANIMÉ — PURS, indépendants du modèle. Chaque contrôle rend ses défauts avec
 * un message clair en français ; un défaut `eliminatoire` empêche de livrer le script (une relance de l'écriture au
 * plus, puis refus expliqué). Règles : `docs/formats/tableau-anime-scripts/REGLES.md` (v4 du 15/10, gabarit cadré) :
 * § 2 bis (l'entreprise), 3 (six passages, bornes de mots, 2 à 3 constats « ce qui change »), 3 bis (organisation), 3 ter (vérité), 3 quater
 * (les dix contrôles du gabarit : une idée, un gain, une preuve), 4, 5 et 7.
 */
import {
  CORRECTIONS_MAX,
  MENTION_ILLUSTRATIF,
  QUESTIONS_IA,
  RESEAUX_SCRIPT_INFOS,
  normaliserScript,
  phrasesDites,
  phrasesEtape,
  type AffirmationScript,
  type CorrectionScript,
  type DemandeScriptTableau,
  type DureeScript,
  type EcritureScript,
  type PhraseScript,
  type ScriptTableau,
  type SourceChiffre,
} from "./scripts-tableau";
import { consignesImperatives, diyImperatif, faitLeVousMeme, NOUVEAUTE_OUTIL, tutoriel } from "./positionnement";
import { defautsMotsDouleur } from "./douleur-tableau";
import type { IdReseau } from "./types";
import { CARACTERES_DITS_MAX_TABLEAU, DEBIT_TABLEAU_MOTS_PAR_SEC, CARACTERES_PAR_SECONDE_TABLEAU, DUREE_MAX_TABLEAU_SEC, caracteresDits, caracteresEn, dureeDiteBrute, dureeDiteSec } from "./duree-tableau";

export type CodeControle =
  | "accroche-longue"
  | "accroche-question-molle"
  | "accroche-salutation"
  | "phrase-longue"
  | "phrase-vide"
  | "ecran-mots"
  | "nombre-etapes"
  | "etape-imperatif"
  | "etape-numero-dit"
  | "etape-vague"
  | "etape-sans-comment"
  | "etape-longue"
  | "promesse-nombre"
  | "passage-mots"
  | "script-mots"
  | "idee-absente"
  | "a-retenir-liste"
  | "gain-absent"
  | "gain-hors-promesse"
  | "gain-hors-exemple"
  | "entreprise-sans-lien"
  | "entreprise-incoherente"
  | "repetition-mots"
  | "formule-creuse"
  | "jargon"
  | "metier-repete"
  | "nombres-incoherents"
  | "exemple-absent"
  | "exemple-avant-apres"
  | "partie-vide"
  | "promesse-longue"
  | "a-retenir-long"
  | "douleur-tardive"
  | "repetition"
  | "libelle-probleme"
  | "affirmation-absolue"
  | "affirmation-non-verifiee"
  | "exemple-non-marque"
  | "action-absente"
  | "actions-multiples"
  | "action-hors-demande"
  | "cloture-longueur"
  | "cloture-question"
  | "cloture-virgule"
  | "duree-reseau"
  | "mot-interdit"
  | "chiffre-sans-source"
  | "mots-douleur"
  | "entreprise-corps"
  | "entreprise-fin"
  | "question-ia"
  | "positionnement"
  | "question-spectateur"
  | "redit-accroche"
  | "densite-scene"
  | "ecran-redit";

export interface DefautScript {
  code: CodeControle;
  message: string;
  eliminatoire: boolean;
}

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

/** Minuscules, apostrophes et espaces normalisés (pour les recherches). */
export function normaliser(t: string): string {
  return t.toLowerCase().replace(/[’ʼ`]/g, "'").replace(/ | /g, " ").replace(/\s+/g, " ").trim();
}

/** Mots d'un texte : les morceaux séparés par des espaces qui contiennent une lettre ou un chiffre. */
export function compterMots(t: string): number {
  return t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

/** Phrases d'un texte dit (coupées sur . ! ? … et les deux-points ne coupent pas). */
export function phrasesDe(t: string): string[] {
  return t
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter((p) => /[\p{L}\p{N}]/u.test(p));
}

/**
 * Durée estimée d'un texte dit, en secondes (arrondie au dixième) : LE SEUL estimateur du tableau
 * (`duree-tableau.ts`, calé sur la voix réelle), le même que celui des règles du découpage. L'ancien débit propre au
 * générateur (3,6 mots par seconde plus 0,1 s par phrase) est retiré : il ne disait pas la même durée que le découpage.
 */
export const dureeEstimee = (texteDit: string): number => dureeDiteSec(texteDit);

/** Le texte dit complet, phrases jointes par une espace (aussi rendu par `versTexteDit` du service). */
export function texteDitDe(s: ScriptTableau): string {
  return phrasesDites(s)
    .map((p) => p.dit.trim())
    .filter(Boolean)
    .join(" ");
}

const LONGUEUR_MAX_PHRASE = 18;
const MOTS_ACCROCHE_ECRAN = 8;

/* ------------------------------------------------------------------ */
/* 1. Accroche                                                         */
/* ------------------------------------------------------------------ */

const SALUTATIONS = /\b(bonjour|bonsoir|salut|hello|coucou|bienvenue|hey)\b|dans cette vid[ée]o|aujourd'hui,? (je|on|nous) (vais|va|allons)/;
/** Mots qui ouvrent une vraie question ouverte : la question n'est alors pas « molle ». */
const QUESTION_OUVERTE = /^(pourquoi|comment|combien|quel(le)?s?|qu'est-ce|que |qu'|où|qui|lequel|laquelle)/;

/**
 * Durée dite maximale de l'accroche (REGLES § 3) : 4,4 s, soit environ 74 caractères dits ou 12 mots à 165 mots/min, le
 * refus de l'accroche de `BORNES_PASSAGES`. La même valeur est le seuil d'AC-02 (`recettes/tableau.ts`).
 */
export const ACCROCHE_MAX_SEC = 4.4;

export function controlerAccroche(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const d: DefautScript[] = [];
  if (!s.accroche.some((p) => p.dit.trim())) return [{ code: "accroche-longue", message: "L'accroche est vide.", eliminatoire: true }];
  const accrocheDite = s.accroche.map((p) => p.dit.trim()).join(" ");
  const nPhrases = phrasesDe(accrocheDite).length;
  if (nPhrases > 1) d.push({ code: "accroche-longue", message: `L'accroche tient en ${nPhrases} phrases : une seule, qui dit la douleur (ou son résultat).`, eliminatoire: true });
  if (dureeDiteBrute(accrocheDite) > ACCROCHE_MAX_SEC) {
    d.push({ code: "accroche-longue", message: `L'accroche se dit en ${String(Math.round(dureeDiteBrute(accrocheDite) * 10) / 10).replace(".", ",")} s : ${String(ACCROCHE_MAX_SEC).replace(".", ",")} s au plus (${caracteresEn(ACCROCHE_MAX_SEC)} caractères dits).`, eliminatoire: true });
  }
  const motsEcran = s.accroche.reduce((n, p) => n + compterMots(p.ecran), 0);
  if (motsEcran > MOTS_ACCROCHE_ECRAN) {
    d.push({ code: "accroche-longue", message: `L'accroche affiche ${motsEcran} mots : ${MOTS_ACCROCHE_ECRAN} au plus, pour être lue sans le son en moins de 3 s.`, eliminatoire: true });
  }
  const dit = normaliser(s.accroche.map((p) => p.dit).join(" "));
  const ecran = normaliser(s.accroche.map((p) => p.ecran).join(" "));
  if (SALUTATIONS.test(dit) || SALUTATIONS.test(ecran)) {
    d.push({ code: "accroche-salutation", message: "L'accroche salue ou annonce la vidéo (« bonjour », « dans cette vidéo ») : elle doit entrer directement dans la situation.", eliminatoire: true });
  }
  for (const q of [...phrasesDe(dit), ...phrasesDe(ecran)].filter((p) => p.includes("?"))) {
    if (!QUESTION_OUVERTE.test(q)) {
      d.push({ code: "accroche-question-molle", message: `L'accroche pose une question molle (« ${q} ») : décrivez une situation vécue ou contredisez une idée reçue.`, eliminatoire: true });
      break;
    }
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* 2. Longueur des phrases et mots à l'écran                           */
/* ------------------------------------------------------------------ */

/** Une des formulations de la question sur l'IA (dite, jamais écrite : aucun mot à l'écran). */
const estQuestionIa = (dit: string) => QUESTIONS_IA.some((q) => normaliser(q) === normaliser(dit));

export function controlerPhrases(s: ScriptTableau): DefautScript[] {
  const d: DefautScript[] = [];
  for (const p of phrasesDites(s)) {
    if (!p.dit.trim()) {
      d.push({ code: "phrase-vide", message: "Une phrase n'a aucun texte dit.", eliminatoire: true });
      continue;
    }
    for (const ph of phrasesDe(p.dit)) {
      const n = compterMots(ph);
      if (n > LONGUEUR_MAX_PHRASE) d.push({ code: "phrase-longue", message: `Phrase de ${n} mots (${LONGUEUR_MAX_PHRASE} au plus) : « ${ph} »`, eliminatoire: true });
    }
    const e = compterMots(p.ecran);
    // La question sur l'IA n'a rien à l'écran (`controlerQuestionIa`).
    if (estQuestionIa(p.dit)) continue;
    if (e < 2 || e > 6) d.push({ code: "ecran-mots", message: `${e} mot${e > 1 ? "s" : ""} à l'écran (2 à 6) pour « ${p.dit.trim()} »`, eliminatoire: true });
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* 3. Étapes et exemple                                                */
/* ------------------------------------------------------------------ */

/**
 * Nombre de constats « ce qui change » (lot B1, décision D1 de Will du 18/10 : plus de tutoriel numéroté) : 3 par défaut,
 * de 2 à 3. Le nom « étapes » reste celui du schéma (`etapes`), pour ne pas casser les traces enregistrées.
 */
export const ETAPES_MIN = 2;
export const ETAPES_MAX = 3;
export const ETAPES_PAR_DEFAUT = 3;
/** En 30 s : 2 ou 3 étapes. */
export const ETAPES_MAX_30S = 3;
/** Ouvertures d'étape vagues : un conseil sans geste (« Soyez précis », « Pensez à… »). */
const OUVERTURE_VAGUE = /^(soyez|pensez|r[ée]fl[ée]chissez|n'oubliez pas|faites attention|prenez le temps|am[ée]liorez|adaptez|organisez-vous)\b/;
/** Mots dits de l'action, au moins : un constat précis (sujet ET verbe ET objet), jamais un mot nu. */
const MOTS_ACTION_MIN = 3;

/** Durée visée d'une demande (absente : 60 s). */
export const dureeVisee = (d: Pick<DemandeScriptTableau, "duree"> | undefined): DureeScript => (d?.duree === 30 ? 30 : 60);

/**
 * Bornes d'un constat « ce qui change » (mots dits, et phrases concrètes après l'action) : 60 s, 28 mots et 2 phrases ;
 * 30 s, 16 mots et une phrase. (Les paliers de 4 et 5 étapes ont disparu avec le lot B1 : 3 constats au plus.)
 */
export function bornesEtape(duree: DureeScript): { motsMax: number; phrasesMax: number } {
  return duree === 30 ? { motsMax: 16, phrasesMax: 1 } : { motsMax: 28, phrasesMax: 2 };
}

/** Les étapes réellement dites (une étape sans aucun mot ne compte pas). */
const etapesDites = (s: ScriptTableau) => s.etapes.filter((e) => phrasesEtape(e).some((p) => p.dit.trim()));

/**
 * CE QUI CHANGE (lot B1, décision D1 de Will du 18/10) : 2 à 3 constats, chacun = une « action » qui est un constat à
 * l'INDICATIF (sujet : la chose qui change, l'outil ou « on » ; « Le nom du client devient Client A. »), puis une ou deux
 * phrases concrètes, dans la borne de mots de l'étape. Aucun numéro dit n'est exigé (il n'est plus demandé). Un IMPÉRATIF
 * adressé au spectateur (« Listez… », « Un. Cochez… ») est éliminatoire : c'est un tutoriel, et l'entreprise s'occupe de
 * tout pour lui. « Prenons… » (1re personne du pluriel), l'indicatif et les noms ne sont pas des impératifs.
 */
/** Impératif adressé au spectateur : détecteur partagé + « faites/dites » et « ne … -ez » que le fichier partagé ne couvre pas. */
const IMPERATIF_NON_EZ = /^(?:faites|dites)\b|^(?:ne |n')[a-z]+ez\b/;
const aUnImperatif = (texte: string): boolean =>
  consignesImperatives(texte).length > 0 || phrasesDe(normaliser(texte)).some((p) => IMPERATIF_NON_EZ.test(p.replace(/^(?:un|une|deux|trois|quatre|cinq)\.\s+/, "")));

export function controlerEtapes(brut: ScriptTableau, options: { duree?: DureeScript } = {}): DefautScript[] {
  const s = normaliserScript(brut);
  const duree = options.duree ?? 60;
  const etapes = etapesDites(s);
  const n = etapes.length;
  const max = duree === 30 ? ETAPES_MAX_30S : ETAPES_MAX;
  if (n < ETAPES_MIN || n > max) return [{ code: "nombre-etapes", message: `${n} constat${n > 1 ? "s" : ""} « ce qui change » : ${ETAPES_MIN} à ${max} en ${duree} s (${ETAPES_PAR_DEFAUT} par défaut).`, eliminatoire: true }];
  const { motsMax, phrasesMax } = bornesEtape(duree);
  const d: DefautScript[] = [];
  etapes.forEach((e, i) => {
    const action = normaliser(e.action.dit);
    // Un vieux numéro dit (« Un. ») est ignoré pour juger la phrase ; il compte encore dans les mots de l'étape.
    const numerote = /^(?:un|une|deux|trois|quatre|cinq)\.\s+/.exec(action);
    const reste = numerote ? action.slice(numerote[0].length) : action;
    const impCommentaire = e.comment.find((p) => aUnImperatif(p.dit));
    if (aUnImperatif(e.action.dit)) {
      d.push({ code: "etape-imperatif", message: `Le constat ${i + 1} (« ${e.action.dit.trim()} ») est un ordre adressé au spectateur : dites ce qui change, à l'indicatif (« Le nom du client devient Client A. »), jamais un tutoriel.`, eliminatoire: true });
    } else if (impCommentaire) {
      d.push({ code: "etape-imperatif", message: `Le constat ${i + 1} contient un ordre adressé au spectateur (« ${impCommentaire.dit.trim()} ») : dites ce qui change, à l'indicatif, jamais un tutoriel.`, eliminatoire: true });
    } else if (compterMots(reste) < MOTS_ACTION_MIN || OUVERTURE_VAGUE.test(reste)) {
      d.push({ code: "etape-vague", message: `Le constat ${i + 1} est vague (« ${e.action.dit.trim()} ») : un sujet, un verbe et son objet (« Le nom du client devient Client A. »).`, eliminatoire: true });
    }
    const concretes = [...e.comment, ...(e.resultat ? [e.resultat] : [])].flatMap((p) => phrasesDe(p.dit));
    if (!concretes.length) d.push({ code: "etape-sans-comment", message: `Le constat ${i + 1} n'a pas de phrase concrète après l'action (le geste montré, un exemple de contenu).`, eliminatoire: true });
    if (concretes.length > phrasesMax) {
      d.push({ code: "etape-longue", message: `Le constat ${i + 1} dit ${concretes.length} phrases après l'action : ${phrasesMax} au plus (${n} constats en ${duree} s).`, eliminatoire: true });
    }
    const mots = compterMots(phrasesEtape(e).map((p) => p.dit).join(" ")) - (numerote ? 1 : 0);
    if (mots > motsMax) d.push({ code: "etape-longue", message: `Le constat ${i + 1} fait ${mots} mots : ${motsMax} au plus (${n} constats en ${duree} s).`, eliminatoire: true });
    // Constat numéroté à l'indicatif : le numéro dit n'est plus demandé (remarque, jamais éliminatoire).
    if (numerote && !d.some((x) => x.code === "etape-imperatif")) {
      d.push({ code: "etape-numero-dit", message: `Le constat ${i + 1} commence par un numéro dit (« ${e.action.dit.trim()} ») : il n'est plus demandé, dites directement ce qui change.`, eliminatoire: false });
    }
  });
  // Un tutoriel (plusieurs ordres de suite) de la douleur à l'exemple est éliminatoire, même si les constats sont propres.
  const corps = [...s.douleur, ...s.promesse, ...s.exemple.phrases].map((p) => p.dit).join(" ");
  if (tutoriel(corps) > 0) d.push({ code: "etape-imperatif", message: "Le texte de la douleur à l'exemple enchaîne des ordres adressés au spectateur : dites ce qui change, à l'indicatif, jamais un tutoriel.", eliminatoire: true });
  return d;
}

/** L'avant et l'après de l'exemple (REGLES § 3 : « Avant, … » puis « Maintenant, … »). */
const AVANT = /^(avant|jusqu'ici|au d[ée]part|la semaine derni[èe]re|hier)\b/;
const APRES = /^(maintenant|apr[èe]s|d[ée]sormais|aujourd'hui|cette fois|depuis)\b/;

export function controlerExemple(brut: ScriptTableau, demande: Pick<DemandeScriptTableau, "vraiCas">): DefautScript[] {
  const s = normaliserScript(brut);
  if (!s.exemple.phrases.some((p) => p.dit.trim())) return [{ code: "exemple-absent", message: "Aucun exemple déroulé : il faut un métier, une tâche, l'avant et l'après.", eliminatoire: true }];
  const d: DefautScript[] = [];
  if (!demande.vraiCas && normaliser(s.exemple.mentionEcran) !== normaliser(MENTION_ILLUSTRATIF)) {
    d.push({ code: "exemple-non-marque", message: `Aucun vrai cas n'a été fourni : l'exemple doit porter « ${MENTION_ILLUSTRATIF} » à l'écran.`, eliminatoire: true });
  }
  const phrases = s.exemple.phrases.flatMap((p) => phrasesDe(normaliser(p.dit)));
  if (!phrases.some((p) => AVANT.test(p)) || !phrases.some((p) => APRES.test(p))) {
    d.push({ code: "exemple-avant-apres", message: "L'exemple doit dire l'AVANT (une phrase qui commence par « Avant, ») puis l'APRÈS (« Maintenant, ») : la méthode appliquée.", eliminatoire: true });
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* 4. Une seule action demandée                                        */
/* ------------------------------------------------------------------ */

/** Familles d'appel à l'action (une seule famille permise dans tout le texte dit). */
export const ACTIONS: { famille: string; motif: RegExp }[] = [
  { famille: "commentaire", motif: /\bcommentez\b|\ben commentaires?\b|\bdans les commentaires\b/ },
  { famille: "diagnostic", motif: /\br[ée]servez\b|\bappel de diagnostic\b|\bprenez rendez-vous\b/ },
  { famille: "abonnement", motif: /\babonnez[- ]vous\b|\babonnez\b/ },
  { famille: "partage", motif: /\bpartagez\b/ },
  { famille: "mention", motif: /\blikez\b|\baimez (cette|la) vid[ée]o\b|\bmettez un (j'aime|like|pouce)\b/ },
  { famille: "enregistrement", motif: /\benregistrez (cette|la) vid[ée]o\b|\bsauvegardez\b/ },
  { famille: "suivre", motif: /\bsuivez[- ]moi\b|\bsuivez (le|ce) compte\b/ },
  { famille: "lien", motif: /\bcliquez\b|\blien (en|dans la) bio\b|\bt[ée]l[ée]chargez\b|\binscrivez[- ]vous\b/ },
];

/**
 * Indicatif, pas une demande (brouillon v-693abee466e1, 18/10) : « Au retour, vous relisez, corrigez une date, et vous
 * cliquez. » décrit un geste du corps. Le verbe d'action qui suit « vous » (éventuellement « vous vous », « vous le »…)
 * est retiré avant la recherche des familles ; l'impératif (« Cliquez », « Abonnez-vous ») reste compté. Même règle que
 * `INDICATIF` de `qualite-script/regles/prospects.ts`. Texte déjà passé par `normaliser`. Ne jamais appeler `.test()`
 * dessus (drapeau `g`) : seul `.replace` l'utilise.
 */
const INDICATIF_ACTION = /(^|[^\p{L}-])vous (?:vous |l'|la |le |les |y |en |nous )?(?:r[ée]servez|prenez rendez-vous|commentez|abonnez|partagez|likez|aimez|enregistrez|sauvegardez|suivez|cliquez|t[ée]l[ée]chargez|inscrivez)\b/gu;
export const sansIndicatifAction = (t: string): string => t.replace(INDICATIF_ACTION, "$1vous");

/**
 * Instagram seulement (décision de Will du 12/10/2026 ; base 7 de l'Usine, `fin-ig-mot-abonnement`) : « Abonnez-vous et
 * écrivez MOT en commentaire » compte pour UNE demande, l'abonnement y étant la condition du cadeau. Ailleurs, ou avec
 * un autre « abonnez-vous » dans le texte, ce sont deux demandes.
 */
const ABONNEMENT_ET_MOT = /\babonnez[- ]vous et écrivez [^.?!]*\ben commentaires?\b/g;

/** `reseau` : le réseau où la phrase sera dite, quand il est connu (absent : aucune exception de réseau). */
export function controlerAction(s: ScriptTableau, demande: Pick<DemandeScriptTableau, "fin">, options: { reseau?: IdReseau } = {}): DefautScript[] {
  const brut = sansIndicatifAction(normaliser(texteDitDe(s)));
  const texte = options.reseau === "instagram" ? brut.replace(ABONNEMENT_ET_MOT, "écrivez en commentaire") : brut;
  const familles = ACTIONS.filter((a) => a.motif.test(texte)).map((a) => a.famille);
  if (!familles.length) return [{ code: "action-absente", message: "Aucune action n'est demandée à la fin.", eliminatoire: true }];
  if (familles.length > 1) return [{ code: "actions-multiples", message: `Plusieurs actions demandées (${familles.join(", ")}) : une seule.`, eliminatoire: true }];
  const attendue = demande.fin.type;
  if (familles[0] !== attendue) return [{ code: "action-hors-demande", message: `L'action demandée est « ${familles[0]} » ; la demande prévoit « ${attendue} ».`, eliminatoire: true }];
  if (demande.fin.type === "commentaire") {
    const mot = normaliser(demande.fin.mot);
    const appel = normaliser(normaliserScript(s).appel.map((p) => p.dit).join(" "));
    if (!new RegExp(`(^|[^\\p{L}\\p{N}])${mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}\\p{N}]|$)`, "u").test(appel)) {
      return [{ code: "action-hors-demande", message: `Le mot à commenter « ${demande.fin.mot} » n'est pas dit dans l'appel.`, eliminatoire: true }];
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* 5. Clôture                                                          */
/* ------------------------------------------------------------------ */

export function controlerCloture(s: ScriptTableau): DefautScript[] {
  const derniere = phrasesDe(normaliserScript(s).appel.map((p) => p.dit).join(" ")).at(-1) ?? "";
  const d: DefautScript[] = [];
  const n = compterMots(derniere);
  if (n < 2 || n > 5) d.push({ code: "cloture-longueur", message: `La dernière phrase fait ${n} mot${n > 1 ? "s" : ""} (2 à 5) : « ${derniere} »`, eliminatoire: true });
  if (derniere.includes("?")) d.push({ code: "cloture-question", message: `La dernière phrase est une question : elle doit affirmer et fermer (« ${derniere} »).`, eliminatoire: true });
  if (derniere.includes(",")) d.push({ code: "cloture-virgule", message: `La dernière phrase contient une virgule : elle sonne coupée (« ${derniere} »).`, eliminatoire: true });
  return d;
}

/* ------------------------------------------------------------------ */
/* 6. Durée                                                            */
/* ------------------------------------------------------------------ */

/** Écart de durée toléré (part de la borne dépassée) : en dessous, une remarque ; au-delà, un défaut éliminatoire. */
export const TOLERANCE_DUREE = 0.1;

/**
 * Durée dans la fourchette du réseau. Un écart de moins de 10 % de la borne dépassée est une REMARQUE (non
 * éliminatoire), SAUF au-delà du plafond du découpage (`DUREE_MAX_TABLEAU_SEC`) : là, toujours un défaut, pour qu'un
 * script accepté ici ne soit jamais refusé pour sa durée au découpage. `eliminatoire: false` force la remarque
 * (variantes par réseau, non affichées). Comparaisons sur la durée NON arrondie (celle que les règles calculent).
 */
export function controlerDuree(texteDit: string, reseau: DemandeScriptTableau["reseau"], quoi = "Le script", eliminatoire = true, bornes?: { dureeMin: number; dureeMax: number }): DefautScript[] {
  const { dureeMin, dureeMax } = bornes ?? RESEAUX_SCRIPT_INFOS[reseau];
  const libelle = bornes ? "une vidéo de 30 s" : RESEAUX_SCRIPT_INFOS[reseau].libelle;
  const duree = dureeDiteBrute(texteDit);
  const n = caracteresDits(texteDit);
  // Le plafond se juge sur les caractères (constante figée), pas sur la durée flottante : 1 520 passe, 1 521 est refusé.
  const auDela = n > CARACTERES_DITS_MAX_TABLEAU;
  if (!auDela && duree >= dureeMin && duree <= dureeMax) return [];
  const ecart = duree < dureeMin ? (dureeMin - duree) / dureeMin : (duree - dureeMax) / dureeMax;
  const leger = ecart < TOLERANCE_DUREE && !auDela;
  const quoiFaire =
    duree < dureeMin
      ? `allongez le texte dit d'environ ${caracteresEn(dureeMin) - n + 1} caractères`
      : `raccourcissez le texte dit d'environ ${n - caracteresEn(dureeMax)} caractères`;
  const plafond = auDela ? ` (plafond de ${DUREE_MAX_TABLEAU_SEC} s du tableau dépassé, ${CARACTERES_DITS_MAX_TABLEAU} caractères dits au plus)` : "";
  return [
    {
      code: "duree-reseau",
      message: `${quoi} dure environ ${Math.round(duree)} s (${n} caractères dits, ${String(CARACTERES_PAR_SECONDE_TABLEAU).replace(".", ",")} par seconde) : ${dureeMin} à ${dureeMax} s pour ${libelle}${plafond}${leger ? " (écart de moins de 10 % : remarque)" : ""} ; ${quoiFaire}.`,
      eliminatoire: eliminatoire && !leger,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* 6 bis. Mots de la douleur                                           */
/* ------------------------------------------------------------------ */

/**
 * Les 2 à 4 mots de la douleur rendus par le générateur : présents mot pour mot dans l'accroche dite, l'un d'eux dans les
 * 3 premières secondes (ce sont eux que les règles du découpage cherchent au début de la vidéo).
 */
export function controlerMotsDouleur(e: Pick<EcritureScript, "script"> & { motsDouleur?: readonly string[] }): DefautScript[] {
  const accroche = normaliserScript(e.script).accroche.map((p) => p.dit.trim()).filter(Boolean).join(" ");
  return defautsMotsDouleur(e.motsDouleur ?? [], accroche).map((message) => ({ code: "mots-douleur" as const, message, eliminatoire: true }));
}

/* ------------------------------------------------------------------ */
/* 7. Mots interdits                                                   */
/* ------------------------------------------------------------------ */

/** Mots interdits dans le texte dit, partout, fin comprise (REGLES § 2 bis, § 4, § 7). */
export const MOTS_INTERDITS: { motif: RegExp; libelle: string }[] = [
  // La voix ne prononce jamais l'adresse du site (signature à l'image seulement), même dans la phrase de fin.
  { motif: /axion-?ia\.com|\bpoint com\b|\.com\b/, libelle: "l'adresse du site (elle est à l'image, la voix ne la dit pas)" },
  { motif: /\bnotre formation\b/, libelle: "« notre formation »" },
  { motif: /\bnos formations\b/, libelle: "« nos formations »" },
  { motif: /\bnotre [ée]quipe\b/, libelle: "« notre équipe »" },
  { motif: /\bnos clients\b/, libelle: "« nos clients »" },
  { motif: /\bcontactez[- ]nous\b/, libelle: "« contactez-nous »" },
  { motif: /\bvilleexemple\b/, libelle: "« Villeexemple »" },
  { motif: /\baucun gain garanti\b/, libelle: "« aucun gain garanti »" },
  { motif: /€|\beuros?\b|\bprix\b|\btarifs?\b|\bhors taxes?\b|\bht\b|\bttc\b/, libelle: "un prix" },
  { motif: /\bdemain\b/, libelle: "« demain »" },
  { motif: /\boptimis\p{L}*/u, libelle: "le mot vague « optimiser »" },
  { motif: /\bboost\p{L}*/u, libelle: "le mot vague « booster »" },
  { motif: /\br[ée]volution\p{L}*/u, libelle: "le mot vague « révolutionner »" },
  { motif: /(^|[^\p{L}])(tu|toi|ton|ta|tes|te)(?![\p{L}'])|(^|[^\p{L}])t'/u, libelle: "le tutoiement" },
];

/** Mots interdits trouvés dans un texte dit (libellés, sans doublon). */
export function motsInterditsDans(texteDit: string): string[] {
  const t = normaliser(texteDit);
  return [...new Set(MOTS_INTERDITS.filter((m) => m.motif.test(t)).map((m) => m.libelle))];
}

export function controlerMotsInterdits(texteDit: string, quoi = "Le texte dit"): DefautScript[] {
  return motsInterditsDans(texteDit).map((l) => ({ code: "mot-interdit" as const, message: `${quoi} contient ${l}.`, eliminatoire: true }));
}

/* ------------------------------------------------------------------ */
/* 7 bis. L'entreprise : un peu, à la fin (Will, 14/10)                */
/* ------------------------------------------------------------------ */

/** Le nom de l'entreprise. */
export const NOM_ENTREPRISE = /\baxion\b|axion-ia|axionia/;
/** Une phrase sur l'entreprise : son nom, ou le « nous » de l'entreprise (nous, notre, nos). */
const SUR_L_ENTREPRISE = new RegExp(`${NOM_ENTREPRISE.source}|\\bnous\\b|\\bnotre\\b|\\bnos\\b`);
/** Longueur maximale de la phrase de fin sur l'entreprise. */
export const MOTS_MAX_PHRASE_ENTREPRISE = 15;
/** Une promesse chiffrée : un chiffre, un pourcentage, un nombre en lettres à partir de deux. */
const CHIFFRE_PROMIS = /\d|%|\b(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|quarante|cinquante|soixante|cent|mille|double|triple|moitié)\b/;
const estUneAction = (phrase: string) => {
  const p = sansIndicatifAction(phrase);
  return ACTIONS.some((a) => a.motif.test(p));
};

/**
 * REGLES § 2 bis (Will, 14/10 : « un peu, à la fin ») : le corps ne parle jamais de l'entreprise ; la fin peut porter AU
 * PLUS UNE phrase courte sur elle (15 mots au plus, sans chiffre), dite JUSTE AVANT la demande de fin. Les prix et
 * l'adresse du site restent refusés partout (`MOTS_INTERDITS`). `debutFin` : rang de la première phrase de la fin.
 */
function defautsEntreprise(phrases: readonly string[], debutFin: number, quoi: string): DefautScript[] {
  const n = phrases.map(normaliser);
  const demande = n.findIndex((p, i) => i >= debutFin && estUneAction(p));
  const d: DefautScript[] = [];
  const sur = n.map((_, i) => i).filter((i) => SUR_L_ENTREPRISE.test(n[i]));
  for (const i of sur.filter((i) => i < debutFin)) {
    d.push({ code: "entreprise-corps", message: `${quoi} parle de l'entreprise hors de la fin (« ${phrases[i]} ») : le corps reste neutre ; une seule phrase courte est permise, juste avant la demande de fin.`, eliminatoire: true });
  }
  const fin = sur.filter((i) => i >= debutFin);
  if (fin.length > 1) d.push({ code: "entreprise-fin", message: `${quoi} parle ${fin.length} fois de l'entreprise à la fin : une seule phrase courte, juste avant la demande.`, eliminatoire: true });
  for (const i of fin) {
    if (i !== demande - 1) d.push({ code: "entreprise-fin", message: `La phrase sur l'entreprise (« ${phrases[i]} ») doit être dite juste avant la demande de fin, à part.`, eliminatoire: true });
    const mots = compterMots(phrases[i]);
    if (mots > MOTS_MAX_PHRASE_ENTREPRISE) d.push({ code: "entreprise-fin", message: `La phrase sur l'entreprise fait ${mots} mots (${MOTS_MAX_PHRASE_ENTREPRISE} au plus) : « ${phrases[i]} »`, eliminatoire: true });
    if (CHIFFRE_PROMIS.test(n[i])) d.push({ code: "entreprise-fin", message: `La phrase sur l'entreprise contient un chiffre (aucune promesse chiffrée) : « ${phrases[i]} »`, eliminatoire: true });
  }
  return d;
}

/** Le script principal : la fin, ce sont les phrases de l'appel. */
export function controlerEntreprise(s: ScriptTableau): DefautScript[] {
  const toutes = phrasesDe(texteDitDe(s));
  const fin = phrasesDe(normaliserScript(s).appel.map((p) => p.dit.trim()).filter(Boolean).join(" "));
  return defautsEntreprise(toutes, toutes.length - fin.length, "Le script");
}

/** Une variante (texte dit d'un bloc) : la fin commence à la phrase qui précède la première demande. */
export function controlerEntrepriseTexte(texteDit: string, quoi: string): DefautScript[] {
  const phrases = phrasesDe(texteDit);
  const demande = phrases.findIndex((p) => estUneAction(normaliser(p)));
  return defautsEntreprise(phrases, demande < 0 ? phrases.length : Math.max(0, demande - 1), quoi);
}

/* ------------------------------------------------------------------ */
/* 8. Chiffres statistiques                                            */
/* ------------------------------------------------------------------ */

const NOMBRE = "(?:\\d+(?:[.,]\\d+)?|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|quarante|cinquante|soixante|cent|mille)";
/** Formes d'un chiffre STATISTIQUE (part, pourcentage, rapport, moyenne, grandes quantités). */
const STATISTIQUES: RegExp[] = [
  /\d+(?:[.,]\d+)?\s?%/,
  new RegExp(`${NOMBRE}\\s+pour\\s?cent`),
  new RegExp(`\\b${NOMBRE}\\s+(?:\\p{L}+\\s+)?sur\\s+${NOMBRE}\\b`, "u"),
  new RegExp(`\\b${NOMBRE}\\s+fois\\s+(?:plus|moins)\\b`),
  /\b(?:la moitié|un tiers|deux tiers|un quart|trois quarts|la majorité|la plupart) des\b/,
  /\ben moyenne\b/,
  new RegExp(`\\b${NOMBRE}\\s+(?:millions?|milliards?)\\b`),
  /\b(?:selon|d'après) (?:une|une étude|les études|un sondage|l'insee)\b|\bune étude\b|\bun sondage\b/,
];

/** Morceaux statistiques d'un texte (en minuscules normalisées). */
export function chiffresStatistiques(texteDit: string): string[] {
  const t = normaliser(texteDit);
  const trouves: string[] = [];
  for (const ph of phrasesDe(t)) if (STATISTIQUES.some((r) => r.test(ph))) trouves.push(ph);
  return trouves;
}

/** Une phrase statistique est couverte si une source déclarée, non vide, cite un extrait présent dans la phrase. */
export function controlerChiffres(texteDit: string, sources: readonly SourceChiffre[]): DefautScript[] {
  const valides = sources.filter((s) => s.source.trim() && s.extrait.trim()).map((s) => normaliser(s.extrait));
  return chiffresStatistiques(texteDit)
    .filter((ph) => !valides.some((e) => ph.includes(e)))
    .map((ph) => ({ code: "chiffre-sans-source" as const, message: `Chiffre sans source déclarée : « ${ph} »`, eliminatoire: true }));
}

/* ------------------------------------------------------------------ */
/* 9. Organisation (REGLES § 3 bis)                                    */
/* ------------------------------------------------------------------ */

/** La douleur est posée tôt : accroche et douleur dites en 15 s au plus. */
export const DOULEUR_FIN_MAX_SEC = 15;
/** « Problème » et « retournement » ne sont jamais dits ni écrits (Will, 14/10 : « c'est une douleur et une solution »). */
const LIBELLE_PROBLEME = /\bprobl[èe]mes?\b|\bretournement\b/;

/** Phrases de la promesse au plus : la promesse, puis la boucle ouverte (« Le troisième se cache… »). */
export const PROMESSE_PHRASES_MAX = 2;

/**
 * Chaque phrase appartient à son passage, dans l'ordre fixe, sans rien répéter : tous les passages sont là ; la promesse
 * tient en deux phrases au plus (la promesse, la boucle ouverte), « à retenir » en une ; accroche et douleur sont dites
 * en 15 s au plus ; aucune phrase n'est dite deux fois ; « à retenir » ne redit pas la clôture ; jamais « problème ».
 */
export function controlerOrganisation(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const d: DefautScript[] = [];
  const dit = (ph: readonly { dit: string }[]) => ph.map((p) => p.dit.trim()).filter(Boolean).join(" ");
  const parties: [string, string][] = [
    ["l'accroche", dit(s.accroche)],
    ["la douleur", dit(s.douleur)],
    ["la promesse (le gain et le nombre d'étapes)", dit(s.promesse)],
    ["l'exemple", dit(s.exemple.phrases)],
    ["« à retenir »", dit(s.aRetenir)],
    ["l'appel", dit(s.appel)],
  ];
  for (const [nom, t] of parties) if (!t) d.push({ code: "partie-vide", message: `Il manque ${nom} : chaque partie est dite, dans l'ordre fixe.`, eliminatoire: true });
  const nPromesse = phrasesDe(dit(s.promesse)).length;
  if (nPromesse > PROMESSE_PHRASES_MAX) d.push({ code: "promesse-longue", message: `La promesse tient en ${nPromesse} phrases : ${PROMESSE_PHRASES_MAX} au plus (la promesse, puis la boucle ouverte).`, eliminatoire: true });
  const retenir = dit(s.aRetenir);
  const nRetenir = phrasesDe(retenir).length;
  if (nRetenir > 1) d.push({ code: "a-retenir-long", message: `« À retenir » tient en ${nRetenir} phrases : l'idée, en une seule phrase.`, eliminatoire: true });
  const debut = caracteresDits(`${dit(s.accroche)} ${dit(s.douleur)}`.trim());
  if (debut > caracteresEn(DOULEUR_FIN_MAX_SEC)) {
    d.push({ code: "douleur-tardive", message: `L'accroche et la douleur durent environ ${Math.round(debut / CARACTERES_PAR_SECONDE_TABLEAU)} s : la douleur est posée en ${DOULEUR_FIN_MAX_SEC} s au plus, la solution vient vite.`, eliminatoire: true });
  }
  const vues = new Map<string, string>();
  for (const ph of phrasesDe(texteDitDe(s))) {
    const cle = normaliser(ph).replace(/[^\p{L}\p{N} ]/gu, "").trim();
    if (compterMots(cle) < 2) continue;
    if (vues.has(cle)) d.push({ code: "repetition", message: `Phrase dite deux fois : « ${ph} ». Rien ne se répète.`, eliminatoire: true });
    else vues.set(cle, ph);
  }
  const cloture = phrasesDe(dit(s.appel)).at(-1);
  if (cloture && retenir) {
    const c = normaliser(cloture).replace(/[^\p{L}\p{N} ]/gu, "").trim();
    const r = normaliser(retenir).replace(/[^\p{L}\p{N} ]/gu, "").trim();
    if (c && (r.includes(c) || c.includes(r))) d.push({ code: "repetition", message: `« À retenir » redit la clôture (« ${cloture} ») : la fin ne tourne pas en rond.`, eliminatoire: true });
  }
  for (const p of phrasesDites(s)) {
    for (const t of [p.dit, p.ecran]) {
      if (LIBELLE_PROBLEME.test(normaliser(t))) {
        d.push({ code: "libelle-probleme", message: `« ${t.trim()} » parle de « problème » : on dit la douleur, puis la solution (jamais « le vrai problème », jamais de retournement).`, eliminatoire: true });
        break;
      }
    }
  }
  if (LIBELLE_PROBLEME.test(normaliser(s.exemple.mentionEcran))) d.push({ code: "libelle-probleme", message: "La mention de l'exemple parle de « problème ».", eliminatoire: true });
  return d;
}

/* ------------------------------------------------------------------ */
/* 10. Vérité (REGLES § 3 ter, éliminatoire)                           */
/* ------------------------------------------------------------------ */

/**
 * Affirmations absolues TOUJOURS refusées : invérifiables ou fausses par nature (« Rien de privé n'est sorti » : l'adresse
 * ou un détail peut rester ; « aucun risque », « 100 % sûr », « conforme au RGPD », « illégal »…).
 */
export const AFFIRMATIONS_ABSOLUES: { motif: RegExp; libelle: string }[] = [
  { motif: /\brien (?:de \p{L}+ )?n'(?:est|a été) (?:sorti|parti|transmis|partagé|divulgué)/u, libelle: "« rien n'est sorti » (invérifiable : un détail peut rester)" },
  { motif: /\brien ne (?:sort|fuit|part|filtre)\b/, libelle: "« rien ne sort » (invérifiable)" },
  { motif: /\baucune? (?:fuite|risque)s?\b|\bz[ée]ro (?:fuite|risque)|\brisque z[ée]ro\b|\bsans (?:aucun )?risque\b/, libelle: "« aucun risque » (invérifiable)" },
  { motif: /\b100 ?%|\bcent pour cent\b/, libelle: "« 100 % » (absolu)" },
  { motif: /\b(?:totalement|compl[èe]tement|parfaitement|enti[èe]rement) (?:s[ûu]rs?e?s?|s[ée]curis\p{L}*|anonym\p{L}*|prot[ée]g\p{L}*|conformes?|l[ée]gal\p{L}*)/u, libelle: "une sécurité ou une conformité totale (absolu)" },
  { motif: /\ben toute s[ée]curit[ée](?!\p{L})/u, libelle: "« en toute sécurité » (absolu)" },
  { motif: /\bgaranti(?:e|s|es)?\b/, libelle: "une garantie" },
  { motif: /\bconformes? (?:au |à la |avec le )?rgpd\b|\brgpd[- ]compliant\b/, libelle: "« conforme au RGPD » (fait juridique non établi)" },
  { motif: /\bill[ée]ga(?:l|le|ux|les)\b|\bhors la loi\b|\binterdit par la loi\b|\bla loi (?:interdit|oblige|impose)\b|\ben infraction\b/, libelle: "un fait juridique tranché (illégal, la loi interdit…)" },
  { motif: /\bplus jamais\b/, libelle: "« plus jamais » (promesse invérifiable)" },
];

/**
 * Mots qui font d'une phrase une affirmation à JUSTIFIER (absolus, juridiques, sécurité) : la phrase doit être couverte
 * par une entrée de `affirmations` (extrait présent dans la phrase, nature, pourquoi). « Rouge, jamais. » est une
 * consigne : elle se justifie aussi (pourquoi c'est sûr).
 */
const A_JUSTIFIER = /\b(?:jamais|toujours|rien|aucun|aucune|personne ne|tout le monde|forc[ée]ment|obligatoire\p{L}*|interdit\p{L}*|l[ée]gal\p{L}*|loi|rgpd|cnil|amendes?|sanctions?|s[ée]curis\p{L}*|anonym\p{L}*|confidenti\p{L}*|conformes?)\b/u;
/** Longueur minimale d'une justification (« pourquoi ») : une vraie raison, pas « vrai ». */
const POURQUOI_MIN = 12;

/** Phrases dites qui portent un mot absolu ou juridique (en clair), pour la relecture et les contrôles. */
export function phrasesAJustifier(texteDit: string): string[] {
  return phrasesDe(texteDit).filter((ph) => A_JUSTIFIER.test(normaliser(ph)));
}

/**
 * REGLES § 3 ter (éliminatoire) : aucune affirmation absolue refusée ; chaque phrase qui porte un mot absolu ou
 * juridique est couverte par une affirmation relevée, avec sa justification.
 */
export function controlerVerite(texteDit: string, affirmations: readonly AffirmationScript[] | undefined, quoi = "Le texte dit"): DefautScript[] {
  const d: DefautScript[] = [];
  const t = normaliser(texteDit);
  for (const a of AFFIRMATIONS_ABSOLUES) if (a.motif.test(t)) d.push({ code: "affirmation-absolue", message: `${quoi} contient ${a.libelle} : dites ce qui est vrai et vérifiable.`, eliminatoire: true });
  const valides = (affirmations ?? []).filter((a) => a.extrait.trim() && a.pourquoi.trim().length >= POURQUOI_MIN).map((a) => normaliser(a.extrait).replace(/[.!?…]+$/, ""));
  for (const ph of phrasesAJustifier(texteDit)) {
    const n = normaliser(ph);
    if (!valides.some((e) => e && (n.includes(e) || e.includes(n.replace(/[.!?…]+$/, ""))))) {
      d.push({ code: "affirmation-non-verifiee", message: `Affirmation non justifiée : « ${ph} ». Relevez-la dans « affirmations » avec pourquoi elle est vraie (ou sûre), sinon réécrivez-la.`, eliminatoire: true });
    }
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* 11. Gabarit cadré (REGLES § 3 quater, 15/10) : une idée, un gain, une preuve */
/* ------------------------------------------------------------------ */

/** Mots totaux du script, selon la durée visée (REGLES § 3). */
export const MOTS_SCRIPT: Record<DureeScript, { min: number; max: number }> = { 60: { min: 125, max: 145 }, 30: { min: 75, max: 95 } };

/** Les passages bornés (les étapes ont leur propre borne, `bornesEtape`). « fin » : à retenir et appel. */
export type PassageBorne = "accroche" | "douleur" | "promesse" | "exemple" | "fin";

/**
 * Bornes de mots de chaque passage : le REPÈRE du gabarit validé (ce que l'écriture vise, un GUIDE) et le REFUS (la limite
 * dure : au-delà, le script est refusé). Entre le repère et la limite dure, un passage ne donne qu'une REMARQUE non
 * éliminatoire ; le seul plafond éliminatoire sur la longueur est le total de mots du script (`MOTS_SCRIPT`, décision de
 * Will : 125 à 145 mots en 60 s). 5e passe B2a (19/10) : les milieux des cinq repères (84 mots) + 3 constats de 17 mots
 * (milieu de `REPERE_CONSTAT`, 51 mots) font 135 mots, le milieu de 125 à 145 ; voix à 165 mots/min. Le témoin v5 (10 / 25 / 15 /
 * 22 / 23 mots, constats de 18 / 15 / 16) est DANS chaque repère.
 */
export const BORNES_PASSAGES: Record<DureeScript, Record<PassageBorne, { repere: [number, number]; refus: [number, number] }>> = {
  60: {
    accroche: { repere: [7, 10], refus: [5, 12] },
    douleur: { repere: [19, 25], refus: [13, 30] },
    promesse: { repere: [10, 15], refus: [7, 17] },
    exemple: { repere: [18, 24], refus: [14, 33] },
    fin: { repere: [17, 23], refus: [9, 27] },
  },
  30: {
    accroche: { repere: [7, 10], refus: [5, 12] },
    douleur: { repere: [10, 15], refus: [8, 18] },
    promesse: { repere: [7, 12], refus: [5, 14] },
    exemple: { repere: [14, 20], refus: [10, 24] },
    fin: { repere: [9, 14], refus: [7, 17] },
  },
};
/** Repère de mots d'un constat « ce qui change » (milieu 17 en 60 s) : un guide ; la limite dure reste `bornesEtape` (28 mots). */
export const REPERE_CONSTAT: Record<DureeScript, [number, number]> = { 60: [14, 20], 30: [7, 11] };
/**
 * Repère d'un constat quand le script n'en a que 2 (6e passe) : avec les milieux des cinq repères (84 mots), 2 × 17 mots font
 * 118, sous les 125 mots du script ; 2 × 21 en font 126, soit 1 mot de marge seulement (passages au milieu et 2 constats de 20
 * mots : 124, refusé). Avec 2 constats on vise donc le haut des repères de CHAQUE passage (97 mots) ET 20 à 22 mots par constat :
 * 97 + 2 × 21 = 139, dans 125 à 145 avec de la marge ; ne pas monter au-delà de 22 (au-delà, la scène est coupée).
 */
export const REPERE_CONSTAT_A_2: Record<DureeScript, [number, number]> = { 60: [20, 22], 30: [10, 13] };
/** Repère de mots d'un constat selon le nombre de constats du script (2 : le haut ; 3 : le repère courant). */
export const repereConstats = (duree: DureeScript, nombre: number): [number, number] => (nombre === 2 ? REPERE_CONSTAT_A_2[duree] : REPERE_CONSTAT[duree]);
const NOMS_PASSAGES: Record<PassageBorne, string> = { accroche: "L'accroche", douleur: "La douleur", promesse: "La promesse", exemple: "L'exemple", fin: "La fin (à retenir et appel)" };

const ditDe = (ph: readonly { dit: string }[]) => ph.map((p) => p.dit.trim()).filter(Boolean).join(" ");

/** Mots dits de chaque passage et de chaque constat, hors question sur l'IA (imposée, non comptée dans les bornes). */
export function motsParPassage(brut: ScriptTableau): Record<PassageBorne, number> & { constats: number[] } {
  const n0 = normaliserScript(brut);
  const s = { ...n0, appel: n0.appel.filter((p) => !estQuestionIa(p.dit)) };
  return {
    accroche: compterMots(ditDe(s.accroche)),
    douleur: compterMots(ditDe(s.douleur)),
    promesse: compterMots(ditDe(s.promesse)),
    exemple: compterMots(ditDe(s.exemple.phrases)),
    fin: compterMots(`${ditDe(s.aRetenir)} ${ditDe(s.appel)}`),
    constats: etapesDites(s).map((e) => compterMots(phrasesEtape(e).map((p) => p.dit).join(" "))),
  };
}

/**
 * Bornes de mots : le script entier (125 à 145 en 60 s, 75 à 95 en 30 s) est LE plafond éliminatoire ; chaque passage
 * n'est refusé qu'à sa limite dure (`refus`), et un passage ou un constat hors de son repère, sous cette limite, n'est
 * qu'une remarque. La question sur l'IA, imposée (18/10), n'y est pas comptée : les bornes du rédacteur ne bougent pas,
 * la fin garde sa place.
 */
export function controlerMots(brut: ScriptTableau, options: { duree?: DureeScript } = {}): DefautScript[] {
  const duree = options.duree ?? 60;
  const d: DefautScript[] = [];
  const m = motsParPassage(brut);
  const total = [m.accroche, m.douleur, m.promesse, m.exemple, m.fin, ...m.constats].reduce((t, n) => t + n, 0);
  const { min, max } = MOTS_SCRIPT[duree];
  if (total < min || total > max) d.push({ code: "script-mots", message: `Le script fait ${total} mots : ${min} à ${max} pour une vidéo de ${duree} s.`, eliminatoire: true });
  for (const p of Object.keys(NOMS_PASSAGES) as PassageBorne[]) {
    const n = m[p];
    if (!n) continue;
    const { repere, refus } = BORNES_PASSAGES[duree][p];
    if (n < refus[0] || n > refus[1]) d.push({ code: "passage-mots", message: `${NOMS_PASSAGES[p]} fait ${n} mots : ${repere[0]} à ${repere[1]} visés (refus sous ${refus[0]} ou au-delà de ${refus[1]}).`, eliminatoire: true });
    else if (n < repere[0] || n > repere[1]) d.push({ code: "passage-mots", message: `${NOMS_PASSAGES[p]} fait ${n} mots : ${repere[0]} à ${repere[1]} visés (remarque : le repère est un guide, seul le total de ${min} à ${max} mots refuse).`, eliminatoire: false });
  }
  const [rmin, rmax] = repereConstats(duree, m.constats.length);
  m.constats.forEach((n, i) => {
    if (n < rmin || n > rmax) d.push({ code: "passage-mots", message: `Le constat ${i + 1} fait ${n} mots : ${rmin} à ${rmax} visés (remarque : le repère est un guide, ${bornesEtape(duree).motsMax} au plus).`, eliminatoire: false });
  });
  return d;
}

/** Nombres dits en lettres (2 à 10). */
const CARDINAUX: Record<string, number> = { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };

/**
 * Ce que la promesse ne dit plus : un NOMBRE D'ÉTAPES (« Trois réflexes à prendre », « Cinq gestes »). Depuis le lot B1
 * (décision D1 de Will, 18/10), la promesse dit le gain pour le spectateur, sans annoncer de plan : c'est le plan d'un
 * tutoriel. Un nombre qui compte autre chose (« trois lignes », « dix minutes ») n'est pas relevé.
 */
const NOMBRE_D_ETAPES = /(?<![\p{L}\p{N}])(?:\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:[\p{L}]+\s+)?(?:[ée]tapes?|r[ée]flexes?|gestes?|conseils?|astuces?|r[èe]gles?|r[ée]glages?|points?|erreurs?)(?![\p{L}])/u;

/** La promesse n'annonce PAS un nombre d'étapes (lot B1) : une REMARQUE, jamais éliminatoire. */
export function controlerPromesse(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const promesse = ditDe(s.promesse);
  if (!promesse) return [];
  const m = NOMBRE_D_ETAPES.exec(normaliser(promesse));
  if (!m) return [];
  return [{ code: "promesse-nombre", message: `La promesse annonce un nombre d'étapes (« ${m[0]} ») : dites le gain pour le spectateur, sans annoncer de plan (ce serait un tutoriel).`, eliminatoire: false }];
}

/** Mots sans poids pour comparer deux textes (articles, pronoms, mots d'enchaînement). */
const MOTS_VIDES = new Set(
  "avant apres maintenant votre vos vous avec sans pour dans tout toute tous toutes plus moins cette ces cet comme elle elles ils leur leurs lui sont etre avoir fait faire chaque aussi mais donc alors encore deja entre sous vers chez quand celui celle ceux rien meme autre autres depuis toujours jamais puis voici voila ainsi tres peut doit bien seulement souvent quoi dont parce".split(" "),
);
const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Racines des mots qui portent le sens (4 lettres au moins, hors mots vides), sur les 5 premières lettres. */
export function racines(t: string): string[] {
  return sansAccents(normaliser(t))
    .replace(/\b[ldjmtsnc]'|\bqu'/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length >= 4 && !MOTS_VIDES.has(m))
    .map((m) => m.slice(0, 5));
}
const partagent = (a: string, b: string) => {
  const rb = new Set(racines(b));
  return racines(a).filter((r) => rb.has(r));
};

/** Mots simples d'un texte (minuscules, sans accents) : pour les unités courtes (« min », « h », « km »). */
const motsSimples = (t: string) => sansAccents(normaliser(t)).split(/[^a-z0-9]+/).filter(Boolean);
/** Vrai si l'unité est dite dans le texte : le mot tel quel (unité courte), ou sa racine (« lignes » / « ligne »). */
const uniteDans = (unite: string, texte: string) => {
  const u = sansAccents(normaliser(unite));
  const ru = racines(unite)[0];
  return motsSimples(texte).includes(u) || (!!ru && racines(texte).includes(ru));
};

/** Le gain : non vide, avec son unité (un mot de la formule), annoncé par la promesse, visible dans l'exemple. */
export function controlerGain(e: Pick<EcritureScript, "script"> & { gain?: EcritureScript["gain"] }): DefautScript[] {
  const s = normaliserScript(e.script);
  const formule = e.gain?.formule.trim() ?? "";
  const unite = e.gain?.unite.trim() ?? "";
  if (!formule || !unite) return [{ code: "gain-absent", message: "Le gain n'est pas dit : une formule courte et son unité (« Six lignes collées au lieu du fil », unité « lignes »).", eliminatoire: true }];
  if (!uniteDans(unite, formule)) return [{ code: "gain-absent", message: `L'unité du gain (« ${unite} ») n'est pas un mot de sa formule (« ${formule} »).`, eliminatoire: true }];
  const d: DefautScript[] = [];
  if (!partagent(formule, ditDe(s.promesse)).length) d.push({ code: "gain-hors-promesse", message: `La promesse n'annonce pas le gain (« ${formule} ») : elle en reprend au moins un mot.`, eliminatoire: true });
  if (!uniteDans(unite, ditDe(s.exemple.phrases))) d.push({ code: "gain-hors-exemple", message: `L'exemple ne montre pas le gain : son unité (« ${unite} ») n'y est pas dite. L'exemple tient la promesse.`, eliminatoire: true });
  return d;
}

/** Une liste de verbes : au moins trois morceaux séparés par des virgules, ouverts par un verbe à l'impératif. */
const IMPERATIF = /^[\p{L}-]+ez$/u;

/** « À retenir » = l'idée, en UNE phrase : jamais une liste de verbes ni la liste des étapes. */
export function controlerARetenir(e: Pick<EcritureScript, "script"> & { idee?: string }): DefautScript[] {
  const s = normaliserScript(e.script);
  const retenir = ditDe(s.aRetenir);
  const d: DefautScript[] = [];
  const idee = e.idee?.trim() ?? "";
  if (!idee) d.push({ code: "idee-absente", message: "L'idée du script n'est pas dite (« idee » : une phrase) : un script porte UNE idée.", eliminatoire: true });
  if (!retenir) return d;
  const corps = normaliser(retenir).replace(/^à retenir\s*:\s*/, "");
  const morceaux = corps.split(/[,;]/).map((x) => x.trim().replace(/^(et|puis)\s+/, "")).filter(Boolean);
  const verbesEtapes = etapesDites(s).map((x) => normaliser(x.action.dit).replace(/^[\p{L}]+\.\s+/u, "").split(/\s+/)[0]).filter((v) => v && IMPERATIF.test(v));
  const verbesRepris = verbesEtapes.filter((v) => new RegExp(`(^|[^\\p{L}])${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(corps));
  if (morceaux.filter((x) => IMPERATIF.test(x.split(/\s+/)[0])).length >= 3 || verbesRepris.length >= 2) {
    d.push({ code: "a-retenir-liste", message: `« À retenir » est une liste de verbes (« ${retenir} ») : dites l'idée en une phrase.`, eliminatoire: true });
  }
  if (idee && !partagent(idee, retenir).length) d.push({ code: "idee-absente", message: `« À retenir » (« ${retenir} ») ne dit pas l'idée du script (« ${idee} »).`, eliminatoire: true });
  return d;
}

/**
 * Ce que le spectateur fait SEUL (« formez-les vous-même », « faites-le seul ») : l'entreprise ne peut pas promettre de
 * le faire à sa place. « Seul » ne compte qu'en fin de groupe (« faites-le seul. », « seuls, ») ou dans « tout seul » ;
 * jamais après un déterminant ou une négation séparés par une espace (« un seul de ces réflexes », « une seule
 * habitude », « vous n'êtes pas seul »), ni en tête de phrase (« Seul, vous perdez une heure. »). Le pronom accroché
 * par un trait d'union (« faites-le seul ») compte.
 */
const FAIT_SEUL = /\bvous-m[êe]mes?\b|(?:^|[^\p{L}])tou(?:t|te|s|tes) seul(?:e|s|es)?(?![\p{L}])|(?<=[^\p{L}])(?<!(?:^|\s)(?:un|une|le|la|les|pas|plus)\s)seul(?:e|s|es)?\s*(?:[,.;:!?]|$)|\bsans (?:aide|personne|prestataire)\b/u;

/**
 * La phrase sur l'entreprise (facultative) est liée à l'idée (elle reprend un mot de l'idée, de la promesse ou des
 * étapes) et ne contredit pas le corps : pas « formez-les vous-même » puis « Axion forme les équipes ».
 */
export function controlerPhraseEntreprise(e: Pick<EcritureScript, "script"> & { idee?: string }): DefautScript[] {
  const s = normaliserScript(e.script);
  const phrase = phrasesDe(ditDe(s.appel)).find((p) => SUR_L_ENTREPRISE.test(normaliser(p)) && !estUneAction(normaliser(p)));
  if (!phrase) return [];
  const sansNom = normaliser(phrase).replace(new RegExp(NOM_ENTREPRISE.source, "g"), " ");
  const d: DefautScript[] = [];
  const corps = [ditDe(s.accroche), ditDe(s.douleur), ditDe(s.promesse), ...etapesDites(s).map((x) => ditDe(phrasesEtape(x))), ditDe(s.exemple.phrases)];
  const lien = [e.idee ?? "", ditDe(s.aRetenir), ditDe(s.promesse), ...etapesDites(s).map((x) => x.action.dit)].join(" ");
  if (!partagent(sansNom, lien).length) d.push({ code: "entreprise-sans-lien", message: `La phrase sur l'entreprise (« ${phrase} ») n'est pas liée à l'idée du script : elle reprend ce que la vidéo enseigne (« Axion-IA forme les équipes à ces réflexes. »).`, eliminatoire: true });
  for (const p of corps.flatMap((t) => phrasesDe(t))) {
    if (!FAIT_SEUL.test(normaliser(p))) continue;
    const communs = partagent(sansNom, p);
    if (communs.length) {
      d.push({ code: "entreprise-incoherente", message: `La phrase sur l'entreprise (« ${phrase} ») contredit le corps (« ${p} ») : le spectateur le fait seul, l'entreprise ne peut pas le faire à sa place.`, eliminatoire: true });
      break;
    }
  }
  return d;
}

/**
 * LA QUESTION SUR L'IA (Will, 18/10) : la formulation tirée (`questionIa`), dite MOT POUR MOT, une seule fois, dans
 * l'appel, JUSTE AVANT la phrase sur l'entreprise (qui y répond), jamais en dernière phrase, rien d'écrit à l'écran.
 * Aucune autre question dans l'appel. `questionIa` absente (historique illisible, ancienne trace) : contrôle désactivé.
 */
export function controlerQuestionIa(brut: ScriptTableau, questionIa: string | undefined): DefautScript[] {
  if (!questionIa?.trim()) return [];
  const s = normaliserScript(brut);
  const d: DefautScript[] = [];
  const defaut = (message: string) => d.push({ code: "question-ia", message, eliminatoire: true });
  const visee = normaliser(questionIa);
  const toutes = phrasesDites(s).flatMap((p) => phrasesDe(p.dit).map((dit) => ({ dit, ecran: p.ecran })));
  const appel = phrasesDites({ ...s, accroche: [], douleur: [], promesse: [], etapes: [], exemple: { mentionEcran: "", phrases: [] }, aRetenir: [] }).flatMap((p) => phrasesDe(p.dit).map((dit) => ({ dit, ecran: p.ecran })));
  const ou = toutes.map((p, i) => (normaliser(p.dit) === visee ? i : -1)).filter((i) => i >= 0);
  if (!ou.length) defaut(`La question sur l'IA n'est pas dite : dites « ${questionIa} » mot pour mot, juste avant la phrase sur l'entreprise.`);
  if (ou.length > 1) defaut(`La question sur l'IA est dite ${ou.length} fois : une seule fois, juste avant la phrase sur l'entreprise.`);
  for (const p of appel) {
    if (p.dit.includes("?") && normaliser(p.dit) !== visee) defaut(`« ${p.dit} » : la seule question de la fin est « ${questionIa} », mot pour mot.`);
  }
  // La question est dite DANS l'appel (les phrases de `appel` closent la liste des phrases dites).
  const debutAppel = toutes.length - appel.length;
  for (const i of ou) {
    if (i < debutAppel) defaut(`La question sur l'IA (« ${questionIa} ») est dite dans l'appel, juste avant la phrase sur l'entreprise, pas avant l'appel (ici : « ${toutes[i].dit} » ferme une autre partie).`);
    const suivante = toutes[i + 1];
    if (!suivante) defaut(`La question sur l'IA ne peut pas être la dernière phrase : la fin affirme et ferme.`);
    else if (!SUR_L_ENTREPRISE.test(normaliser(suivante.dit))) defaut(`La question sur l'IA (« ${questionIa} ») doit être dite juste avant la phrase sur l'entreprise, qui y répond (après elle : « ${suivante.dit} »).`);
    if (toutes[i].ecran.trim()) defaut(`La question sur l'IA est dite, jamais écrite : rien à l'écran pour elle (« ${toutes[i].ecran.trim()} »).`);
  }
  return d;
}

/** Aucune suite de 3 mots dite deux fois (hors mots vides seuls et numéros d'étape) : ça sonne répété. */
export function controlerRepetitionMots(texteDit: string): DefautScript[] {
  const vues = new Map<string, number>();
  const d: DefautScript[] = [];
  phrasesDe(texteDit).forEach((ph, i) => {
    const mots = sansAccents(normaliser(ph))
      .replace(/^(un|deux|trois|quatre|cinq)\.\s+/, "")
      .split(/[^a-z0-9']+/)
      .filter(Boolean);
    for (let k = 0; k + 3 <= mots.length; k++) {
      const t = mots.slice(k, k + 3);
      if (!racines(t.join(" ")).length) continue;
      const cle = t.join(" ");
      const deja = vues.get(cle);
      if (deja !== undefined && deja !== i) {
        if (!d.some((x) => x.message.includes(`« ${cle} »`))) d.push({ code: "repetition-mots", message: `La suite « ${cle} » est dite deux fois : variez ou coupez.`, eliminatoire: true });
      } else if (deja === undefined) vues.set(cle, i);
    }
  });
  return d;
}

/** Formules creuses (éliminatoires) : elles sonnent bien et ne disent rien (15/10 : « votre parole est en jeu »). */
export const FORMULES_CREUSES: { motif: RegExp; libelle: string }[] = [
  { motif: /\bparole (?:qui )?est en jeu\b|\bvotre parole en jeu\b/, libelle: "« votre parole est en jeu »" },
  { motif: /\b(?:le|les) bons? gestes?\b/, libelle: "« le bon geste »" },
  { motif: /\bla cl[ée] (?:du succ[èe]s|de tout|de la r[ée]ussite)\b/, libelle: "« la clé du succès »" },
  { motif: /\bchanger la donne\b|\bchange la donne\b/, libelle: "« changer la donne »" },
  { motif: /\bfai(?:re|t|tes) (?:toute )?la diff[ée]rence\b/, libelle: "« faire la différence »" },
  { motif: /\bpasse[rz]? (?:au niveau|à la vitesse) sup[ée]rieure?\b/, libelle: "« passer au niveau supérieur »" },
  { motif: /\bgame[- ]?changer\b/, libelle: "« game changer »" },
  { motif: /\ben un clin d'(?:œ|oe)il\b/, libelle: "« en un clin d'œil »" },
  { motif: /\btout simplement\b|\ben toute simplicit[ée]\b/, libelle: "« tout simplement »" },
  { motif: /\bn'attendez plus\b/, libelle: "« n'attendez plus »" },
  { motif: /\bincontournables?\b/, libelle: "« incontournable »" },
  { motif: /\bv[ée]ritables? levier\b|\bun levier\b/, libelle: "« un levier »" },
  { motif: /\bgagne[rz]? en efficacit[ée]\b/, libelle: "« gagner en efficacité »" },
  { motif: /\bles bonnes pratiques\b/, libelle: "« les bonnes pratiques »" },
];

/** Jargon (signalé, non éliminatoire) : des mots que le spectateur ne dit pas lui-même (15/10). */
export const JARGON: { motif: RegExp; libelle: string }[] = [
  { motif: /\bentra[îi]nement\b/, libelle: "« entraînement »" },
  { motif: /\bparam[èe]tres?\b/, libelle: "« paramètres »" },
  { motif: /\bnettoy\p{L}*/u, libelle: "« nettoyer »" },
  { motif: /\b(?:le|du|au) mod[èe]le\b(?! de (?:relance|devis|mail|message|courrier|lettre))/, libelle: "« le modèle »" },
  { motif: /\bprompts?\b/, libelle: "« prompt »" },
  { motif: /\bllm\b|\btokens?\b|\bapi\b/, libelle: "un sigle technique" },
  { motif: /\balgorithmes?\b/, libelle: "« algorithme »" },
  { motif: /\bworkflows?\b/, libelle: "« workflow »" },
];

/** Formules creuses (éliminatoires) et jargon (signalé). */
export function controlerFormules(texteDit: string, quoi = "Le texte dit"): DefautScript[] {
  const t = normaliser(texteDit);
  return [
    ...FORMULES_CREUSES.filter((f) => f.motif.test(t)).map((f) => ({ code: "formule-creuse" as const, message: `${quoi} contient la formule creuse ${f.libelle} : dites le fait concret.`, eliminatoire: true })),
    ...JARGON.filter((f) => f.motif.test(t)).map((f) => ({ code: "jargon" as const, message: `${quoi} contient du jargon : ${f.libelle} (remarque : un mot simple, celui du spectateur).`, eliminatoire: false })),
  ];
}

/**
 * Le métier de l'exemple change d'un script à l'autre (15/10 : le plombier dans 5 scripts sur 11) : jamais celui d'un
 * des 3 derniers scripts livrés. `metiersRecents` absent (historique indisponible) : contrôle désactivé, sans défaut.
 */
export function controlerMetier(e: { metierExemple?: string }, metiersRecents: readonly string[] | undefined): DefautScript[] {
  const recents = (metiersRecents ?? []).map((m) => m.trim()).filter(Boolean).slice(0, 3);
  if (!recents.length) return [];
  const metier = e.metierExemple?.trim() ?? "";
  if (!metier) return [{ code: "metier-repete", message: "Le métier de l'exemple n'est pas dit (« metierExemple ») : il doit changer d'un script à l'autre.", eliminatoire: true }];
  const cle = racines(metier)[0];
  const meme = recents.find((m) => racines(m)[0] === cle);
  return meme ? [{ code: "metier-repete", message: `Le métier de l'exemple (« ${metier} ») est celui d'un des 3 derniers scripts (« ${meme} ») : prenez un autre métier.`, eliminatoire: true }] : [];
}

/** Paires (nombre, racine du mot qui suit) d'un texte : « trois données » → (3, « donne »). */
function nombresAvecUnite(t: string): { n: number; unite: string; texte: string }[] {
  const res: { n: number; unite: string; texte: string }[] = [];
  for (const m of sansAccents(normaliser(t)).matchAll(/(?<![a-z0-9])(\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|vingt|trente|cent|mille)\s+([a-z]{3,})/g)) {
    const unite = racines(m[2])[0];
    if (unite) res.push({ n: CARDINAUX[m[1]] ?? (m[1] === "vingt" ? 20 : m[1] === "trente" ? 30 : m[1] === "cent" ? 100 : m[1] === "mille" ? 1000 : Number(m[1])), unite, texte: m[0] });
  }
  return res;
}

/** Les nombres de l'accroche et de l'exemple se tiennent : une même unité ne porte pas deux nombres différents. */
export function controlerNombres(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const exemple = nombresAvecUnite(ditDe(s.exemple.phrases));
  const d: DefautScript[] = [];
  for (const a of nombresAvecUnite(ditDe(s.accroche))) {
    const autre = exemple.find((x) => x.unite === a.unite && x.n !== a.n);
    if (autre) d.push({ code: "nombres-incoherents", message: `L'accroche dit « ${a.texte} », l'exemple « ${autre.texte} » : les nombres de l'accroche et de l'exemple se tiennent.`, eliminatoire: true });
  }
  return d;
}

/* ------------------------------------------------------------------ */
/* 12. Relecture : les 3 phrases les plus faibles, jamais plus          */
/* ------------------------------------------------------------------ */

/** Corrections permises à la relecture (relu par les consignes). */
export const CORRECTIONS_MAX_RELECTURE = CORRECTIONS_MAX;

/**
 * Applique les corrections de la relecture (PUR) : au plus `CORRECTIONS_MAX`, chacune remplace UNE phrase dite
 * existante (recopiée mot pour mot) par UNE phrase. Jamais d'ajout, jamais de réécriture totale : une correction qui
 * ne retrouve pas sa phrase, qui ajoute une phrase ou qui est vide est écartée (avec sa raison).
 */
export function appliquerCorrections(e: EcritureScript, corrections: readonly CorrectionScript[]): { ecriture: EcritureScript; appliquees: CorrectionScript[]; ecartees: { correction: CorrectionScript; raison: string }[] } {
  const ecriture = structuredClone(e);
  const appliquees: CorrectionScript[] = [];
  const ecartees: { correction: CorrectionScript; raison: string }[] = [];
  const cible = (t: string) => normaliser(t).replace(/[.!?…]+$/, "");
  // Les phrases du script copié, par référence (pas `phrasesDites`, qui rend des copies) : on les modifie en place.
  const sc = ecriture.script;
  const phrases: PhraseScript[] = [...sc.accroche, ...sc.douleur, ...sc.promesse, ...sc.etapes.flatMap(phrasesEtape), ...sc.exemple.phrases, ...sc.aRetenir, ...sc.appel];
  corrections.forEach((c, i) => {
    const avant = c.avant.trim();
    const apres = c.apres.trim();
    if (i >= CORRECTIONS_MAX) return void ecartees.push({ correction: c, raison: `${CORRECTIONS_MAX} corrections au plus.` });
    if (!avant || !apres) return void ecartees.push({ correction: c, raison: "Correction vide." });
    if (phrasesDe(apres).length > Math.max(1, phrasesDe(avant).length)) return void ecartees.push({ correction: c, raison: "Elle ajoute une phrase." });
    const p = phrases.find((x) => cible(x.dit) === cible(avant)) ?? phrases.find((x) => phrasesDe(x.dit).some((ph) => cible(ph) === cible(avant)));
    if (!p) return void ecartees.push({ correction: c, raison: "Phrase introuvable dans le script." });
    if (cible(p.dit) === cible(avant)) {
      p.dit = apres;
      if (c.ecran.trim()) p.ecran = c.ecran.trim();
    } else {
      p.dit = phrasesDe(p.dit).map((ph) => (cible(ph) === cible(avant) ? apres : ph)).join(" ");
    }
    appliquees.push(c);
  });
  return { ecriture, appliquees, ecartees };
}

/* ------------------------------------------------------------------ */
/* Ensemble                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Positionnement de Will (lot A2) : ALERTE, jamais éliminatoire         */
/* ------------------------------------------------------------------ */

/**
 * « Jamais faites-le vous-même, on s'occupe de tout pour vous » sur la clôture, l'« à retenir » et la fin (appel).
 * ÉLIMINATOIRE depuis le lot B1 (décision D1 de Will, 18/10) pour les scripts de Claude : le tutoriel du corps est refusé
 * par `controlerEtapes` (`etape-imperatif`), la fin par ce contrôle. Ne s'applique JAMAIS à un texte de Will (collé,
 * « J'ai déjà mon texte ») : celui-là n'est jamais passé dans `controlerEcriture` (voir `pastillesTexteTableau`).
 */
export function controlerPositionnement(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const dernier = phrasesDe(s.appel.map((p) => p.dit).join(" ")).at(-1) ?? "";
  const fin = [ditDe(s.aRetenir), ditDe(s.appel)].filter(Boolean).join(" ");
  const diy = faitLeVousMeme(dernier) ?? faitLeVousMeme(fin) ?? diyImperatif(fin);
  if (diy) return [{ code: "positionnement", message: `La fin renvoie le spectateur à le faire seul (« ${diy} ») : concluez sur ce que nous mettons en place pour lui.`, eliminatoire: true }];
  const nouveaute = NOUVEAUTE_OUTIL.exec(sansAccents(normaliser(fin)));
  if (nouveaute) return [{ code: "positionnement", message: `La fin annonce un outil (« ${nouveaute[1]} ») : parlez du bénéfice pour l'entreprise, pas de la nouveauté.`, eliminatoire: true }];
  return [];
}

/** Les questions sur l'IA de la fin (imposées) ne sont pas des questions au spectateur. */
const sansQuestionIa = (t: string) => phrasesDe(t).filter((p) => !estQuestionIa(p)).join(" ");

/**
 * Une QUESTION au spectateur (en « vous », finie par « ? ») dans la douleur ou la promesse, hors les questions sur l'IA
 * de la fin (lot B1, D1) : elle le fait se reconnaître. REMARQUE (non éliminatoire).
 */
export function controlerQuestionSpectateur(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const texte = sansQuestionIa(`${ditDe(s.douleur)} ${ditDe(s.promesse)}`);
  if (texte.includes("?")) return [];
  return [{ code: "question-spectateur", message: "Aucune question au spectateur dans la douleur ou la promesse : finissez la douleur par une question en « vous » (« Chez vous, qui reprendrait ce dossier ? »).", eliminatoire: false }];
}

/** Racines communes (accroche et « à retenir » ou résultat de l'exemple) à partir desquelles on parle d'une redite. */
export const REDITE_ACCROCHE_MIN = 3;

/**
 * « À retenir » et le résultat de l'exemple (sa dernière phrase) ne reprennent pas les mots de l'accroche (≥ 3 racines
 * communes) : v-365dd2ae67ee redisait l'accroche. REMARQUE (non éliminatoire).
 */
export function controlerRediteAccroche(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const accroche = ditDe(s.accroche);
  if (!accroche) return [];
  const d: DefautScript[] = [];
  const resultat = s.exemple.phrases.map((p) => p.dit.trim()).filter(Boolean).at(-1) ?? "";
  for (const [nom, t] of [["« À retenir »", ditDe(s.aRetenir)], ["Le résultat de l'exemple", resultat]] as const) {
    if (!t) continue;
    const communes = [...new Set(partagent(t, accroche))];
    if (communes.length >= REDITE_ACCROCHE_MIN) d.push({ code: "redit-accroche", message: `${nom} redit l'accroche (mots communs : ${communes.join(", ")}) : apportez du neuf, ne reprenez pas ses mots.`, eliminatoire: false });
  }
  return d;
}

/**
 * Durée dite au-delà de laquelle le découpage coupe une scène (même valeur que `SCENE_LONGUE_SEC` de
 * `moteurs/montage-tableau/decoupage.ts`, vérifiée par `tests/tableau-scripts/densite-redite.test.ts`).
 */
const DUREE_SCENE_MAX_SEC = 8;
/** Mots qu'une scène peut dire sans être coupée : 8 s × 2,75 mots/s (voix à 165 mots/min) = 22. */
export const DENSITE_SCENE_MOTS_MAX = Math.floor(DUREE_SCENE_MAX_SEC * DEBIT_TABLEAU_MOTS_PAR_SEC);

/**
 * DENSITÉ PAR SCÈNE (lot B2b) : un constat « ce qui change » est une scène ; au-delà de 22 mots dits (8 s au débit du
 * tableau), le découpage la coupe en deux, et deux événements visuels de 4 s ne suffisent plus à tenir l'œil. REMARQUE
 * (non éliminatoire) : la borne bloquante d'un constat reste `bornesEtape` (28 mots).
 */
export function controlerDensiteScene(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const d: DefautScript[] = [];
  etapesDites(s).forEach((e, i) => {
    const n = compterMots(phrasesEtape(e).map((p) => p.dit).join(" "));
    if (n > DENSITE_SCENE_MOTS_MAX) {
      d.push({ code: "densite-scene", message: `Le constat ${i + 1} dit ${n} mots d'une traite (plus de ${DENSITE_SCENE_MOTS_MAX}, soit ${DUREE_SCENE_MAX_SEC} s de voix) : la scène sera coupée en deux ; resserrez-le.`, eliminatoire: false });
    }
  });
  return d;
}

/** Texte comparé sans casse, sans accents ni ponctuation. */
const brutDe = (t: string) => sansAccents(normaliser(t)).replace(/[^a-z0-9]+/g, " ").trim();

/** Part des mots de la phrase dite retrouvés à l'écran à partir de laquelle l'écran redit la phrase (4e passe : mot à mot, pas en sous-chaîne). */
export const SEUIL_REDITE_ECRAN = 0.8;
/** Une phrase dite de moins de 3 mots n'est jamais une redite (« Oui. », « Pourquoi ? »). */
const MOTS_REDITE_MIN = 3;
const motsDe = (t: string) => brutDe(t).split(" ").filter(Boolean);
/** Mots de moins de 3 lettres (« le », « un », « de ») : sans poids pour juger une redite. */
const MOTS_REDITE_LETTRES_MIN = 3;
/**
 * Redite : la phrase dite compte 3 mots au moins ; la part de ses mots UNIQUES de 3 lettres ou plus retrouvés à l'écran
 * atteint `SEUIL_REDITE_ECRAN` (un mot répété à l'écran ne compte qu'une fois, les petits mots ne comptent pas).
 */
const reditEcran = (dit: string, ecran: string) => {
  if (motsDe(dit).length < MOTS_REDITE_MIN) return false;
  const d = new Set(motsDe(dit).filter((m) => m.length >= MOTS_REDITE_LETTRES_MIN));
  if (!d.size) return false;
  const e = new Set(motsDe(ecran));
  return [...d].filter((m) => e.has(m)).length / d.size >= SEUIL_REDITE_ECRAN;
};

/**
 * REDITE dit / écrit (lot B2b) : un écran qui reprend 80 % des mots de la phrase dite ou plus (3 mots au moins ; mots uniques de 3 lettres ou plus, comparés mot à mot : `SEUIL_REDITE_ECRAN`) ; la voix, l'écran et le sous-titre
 * diraient trois fois la même chose. Les mots-clés (2 à 6 mots) ne sont pas une redite. REMARQUE (non éliminatoire).
 */
export function controlerEcranRedit(brut: ScriptTableau): DefautScript[] {
  const s = normaliserScript(brut);
  const phrases: PhraseScript[] = [...s.accroche, ...s.douleur, ...s.promesse, ...s.etapes.flatMap(phrasesEtape), ...s.exemple.phrases, ...s.aRetenir];
  return phrases
    .filter((p) => p.ecran.trim() && reditEcran(p.dit, p.ecran))
    .map((p) => ({ code: "ecran-redit" as const, message: `L'écran « ${p.ecran.trim()} » reprend la phrase dite « ${p.dit.trim()} » : écrivez 2 à 6 mots-clés, pas la phrase.`, eliminatoire: false }));
}

/**
 * Options des contrôles : les métiers des exemples des 3 derniers scripts livrés, et la question sur l'IA tirée pour
 * ce script (absents : contrôle désactivé).
 */
export interface OptionsControles {
  metiersRecents?: readonly string[];
  questionIa?: string;
}

/** Bornes de durée d'une vidéo de 30 s (la fourchette du réseau ne vaut que pour 60 s). */
export const DUREE_30S = { dureeMin: 20, dureeMax: 40 } as const;

/** Tous les contrôles d'une écriture (script, sources, variantes). */
export function controlerEcriture(e: EcritureScript, demande: DemandeScriptTableau, options: OptionsControles = {}): DefautScript[] {
  const texte = texteDitDe(e.script);
  const duree = dureeVisee(demande);
  const defauts = [
    ...controlerAccroche(e.script),
    ...controlerPhrases(e.script),
    ...controlerEtapes(e.script, { duree }),
    ...controlerExemple(e.script, demande),
    ...controlerAction(e.script, demande),
    ...controlerCloture(e.script),
    ...controlerDuree(texte, demande.reseau, "Le script", true, duree === 30 ? DUREE_30S : undefined),
    ...controlerMots(e.script, { duree }),
    ...controlerPromesse(e.script),
    ...controlerGain(e),
    ...controlerARetenir(e),
    ...controlerPhraseEntreprise(e),
    ...controlerRepetitionMots(texte),
    ...controlerFormules(texte),
    ...controlerMetier(e, options.metiersRecents),
    ...controlerQuestionIa(e.script, options.questionIa),
    ...controlerNombres(e.script),
    ...controlerMotsDouleur(e),
    ...controlerMotsInterdits(texte),
    ...controlerEntreprise(e.script),
    ...controlerChiffres(texte, e.sources),
    ...controlerOrganisation(e.script),
    ...controlerVerite(texte, e.affirmations),
    ...controlerPositionnement(e.script),
    ...controlerQuestionSpectateur(e.script),
    ...controlerRediteAccroche(e.script),
    ...controlerDensiteScene(e.script),
    ...controlerEcranRedit(e.script),
  ];
  for (const v of e.variantes) {
    const quoi = `La variante ${RESEAUX_SCRIPT_INFOS[v.reseau].libelle}`;
    // Durée d'une variante (non affichée) : une remarque, jamais une raison de perdre le script principal.
    defauts.push(
      ...controlerMotsInterdits(v.texteDit, quoi),
      ...controlerEntrepriseTexte(v.texteDit, quoi),
      ...controlerChiffres(v.texteDit, e.sources),
      ...controlerVerite(v.texteDit, e.affirmations, quoi),
      ...controlerFormules(v.texteDit, quoi).filter((x) => x.eliminatoire),
      ...controlerDuree(v.texteDit, v.reseau, quoi, false),
    );
  }
  return defauts;
}

export const aDesEliminatoires = (d: readonly DefautScript[]): boolean => d.some((x) => x.eliminatoire);

/** Une écriture lue avec tolérance (trace ancienne : sans idée, sans gain, sans métier, sans affirmations). */
export function ecritureLue(e: EcritureScript): EcritureScript {
  const brute = e as Partial<EcritureScript>;
  return {
    ...e,
    idee: brute.idee ?? "",
    gain: brute.gain ?? { formule: "", unite: "" },
    metierExemple: brute.metierExemple ?? "",
    script: normaliserScript(e.script),
    affirmations: brute.affirmations ?? [],
  };
}

/** Une version écrite, recontrôlée avec les règles EN VIGUEUR. */
export interface VersionRetenue {
  passe: "ecriture" | "relance" | "relecture";
  ecriture: EcritureScript;
  defauts: DefautScript[];
  /** Vrai si aucun défaut éliminatoire : la version passe tous les contrôles en code. */
  valide: boolean;
}

/**
 * La version à livrer (PUR) : la DERNIÈRE qui passe tous les contrôles en code (une relecture qui dégrade ne fait jamais
 * perdre une version valide) ; sinon, la moins fautive (la plus récente à égalité), pour être affichée et corrigée.
 * Chaque version est recontrôlée avec les règles en vigueur (une trace ancienne profite des règles revues).
 */
export function versionRetenue(versions: readonly { passe: VersionRetenue["passe"]; ecriture: EcritureScript }[], demande: DemandeScriptTableau, options: OptionsControles = {}): VersionRetenue | null {
  const lues = versions.map((v) => {
    // Une version ancienne (avant le gabarit du 15/10) est remise en forme, puis recontrôlée avec les règles en vigueur
    // (sans idée, sans gain, elle y échoue).
    const ecriture = ecritureLue(v.ecriture);
    const defauts = controlerEcriture(ecriture, demande, options);
    return { passe: v.passe, ecriture, defauts, valide: !aDesEliminatoires(defauts) };
  });
  const valides = lues.filter((v) => v.valide);
  if (valides.length) return valides.at(-1)!;
  const elim = (v: VersionRetenue) => v.defauts.filter((d) => d.eliminatoire).length;
  return lues.reduce<VersionRetenue | null>((m, v) => (!m || elim(v) <= elim(m) ? v : m), null);
}
