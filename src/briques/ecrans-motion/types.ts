/**
 * TYPES DES ÉCRANS ANIMÉS À DEUX FONDS (brique `ecrans-motion`) : les 12 types d'écran, la banque fermée des objets
 * redessinés, les propriétés d'un écran rendu seul et la forme d'entrée d'un écran calé. PUR, sans React, sans Zod et
 * SANS alias « @/ » : lu tel quel par `studio-rendu` et par le moteur (contrôle avant rendu). N'importe rien d'un moteur.
 *
 * Tout texte d'écran accepte le balisage `*mot*` : le mot (ou les mots) entre astérisques prend la couleur d'accent.
 * Des `type` (et non des `interface`) : Remotion veut des propriétés indexables.
 */

/** Cadence des écrans (images par seconde). */
export const FPS_ECRANS = 25;
/** Marque écrite en haut de la zone sûre de chaque écran. */
export const MARQUE_ECRANS = "axion-ia.com";

/** Les 12 types d'écran, dans l'ordre du plan. */
export const TYPES_ECRAN = Object.freeze([
  "accroche",
  "chiffre",
  "liste-avant",
  "titre",
  "etape",
  "objet",
  "preuve",
  "resultat",
  "question",
  "appel-mot",
  "promesse",
  "lien",
] as const);
export type TypeEcran = (typeof TYPES_ECRAN)[number];

/** Banque fermée des objets redessinés (phase 1, 17 objets, aucun personnage) : 11 de la vidéo 1, puis 6 pour les autres offres. */
export const IDS_OBJETS = Object.freeze([
  "telephone-capture",
  "telephone-notification",
  "pile-notifications",
  "chrono",
  "contrat-signature",
  "dossier-classe",
  "bouclier-coche",
  "champ-commentaire",
  "bulle-lien",
  "liste-taches",
  "barres-avant-apres",
  "calendrier",
  "programme",
  "rapport",
  "carte-taches",
  "outils-relies",
  "e-mail",
] as const);
export type IdObjet = (typeof IDS_OBJETS)[number];

/** Les deux fonds de la charte `charte-duo/1`. */
export const FONDS_ECRAN = Object.freeze(["sombre", "ivoire"] as const);
export type Fond = (typeof FONDS_ECRAN)[number];

/** Rectangle en px dans l'image. */
export type BoitePx = { x: number; y: number; largeur: number; hauteur: number };

/** Vrai écran filmé ou photographié (capture du site), prêt pour le rendu. */
export type CaptureEcran = {
  /** Adresse lue par le rendu (fichier servi à la composition). */
  src: string;
  /** Clé de la capture dans le stockage. */
  cle: string;
  sorte: "image" | "video" | "page-entiere";
  /** Dimensions du fichier, en px. */
  largeur: number;
  hauteur: number;
  /** Durée du film, pour `video`. */
  dureeSec?: number;
};

/** Objet redessiné, avec ses textes éventuels (ex. sujet d'une notification). */
export type ObjetEcran = { objet: IdObjet; textes?: string[] };

/** Visuel d'un écran, une fois les captures résolues : un objet redessiné, ou un vrai écran. */
export type VisuelEcran = ObjetEcran | { capture: CaptureEcran };
/** Visuel d'un écran calé : un objet, ou la clé d'une capture (résolue par `proprietesEcrans`). */
export type VisuelCale = ObjetEcran | { capture: { cle: string } };

/** Pastille d'un total (« +1 H », « pour chaque personne »). */
export type PastilleTotal = { valeur: string; ligne?: string };

/**
 * Contenu propre à chaque type (plan § 6.1), paramétré par la forme du visuel. `etiquette` = petit texte en capitales
 * au-dessus du titre (absente : pas d'étiquette).
 */
export type ContenuEcran<V = VisuelEcran> =
  | { type: "accroche"; etiquette?: string; lignes: string[] }
  | { type: "chiffre"; nombre: number; unite: string; pastilles: string[]; compteur: boolean }
  | { type: "liste-avant"; etiquette?: string; titre: string; taches: string[]; total?: PastilleTotal }
  | { type: "titre"; lignes: string[] }
  | { type: "etape"; numero: number; nombreEtapes: number; titre: string; ligne: string; visuel: V; puces: string[] }
  | { type: "objet"; titre: string; ligne?: string; visuel: V }
  | { type: "preuve"; etiquette?: string; titre: string; puces: string[] }
  | { type: "resultat"; etiquette?: string; titre: string; avant: string; maintenant: string; ligne: string }
  | { type: "question"; lignes: string[]; question: string }
  | { type: "appel-mot"; etiquette?: string; invite: string; mot: string; suite: string }
  | { type: "promesse"; invite: string; cadeau: string; ligne: string }
  | { type: "lien"; etiquette?: string; titre: string; lien: string; signature: string };

/** Moment visible d'un écran (mot qui tombe, puce qui surgit…). */
export type EvenementEcran = {
  /** Ce qui apparaît (identifiant libre lu par la composition : « ligne », « puce-1 », « tache-2 »…). */
  cible: string;
  /** Heure, en ms depuis le DÉBUT DE L'ÉCRAN. */
  ms: number;
};

/**
 * Jeu tiré pour un écran (variété du cas concret, lot L2) : réglages NOMMÉS (« entree », « camera »…), lus seulement par
 * les compositions qui les connaissent. Absent : le comportement d'origine (v4), à l'identique.
 */
export type JeuEcran = Readonly<Record<string, string | number | boolean>>;

/** Ce que porte tout écran rendu, quel que soit son type. */
export type BaseProprietesEcran = {
  /** Identifiant de l'écran dans la fiche (« e01 »…). */
  id: string;
  largeur: number;
  hauteur: number;
  fps: typeof FPS_ECRANS;
  /** Heures de l'écran sur l'horloge de la vidéo (ms). Durée = `finMs − debutMs`. */
  debutMs: number;
  finMs: number;
  fond: Fond;
  marque: typeof MARQUE_ECRANS;
  /** Zone utile (zone sûre des réseaux, moins la bande des sous-titres), en px. */
  zone: BoitePx;
  /** Zone de dessin (plus large que la zone sûre), en px : un objet sans texte porteur de sens peut aller jusque-là.
   * Absente : les objets restent dans la zone utile. */
  dessin?: BoitePx;
  /** Bas du fil des étapes, en px (V4-2) : absent, le fil se pose au bas de la zone de dessin (comportement d'origine).
   * Posé plus bas que la zone de dessin, il passe sous les sous-titres (comme la v4, à 92 % de la hauteur) sans que les
   * objets descendent pour autant. */
  basFil?: number;
  evenements: EvenementEcran[];
  /** L2 · jeu tiré pour cet écran (seules les dimensions déjà branchées) ; absent : comportement actuel. */
  jeu?: JeuEcran;
};

/** Propriétés d'UN écran rendu seul (sans son ni sous-titres) : union discriminée par `type`. */
export type ProprietesEcran = BaseProprietesEcran & ContenuEcran<VisuelEcran>;

/** Moment visible d'un écran calé, en ms sur l'horloge de LA VIDÉO. */
export type EvenementCale = { cible: string; ms: number };

/**
 * Forme d'entrée d'un écran calé (sortie du calage d'un moteur, recopiée ici : la brique ne dépend d'aucun moteur).
 * Les heures sont sur l'horloge de la vidéo.
 */
export type EcranCale = {
  id: string;
  fond: Fond;
  debutMs: number;
  finMs: number;
  evenements: EvenementCale[];
  /** L2 · jeu tiré pour cet écran, recopié tel quel dans ses propriétés ; absent : comportement actuel. */
  jeu?: JeuEcran;
} & ContenuEcran<VisuelCale>;
