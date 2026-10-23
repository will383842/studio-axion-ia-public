/**
 * IMAGE → VIDÉO · Contrat de la « fiche de l'image » (`fiche-image/1`, plan § 4). PUR, importable côté client et par
 * `studio-rendu` (aucun alias « @/ », aucun accès au serveur).
 *
 * La fiche est le script écrit par Claude d'après une carte VALIDÉE : le texte dit, écran par écran, avec ce que chaque
 * écran montre (scène, ids de la carte, textes d'écran, événements calés sur un mot dit, fond). Elle porte aussi les
 * deux accroches (A/B), la question de commentaire propre à l'image et, pour une image très complexe, ses chapitres.
 * Seul le CORPS est écrit ici (accroche → phrase-choc) : la question est dite au début du segment de fin, sauf sur
 * LinkedIn ; la fin du réseau vient de la banque, jamais de la fiche.
 */
import { z } from "zod";

export const VERSION_FICHE_IMAGE = "fiche-image/1";

/** Les 6 parties du corps, dans l'ordre (contrôle Q07). */
export const PARTIES = ["accroche", "douleur", "debut-reponse", "explication", "resultat", "phrase-choc"] as const;
export type Partie = (typeof PARTIES)[number];

/**
 * Sortes de scène (plan § 5). Les trois premières sont des écrans « émotion » v4 rendus par `CasConcretEcran` ; les
 * autres sont les composants du format (toile et caméra, embranchement, entonnoir…).
 */
export const SCENES = [
  "accroche",
  "chiffre",
  "titre",
  "toile",
  "embranchement",
  "entonnoir",
  "nuee",
  "ecran-partage",
  "additionneur",
  "carte-benefice",
  "micro-objet",
  "bandeau-chiffres",
  "recherche",
  "alerte",
  "email",
  "dossiers",
  "sources",
  "phrase-choc",
  "ensemble",
] as const;
export type Scene = (typeof SCENES)[number];

/** Ce qui arrive à l'écran sur un mot dit (lu par la mise en scène, lot L11). */
export const ACTIONS_SUR_MOT = ["apparait", "coche", "compte", "separe", "tombe", "tape", "allume", "bascule"] as const;

export const FONDS = ["sombre", "ivoire"] as const;
export type Fond = (typeof FONDS)[number];

/** Familles d'accroche : les deux accroches proposées à Will sont de familles différentes (§ 4). */
export const FAMILLES_ACCROCHE = ["chiffre", "question", "ratio", "situation", "liste"] as const;

const idCarte = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "Identifiant de la carte : minuscules, chiffres et tirets.");
const texteDit = z.string().trim().min(1).max(400);
const texteEcran = z.string().trim().min(1).max(80);

export const schemaSurMot = z.strictObject({
  /** Rang du mot dans le `texteDit` de l'écran (0 = premier ; un signe isolé comme « : » ne compte pas). */
  mot: z.number().int().min(0).max(80),
  action: z.enum(ACTIONS_SUR_MOT),
  /** Id de la carte que l'événement montre (nœud, lien, chiffre ou groupe) ; parmi les `refs` de l'écran. */
  ref: idCarte.optional(),
});

export const schemaEcranFiche = z.strictObject({
  /** « e01 », « e02 »… dans l'ordre. */
  id: z.string().regex(/^e\d{2}$/, "Identifiant d'écran : « e01 », « e02 »…"),
  partie: z.enum(PARTIES),
  scene: z.enum(SCENES),
  /** Ids de la carte montrés ou dits par l'écran. */
  refs: z.array(idCarte).max(20),
  /** Ce que dit la voix : chiffres EN LETTRES. */
  texteDit,
  /** Textes affichés : chiffres en chiffres ; `*mot*` = le mot orange (un seul par écran). */
  textesEcran: z.array(texteEcran).max(6),
  surMot: z.array(schemaSurMot).max(12),
  fond: z.enum(FONDS),
});

export const schemaAccroche = z.strictObject({
  famille: z.enum(FAMILLES_ACCROCHE),
  texteDit,
  textesEcran: z.array(texteEcran).min(1).max(3),
});

export const schemaChapitreFiche = z.strictObject({
  /** « 1/3 », « 2/3 », « 3/3 » : affiché en haut pendant tout le chapitre. */
  repere: z.string().regex(/^\d\/\d$/, "Repère de chapitre : « 1/3 »."),
  titre: z.string().trim().min(1).max(80),
  /** Ids des écrans du chapitre (consécutifs, dans la partie « explication »). */
  ecrans: z.array(z.string().regex(/^e\d{2}$/)).min(1).max(40),
  /** Faux = détachable : retiré des versions courtes, rien après lui n'y renvoie. */
  essentiel: z.boolean(),
});

export const schemaFicheImage = z.strictObject({
  version: z.literal(VERSION_FICHE_IMAGE),
  /** Empreinte de la carte validée d'où le script est écrit (Q03 la compare). */
  empreinteCarte: z.string().trim().min(1).max(128),
  /** Deux accroches de familles différentes ; la première est celle du premier écran (Will peut les échanger). */
  accroches: z.tuple([schemaAccroche, schemaAccroche]),
  ecrans: z.array(schemaEcranFiche).min(6).max(60),
  /** Question propre à l'image, dite après la phrase-choc (IG, FB, TT, YS ; jamais dans la vidéo LinkedIn). */
  questionCommentaire: z.strictObject({ texteDit, texteEcran }),
  /** Vide sauf image « très complexe » (2 ou 3 chapitres). */
  chapitres: z.array(schemaChapitreFiche).max(3),
});

export type FicheImage = z.infer<typeof schemaFicheImage>;
export type EcranFiche = FicheImage["ecrans"][number];
export type ChapitreFiche = FicheImage["chapitres"][number];
export type AccrocheFiche = FicheImage["accroches"][number];

/** Mots lus d'un texte dit (lettres ou chiffres ; « e-mail », « l'objet » = un mot ; « : » ne compte pas). */
export function motsDits(t: string): string[] {
  return t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
}

/** Phrases d'un texte dit : coupées sur « . », « ? », « ! », « : », « ; » et « … ». */
export function phrasesDe(t: string): string[] {
  return t
    .split(/[.!?:;…]+/u)
    .map((p) => p.trim())
    .filter((p) => motsDits(p).length > 0);
}

/** Texte dit du corps, écrans mis bout à bout. */
export function texteDuCorps(fiche: Pick<FicheImage, "ecrans">): string {
  return fiche.ecrans.map((e) => e.texteDit).join(" ");
}

/** Mots orange d'un écran (`*mot*`). */
export function motsOrange(e: Pick<EcranFiche, "textesEcran">): string[] {
  return e.textesEcran.flatMap((t) => [...t.matchAll(/\*([^*]+)\*/g)].map((m) => m[1]!));
}
