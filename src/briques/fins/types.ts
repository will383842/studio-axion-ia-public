/**
 * FINS PAR RÉSEAU (TB-15, plan § 11). PUR, sans alias « @/ » : aucune dépendance au reste du studio. Une fin = une phrase
 * DITE (≤ 12 mots) et une phrase À L'ÉCRAN (≤ 8 mots), tirées d'un appel (table provisoire aujourd'hui, bibliothèque
 * « Appels » de l'Usine demain). Le format n'écrit jamais une phrase d'appel lui-même.
 */

/** Réseaux (mêmes identifiants que `src/reseaux`, recopiés ici : un test vérifie qu'ils restent les mêmes). */
export const RESEAUX_FIN = ["instagram", "facebook", "tiktok", "youtube", "youtube-shorts", "linkedin"] as const;
export type ReseauFin = (typeof RESEAUX_FIN)[number];

/** Groupes de réseaux qui partagent leurs fins. */
export const GROUPES_FIN = ["instagram-facebook", "tiktok-youtube", "linkedin"] as const;
export type GroupeFin = (typeof GROUPES_FIN)[number];

/** Nature de l'appel : « commentaire » = « Commentez MOT » (1 contenu sur 3 au plus) ; les autres sont des appels de visibilité. */
export type TypeFin = "abonnement" | "enregistrement" | "envoi" | "question" | "commentaire" | "cadeau" | "rendez-vous" | "lien";

export const MOTS_DIT_MAX = 12;
export const MOTS_ECRAN_MAX = 8;
/** Emplacement du mot-clé d'un appel « Commentez MOT », remplacé au choix de la fin. */
export const EMPLACEMENT_MOT = "{MOT}";

export interface FinTable {
  id: string;
  groupe: GroupeFin;
  type: TypeFin;
  /** Phrase dite (≤ 12 mots). */
  dit: string;
  /** Phrase écrite à l'écran (≤ 8 mots). */
  ecran: string;
  /** Vrai seulement quand Will a validé la phrase : rien n'est utilisable tant que c'est faux. */
  validee: boolean;
  /** Limite la ligne à certains réseaux de son groupe (Facebook et Instagram partagent un groupe, pas l'endroit du lien). Absent : tout le groupe. */
  reseaux?: readonly ReseauFin[];
  /**
   * Les 12 mots de la phrase dite se comptent PAR PHRASE (coupée sur « . ? ! : ; … »), sans compter la ponctuation seule :
   * une fin à deux phrases (« Réservez un appel : on … ») n'est pas refusée parce que leur somme dépasse 12. Réservé aux
   * lignes qui le demandent ; toutes les autres gardent le compte de la phrase entière.
   */
  parPhrase?: true;
  /** Trace de la validation par Will : qui, quand, d'après quoi. */
  validation?: { par: "will"; le: string; source: string };
}

/** Fin choisie, prête pour la composition (emplacement du mot rempli). */
export interface FinChoisie {
  id: string;
  groupe: GroupeFin;
  type: TypeFin;
  dit: string;
  ecran: string;
}

/**
 * Point de lecture FUTUR de la bibliothèque « Appels » de l'Usine (`appel_texte`, emplacements DIT et ECRAN par réseau).
 * Injecté, non branché : aujourd'hui personne ne l'implémente. Rend null si l'appel est inconnu pour ce réseau.
 */
export interface LecteurAppels {
  lire(reseau: ReseauFin, appelId: string): Promise<FinTable | null>;
}
