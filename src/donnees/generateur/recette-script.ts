/**
 * RECETTE COMMUNE DES SCRIPTS (lot A1), UNE SEULE SOURCE : la consigne du rôle « script » de la chaîne courte la cite
 * telle quelle (partie en cache, jamais dans la partie variable) et les contrôles de recette (`domaine/controles-script`)
 * en reprennent les seuils. Vidéo de 45 s ; proportionnel pour 30 et 60 s. Donnée, pas code.
 */
import { plafondMotsParSec } from "@/domaine/debit-voix";

/** Débit maximal : lu de `domaine/debit-voix.ts` (cible 2,75 mots/s + 10 %), jamais une seconde valeur. */
export const MOTS_PAR_SEC_VIDEO_MAX = plafondMotsParSec();
/**
 * FORMATS HORS RECETTE COMMUNE : la recette et les anti-patterns ci-dessous, les contrôles C95 à C99 et les consignes
 * du lot A (tension de l'accroche, décrochages de la relecture) ne s'appliquent PAS à ces formats. Seul l'avocat y est :
 * ordre permanent de Will « ne rien toucher à l'avocat » (son format porte le code de générateur « AV », « l'essentiel
 * en trois idées », un débit mesuré à 4,5 mots/s : la recette commune, « UNE seule idée » à 3,0 mots/s au plus, le
 * contredit). Il retrouve exactement ce que la chaîne courte lui donnait avant le lot A (#499). Identifiants de FORMAT
 * (`formatId` du sujet), tableau figé : tout ajout est une décision de Will, avec son test.
 */
export const FORMATS_HORS_RECETTE_COMMUNE: readonly string[] = Object.freeze(["avocat"]);

/** Ce format est-il hors recette commune ? (identifiant absent ou inconnu : non, la recette s'applique.) */
export const horsRecetteCommune = (formatId: string | undefined): boolean => !!formatId && FORMATS_HORS_RECETTE_COMMUNE.includes(formatId);

export const PHRASES_MAX_45S = 12;
export const QUESTIONS_MAX = 2;
export const ECRAN_MOTS_MAX = 5;

/**
 * « On s'en occupe pour vous » (ou « pour toi ») : la rupture qui remplace le « faites-le vous-même ». Un VERBE à la forme
 * « on … » ou « nous … » est exigé : « c'est coûteux pour vous » ne passe pas. À appliquer sur un texte SANS accents et à
 * apostrophe droite (`ruptureDite` le prépare).
 */
export const MOTIF_RUPTURE =
  /\bon (?:s'en|le|la|les|l') ?(?:occupe|met|installe|fait|gere|configure|branche|prepare)\w*|\bnous (?:nous en occupons|(?:qui )?(?:le |la |les |l')?(?:mettons|installons|gerons|occupons|preparons|configurons|branchons))|\bon (?:\w+ ){0,6}?(?:met|installe|fait|gere|configure|branche|prepare|occupe)\w*(?: \w+){0,8} pour (?:vous|toi)\b/i;

/** La rupture est-elle dite dans ce texte ? (accents retirés, apostrophes typographiques normalisées). */
export const ruptureDite = (texte: string): boolean => MOTIF_RUPTURE.test(texte.normalize("NFD").replace(/\p{M}/gu, "").replace(/[’ʼ`]/g, "'"));

const DEBIT = MOTS_PAR_SEC_VIDEO_MAX.toFixed(1).replace(".", ",");

export const RECETTE_SCRIPT = [
  "RECETTE (vidéo de 45 s ; proportionnel pour 30 et 60 s), 8 éléments dans cet ordre, tous obligatoires :",
  "1. Accroche à tension (0-3 s) : tu resserres l'accroche retenue vers 6 à 11 mots, avec un enjeu ou une conséquence qui arrive, pas une simple situation ; ni salut, ni question fermée.",
  "2. Douleur avec les mots du spectateur (3-10 s, 14 à 20 mots) : un geste du quotidien et son coût.",
  "3. Question au spectateur (10-14 s, 6 à 12 mots) : dans l'adresse de la vidéo (vous ou tu), finie par « ? », posée avant 40 % de la durée ; la phrase suivante n'y répond pas mot à mot.",
  "4. Promesse (14-18 s, 8 à 12 mots) : ce qui change pour lui, sans annoncer un nombre d'étapes.",
  "5. UNE seule idée montrée (18-32 s, 26 à 34 mots) : un seul mécanisme, à l'indicatif, avec l'outil ou « on » comme sujet ; aucun impératif adressé au spectateur ; 2 à 3 constats au plus ; aucun numéro dit.",
  "6. Preuve (32-38 s, 14 à 22 mots) : une vraie preuve fournie, sinon « Prenons un/une [métier]… » avec la mention « Exemple illustratif » à l'écran ; avec un avant et un après.",
  "7. Rupture « on s'en occupe pour vous » (38-42 s, 8 à 14 mots) : c'est NOUS qui mettons en place.",
  "8. Appel (42-45 s) : l'appel imposé par le code s'il est fourni, sinon une seule demande de 3 à 6 mots, phrase affirmative, sans virgule.",
  `Limites : au plus ${DEBIT} mots par seconde (débit cible de la voix + 10 %), ${PHRASES_MAX_45S} phrases pour 45 s, ${QUESTIONS_MAX} questions au plus, ${ECRAN_MOTS_MAX} mots au plus à l'écran.`,
].join("\n");

export const ANTI_PATTERNS_SCRIPT = [
  "ANTI-PATTERNS (le code les repère) :",
  "A1 Tutoriel : au moins 2 phrases qui débutent par un numéro ou « D'abord » suivi d'un impératif, ou 3 impératifs de suite en tête de phrase dans le corps.",
  "A2 Triple lecture : l'écran redit mot pour mot ce qui est dit.",
  "A3 Fin qui redit l'accroche : la dernière phrase du corps reprend l'accroche.",
  "A4 Plus d'une idée : le corps développe un seul mécanisme.",
  "A5 Remplissage : aucune phrase qui n'apporte ni constat, ni preuve, ni bénéfice.",
].join("\n");
