/**
 * SOCLE QUALITÉ COMMUN DES SCRIPTS · les types (plan socle qualité § 5.1, PR 2 + PR 3, étendues aux règles de Will).
 * PUR : aucun réseau, aucune base, importable côté client et côté serveur.
 *
 * Le socle MESURE un script après l'écriture, quel que soit l'écrivain. Il ne change pas la façon d'écrire et, dans
 * cette version, il est en MODE OBSERVATION : aucune règle ne bloque, aucun verdict existant ne change. Chaque règle
 * porte le niveau qu'elle AURAIT si Will la promouvait (`niveauVise`) ; le rapport, lui, n'émet que des « info ».
 */
import type { LigneScript } from "@/domaine/relecture-script";
import type { ReseauDeclinaison } from "@/domaine/types";

/** Les thèmes du socle (une note sur 10 par thème). */
export const THEMES = ["accroche", "retention", "valeur", "prospects", "positionnement", "interdits", "forme"] as const;
export type Theme = (typeof THEMES)[number];

export const LIBELLES_THEMES: Readonly<Record<Theme, string>> = {
  accroche: "Accroche",
  retention: "Rétention",
  valeur: "Valeur",
  prospects: "Prospects",
  positionnement: "Positionnement",
  interdits: "Interdits",
  forme: "Forme",
};

/**
 * Rôle d'une ligne dans le script. Ce n'est PAS un ordre imposé : chaque recette garde ses structures ; le socle
 * vérifie seulement que les fonctions minimales sont présentes.
 */
export const PARTIES = ["accroche", "douleur", "promesse", "corps", "preuve", "exemple", "a-retenir", "question", "appel", "fin"] as const;
export type Partie = (typeof PARTIES)[number];

/** Une ligne du script normalisé : une `LigneScript` (celle de « Relire le script ») plus son rôle et, si connu, son horaire. */
export interface LigneNormalisee extends LigneScript {
  partie: Partie;
  /** Horodatage réel (s), quand il existe ; sinon le socle estime au débit de la recette. */
  debutSec?: number;
  finSec?: number;
  /** Rangs de mots (dans `dit`, 0 = premier) où l'écran change en cours de ligne (événements d'animation). */
  changements?: number[];
  /** false : un nombre de la ligne n'a pas de source connue ; true : sourcé ; absent : l'écrivain le vérifie lui-même. */
  sourcee?: boolean;
}

export interface ScriptNormalise {
  lignes: LigneNormalisee[];
  /** Réseau de cette version ; absent : tous les réseaux de la recette sont regardés. */
  reseau?: ReseauDeclinaison;
  /** Durée visée (s), si l'écrivain la connaît. */
  dureeViseeSec?: number;
}

/** Débit déclaré par la recette : le socle exprime ses seuils en SECONDES, jamais en mots. */
export type Debit = { unite: "mots"; parSeconde: number } | { unite: "caracteres"; parSeconde: number };

/** Un écart de seuil n'existe jamais sans sa raison écrite (tout écart reste visible). */
export interface Ecart<T> {
  valeur: T;
  raison: string;
}

/** Niveau qu'une règle aurait une fois promue. En observation, tout s'affiche en « info ». */
export type NiveauVise = "bloquant" | "alerte" | "info";

/** Comment le script se termine pour cet écrivain. */
export type DemandeFinale = "demande" | "question" | "facultative";

/**
 * LA RECETTE QUALITÉ d'un écrivain : son débit, ses réseaux, ses structures (plusieurs, pour garder la diversité) et ses
 * écarts de seuil, chacun avec sa raison. Une vingtaine de lignes suffit à brancher un futur générateur.
 */
export interface RecetteQualite {
  id: string;
  libelle: string;
  debit: Debit;
  reseaux: readonly ReseauDeclinaison[];
  /** Face caméra : pas de règle « changement à l'écran » (la personne qui parle est le mouvement). */
  faceCamera: boolean;
  /** L'écrivain donne de vrais écrans (et leurs événements) : la règle « changement à l'écran » se mesure. */
  ecransReels: boolean;
  demandeFinale: DemandeFinale;
  /** Réseau où la demande est dite hors de la vidéo (légende, commentaire) : elle y devient facultative. */
  demandeFinaleParReseau?: Partial<Record<ReseauDeclinaison, DemandeFinale>>;
  /** Liste des interdits permanents qui s'applique à cet écrivain aujourd'hui (`regles/interdits.ts`). */
  interdits: EcrivainInterdits;
  /** Structures du format (informatif : l'ordre et la forme restent dans la recette, le socle ne les impose pas). */
  structures: readonly { id: string; parties: readonly Partie[] }[];
  /** Écarts aux seuils communs de `seuils.ts`, chacun avec sa raison. */
  ecarts?: Partial<{ [K in keyof SeuilsCommuns]: Ecart<SeuilsCommuns[K]> }>;
  /** Niveau visé d'une règle changé pour cet écrivain (jamais sans raison). */
  niveaux?: Readonly<Record<string, Ecart<NiveauVise>>>;
}

export type EcrivainInterdits = "ecrire" | "tableau" | "cas-concret" | "image-video";

/** Les seuils communs (en secondes ou en mots par phrase), seule source : `seuils.ts`. */
export interface SeuilsCommuns {
  premierePhraseMotsMax: number;
  premierePhraseFinSec: number;
  accrocheFinSecMax: number;
  phraseAlerteMots: number;
  phraseRefusMots: number;
  /** Écart maximal entre deux changements à l'écran (s) ; ignoré en face caméra. */
  changementEcranSec: number;
  gainAvantPart: number;
  relanceDebutPart: number;
  relanceFinPart: number;
  motsEcritsMax: number;
  ciblePremieresSec: number;
}

export type Statut = "ok" | "ecart" | "a-trancher" | "non-mesure";

/** Le résultat d'une règle sur un script. */
export interface ResultatRegle {
  code: string;
  theme: Theme;
  /** Une phrase courte, vouvoiement. */
  message: string;
  statut: Statut;
  niveauVise: NiveauVise;
  ligneId?: string;
  /** Pour un absolu : la version prudente proposée (Will tranche : « Garder » ou « Version prudente »). */
  versionPrudente?: string;
}

/** Ce que reçoit chaque règle. */
export interface Contexte {
  script: ScriptNormalise;
  recette: RecetteQualite;
  seuils: SeuilsCommuns;
  lecture: import("./script").Lecture;
}

export type Regle = (c: Contexte) => ResultatRegle[];
