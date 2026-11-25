/**
 * CONTRAT DU STORY-BOARD DE LA VIDÉO LONGUE SANS VOIX (lot F « qualité longue », 25/11) — TYPES ET CONSTANTES SEULEMENT.
 * PUR, AUCUN import (ni « @/ », ni React, ni Remotion) : lu tel quel par le moteur (Next) ET par la composition Remotion
 * `studio-rendu/compositions/plan-scenes/longue/` (chemin relatif). Tous les temps sont en millisecondes de la vidéo ENTIÈRE :
 * la composition est rendue par plages d'images avec ces MÊMES propriétés complètes (mode « plage »).
 * Posé en base commune (tdb/QUALL-0) : les lots QUALL-1 à QUALL-4 le lisent sans le modifier.
 */

/* ------------------------------------------------------------------ */
/* Identités et versions                                               */
/* ------------------------------------------------------------------ */

export const VERSION_STORYBOARD = "storyboard-longue-1" as const;
/** Id de la composition Remotion 16:9 (inscrite par `CompositionsVideoLongue`). */
export const ID_COMPOSITION_VIDEO_LONGUE = "VideoLongue" as const;
/**
 * À augmenter à CHAQUE changement visible du dessin ou de la mise en page : entre dans l'empreinte des plages notées,
 * sinon un vieux morceau rendu avec l'ancien dessin serait recollé.
 */
export const VERSION_DESSIN_LONGUE = 12;

export const FORMAT_LONGUE = { largeur: 1920, hauteur: 1080, fps: 25 } as const;

/** Libellé de l'appel de fin (même texte que `LIBELLE_APPEL_RDV` de `briques/motion/habillage-commun/sequence-appel.ts`). */
export const LIBELLE_APPEL_LONGUE = "Prendre rendez-vous";
export const ADRESSE_LONGUE_DEFAUT = "axion-ia.com";

/* ------------------------------------------------------------------ */
/* Temps (mode sans voix)                                              */
/* ------------------------------------------------------------------ */

export const TEMPS_LONGUE = {
  /** Carton de la question, au tout début (dans le chapitre 1). Absent si la question est vide. */
  cartonTitreMs: 4000,
  /** Carton de chapitre, avant la première phrase de CHAQUE chapitre (chapitre 1 compris). */
  cartonChapitreMs: 2500,
  /** Carte de fin « Prendre rendez-vous » (dans le dernier chapitre). */
  finMs: 5000,
  /** Lecture : mots par seconde (même valeur que `MOTS_PAR_SECONDE_LECTURE` et que l'écran). */
  motsParSeconde: 2.6,
  /** Une phrase reste au moins ce temps à l'écran (lecture), respiration non comprise. */
  phraseMinMs: 2000,
  /** Silence de lecture après chaque phrase. */
  respirationMs: 300,
  /** Un chapitre plus court est fusionné avec son voisin (règle YouTube : 10 s). */
  chapitreMinMs: 10_000,
  /** Image sans élément de contenu tolérée au plus. */
  videMaxMs: 1000,
  /** Durée d'une transition d'entrée de scène. */
  transitionMs: 400,
  /** Une ligne de sous-titres reste au moins ce temps. */
  sousTitreMinMs: 1200,
  /** Une scène de contenu dure au moins ce temps (sinon fusion avec la suivante). */
  sceneMinMs: 1600,
} as const;

/* ------------------------------------------------------------------ */
/* Géométrie 16:9                                                      */
/* ------------------------------------------------------------------ */

/** Rectangle en pixels de l'image 1920×1080. */
export interface Rect {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export const ZONES_LONGUE = {
  /** Bande RÉSERVÉE aux sous-titres : aucun élément de scène n'y entre. Cachée pendant les cartons et la fin (aucun sous-titre). */
  bandeSousTitres: { x: 0, y: 900, largeur: 1920, hauteur: 180 },
  /** Où le texte des sous-titres se pose dans la bande (2 lignes au plus). */
  texteSousTitres: { x: 160, y: 916, largeur: 1600, hauteur: 148 },
  /** Zone des scènes de contenu : marges 120 px à gauche et à droite, 80 px en haut, 40 px au-dessus de la bande. */
  scene: { x: 120, y: 80, largeur: 1680, hauteur: 780 },
  /** Zone des cartons et de la fin (image pleine, pas de bande) : marges 120 px / 80 px. */
  plein: { x: 120, y: 80, largeur: 1680, hauteur: 920 },
} as const satisfies Record<string, Rect>;

/** Grille de la zone de scène : 12 colonnes de 118 px, gouttière 24 px (12 × 118 + 11 × 24 = 1680). */
export const GRILLE_LONGUE = { colonnes: 12, colonnePx: 118, gouttierePx: 24 } as const;

/** Tailles de police (px). Les deux planchers sont des règles dures vérifiées par le contrôle. */
export const TAILLES_LONGUE = {
  /** Plancher de tout texte de contenu (scènes ET sous-titres). */
  texteMinPx: 44,
  /** Plancher des étiquettes (« AVANT », « 02 / 04 », « AXION IA ») : 3 mots au plus, en capitales. */
  etiquetteMinPx: 32,
  /** Sous-titres : 56 px (grammaire du lot E), jamais sous `sousTitreMinPx`. */
  sousTitrePx: 56,
  /** Plancher des sous-titres et du repère de chapitre de la bande. */
  sousTitreMinPx: 52,
  sousTitreLignesMax: 2,
  question: 88,
  titreChapitre: 96,
  numeroChapitre: 160,
  chiffre: 220,
  unite: 64,
  phraseCle: 72,
  listeTitre: 60,
  liste: 52,
  etape: 48,
  avantApres: 52,
  finAppel: 72,
  finAdresse: 48,
  etiquette: 32,
} as const;

/** Charte Axion (mêmes valeurs que `PALETTE` de `briques/charte/axion-2026.ts`). Jamais de bleu ni de jaune. */
export const COULEURS_LONGUE = {
  ivoire: "#FAF9F5",
  gris: "#E8E6DC",
  noir: "#141413",
  terracotta: "#B23F16",
  blanc: "#FFFFFF",
  /** Sur fond noir seulement. */
  orange: "#D97757",
  /** Sur fond noir seulement. */
  grisSurNoir: "#B0AEA5",
} as const;
export type CouleurLongue = keyof typeof COULEURS_LONGUE;
export type FondScene = "ivoire" | "noir";

/* ------------------------------------------------------------------ */
/* Story-board                                                         */
/* ------------------------------------------------------------------ */

export type TransitionLongue = "fondu" | "glisse" | "volet" | "aucune";
/** Formes dessinées au trait par la composition (jamais une image). */
export type FormeLongue = "cercle" | "cible" | "horloge" | "calendrier" | "alerte" | "coche" | "fleche" | "graphique" | "liste" | "tableur" | "cloche" | "bouclier";

export interface ChapitreStoryboard {
  id: string;
  /** 1, 2, 3… */
  rang: number;
  /** Vrai titre (jamais « Chapitre n ») : celui du script, sinon tiré de sa première phrase. */
  titre: string;
  debutMs: number;
  finMs: number;
}

interface SceneBase {
  id: string;
  chapitreId: string;
  debutMs: number;
  /** Exclue. Les scènes se suivent sans trou : scenes[i].finMs === scenes[i + 1].debutMs, la dernière finit à `dureeMs`. */
  finMs: number;
  fond: FondScene;
  /** Transition d'entrée (pendant `TEMPS_LONGUE.transitionMs`, la scène précédente sort). */
  entree: TransitionLongue;
}

/** Un élément qui apparaît au moment où sa partie de phrase est lue (temps de la vidéo entière). */
export interface ElementApparition {
  texte: string;
  apparitionMs: number;
  /** Sous-chaîne EXACTE de `texte` mise en terracotta (un nombre, un mot clé), ou null. */
  accent: string | null;
}

export interface SceneCartonTitre extends SceneBase {
  type: "carton-titre";
  /** La question de la vidéo, telle que tapée. */
  question: string;
}

export interface SceneCartonChapitre extends SceneBase {
  type: "carton-chapitre";
  rang: number;
  total: number;
  titre: string;
}

export interface SceneListe extends SceneBase {
  type: "liste";
  /** Ce qui précède « : » dans la phrase (« En haut, trois chiffres »), ou null. */
  titre: string | null;
  /** 2 à 6 éléments, chacun 12 mots au plus. */
  elements: ElementApparition[];
  /** Nombre écrit dans la phrase quand il est ÉGAL au nombre d'éléments (pastille), sinon null. */
  compte: number | null;
}

export interface SceneEtapes extends SceneBase {
  type: "etapes";
  /** Numéro de la première étape de cette scène (une scène porte 3 étapes au plus ; la suivante continue la numérotation). */
  numeroDepart: number;
  elements: ElementApparition[];
}

export interface ChiffreCle {
  valeur: number;
  /** Le nombre tel qu'écrit dans le texte (« douze », « 1 200 », « 12,5 % »). */
  ecrit: string;
  /** Ce que l'écran affiche (« 12 », « 1 200 », « 12,5 % ») : toujours la même valeur que `ecrit`, jamais une autre. */
  affiche: string;
  /** 1 à 3 mots qui suivent le nombre dans le texte (« mois », « articles »), ou "". */
  unite: string;
  apparitionMs: number;
}

export interface SceneChiffre extends SceneBase {
  type: "chiffre";
  /** 1 ou 2 chiffres, tous écrits dans la phrase. */
  chiffres: ChiffreCle[];
  /** Phrase ou partie de phrase qui donne le sens du chiffre (12 mots au plus). */
  contexte: string;
}

export interface SceneAvantApres extends SceneBase {
  type: "avant-apres";
  /** Ce qui disparaît (barré). */
  avant: string;
  /** Ce qui le remplace. */
  apres: string;
  apparitionApresMs: number;
}

export interface ScenePhraseCle extends SceneBase {
  type: "phrase-cle";
  /** 12 mots au plus, tirés de la phrase lue. */
  phrase: string;
  /** Sous-chaîne EXACTE de `phrase` mise en avant, ou null. */
  motCle: string | null;
  forme: FormeLongue;
}

export interface SceneFin extends SceneBase {
  type: "fin";
  /** Rappel de la question, ou null si la vidéo n'en a pas. */
  question: string | null;
  appel: string;
  adresse: string;
}

export type SceneLongue = SceneCartonTitre | SceneCartonChapitre | SceneListe | SceneEtapes | SceneChiffre | SceneAvantApres | ScenePhraseCle | SceneFin;
export type TypeSceneLongue = SceneLongue["type"];

/** Une ligne de sous-titres : une phrase entière, ou une demi-phrase si elle ne tient pas en 2 lignes de 56 px. */
export interface LigneSousTitre {
  texte: string;
  debutMs: number;
  finMs: number;
}

export interface AlerteStoryboard {
  code: "carton-sans-place" | "titre-deduit" | "chapitre-fusionne";
  message: string;
  instantMs?: number;
}

export interface StoryboardVideoLongue {
  version: typeof VERSION_STORYBOARD;
  format: typeof FORMAT_LONGUE;
  /** Durée de la vidéo entière ; la composition dure `Math.round(dureeMs * fps / 1000)` images (même arrondi que `imageDe`). */
  dureeMs: number;
  question: string | null;
  chapitres: ChapitreStoryboard[];
  scenes: SceneLongue[];
  sousTitres: LigneSousTitre[];
  /** Remarques du constructeur (jamais un refus). */
  alertes: AlerteStoryboard[];
}

/** Propriétés de la composition `VideoLongue` : les mêmes, complètes, pour chaque plage. */
export interface ProprietesVideoLongue {
  storyboard: StoryboardVideoLongue;
}

/* ------------------------------------------------------------------ */
/* Entrées du constructeur (formes structurelles, sans import)          */
/* ------------------------------------------------------------------ */

export interface EntreesStoryboard {
  /** `commande.entrees.videoLongue.question` ; null ou vide : pas de carton de titre. */
  question: string | null;
  /** Adresse de la fin ; défaut `ADRESSE_LONGUE_DEFAUT`. */
  adresse?: string;
}

/** Même forme que `MotHorodate` (secondes). */
export interface MotLu {
  mot: string;
  debutSec: number;
  finSec: number;
}

/**
 * Même forme que `ChapitreWeb` (champs lus). Les titres et les bornes viennent D'ICI (chapitres YouTube), les mots de
 * chaque chapitre sont ceux qui commencent dans sa tranche (même règle que `chapitresPourPlan`). Un `libelle` vide ou
 * « Chapitre n » est remplacé par un titre tiré de la première phrase (jamais « Chapitre n » à l'écran).
 */
export interface ChapitreMinute {
  debutSec: number;
  finSec: number;
  libelle: string;
}

export interface TempsStoryboard {
  mots: MotLu[];
  chapitres: ChapitreMinute[];
  dureeSec: number;
}

/** Signature du constructeur PUR (`storyboard.ts`, lot QUALL-2). */
export type ConstruireStoryboard = (entrees: EntreesStoryboard, temps: TempsStoryboard) => StoryboardVideoLongue;

/* ------------------------------------------------------------------ */
/* Géométrie posée (mise en page PURE, partagée par le rendu et le contrôle) */
/* ------------------------------------------------------------------ */

export type NatureElement = "texte" | "forme" | "carte" | "trait" | "disque" | "volet";

/** Un morceau de ligne : texte, et vrai s'il est en couleur d'accent. */
export interface MorceauLigne {
  texte: string;
  accent: boolean;
}

export interface ElementPose {
  id: string;
  nature: NatureElement;
  /** « contenu » compte pour « l'image n'est pas vide » ; « etiquette » a son propre plancher ; « decor » ne compte pas. */
  role: "contenu" | "etiquette" | "decor";
  /** Position À L'INSTANT demandé, animation comprise (une animation ne sort jamais de ce rectangle). */
  rect: Rect;
  opacite: number;
  couleur: CouleurLongue;
  /** Texte : lignes déjà coupées par la mesure Manrope (le rendu ne recoupe pas). */
  lignes?: MorceauLigne[][];
  taillePx?: number;
  graisse?: 500 | 600 | 700 | 800;
  interligne?: number;
  alignement?: "gauche" | "centre";
  couleurAccent?: CouleurLongue;
  /** Forme ou trait : part déjà tracée (0 à 1). */
  forme?: FormeLongue;
  trace?: number;
  epaisseurPx?: number;
  /** Carte, disque, volet. */
  fond?: CouleurLongue;
  rayonPx?: number;
  bordure?: CouleurLongue;
  /** Id de l'élément qui le contient (texte dans une carte) : leur recouvrement n'est pas une collision. */
  dans?: string;
}

/** Mise en page d'une scène à l'instant `tMs` (temps de la vidéo entière). PURE (`mise-en-page.ts`, lot QUALL-3). */
export type PoserScene = (scene: SceneLongue, tMs: number) => ElementPose[];
/** Sous-titre posé dans `ZONES_LONGUE.texteSousTitres` à l'instant `tMs`, ou null. PURE (`mise-en-page.ts`, lot QUALL-3). */
export type PoserSousTitre = (ligne: LigneSousTitre, tMs: number) => ElementPose | null;

/* ------------------------------------------------------------------ */
/* Contrôle objectif (gratuit, sans IA)                                */
/* ------------------------------------------------------------------ */

export type CritereLongue = "lisibilite" | "collisions" | "remplissage" | "hierarchie" | "charte" | "mouvement" | "rythme" | "chapitres" | "fin";

export type CodeControleLongue =
  | "image-vide"
  | "texte-trop-petit"
  | "sous-titre-illisible"
  | "sur-la-bande"
  | "chevauchement"
  | "hors-cadre"
  | "sans-hierarchie"
  | "couleur-hors-charte"
  | "scene-figee"
  | "monotonie"
  | "chapitre-court"
  | "titre-generique"
  | "carton-absent"
  | "fin-absente";

export interface AlerteControleLongue {
  code: CodeControleLongue;
  critere: CritereLongue;
  gravite: "grave" | "moyenne" | "info";
  message: string;
  instantMs?: number;
  sceneId?: string;
}

export interface ControleLongue {
  /** Note /100 qui remplace le 80 en dur du moteur. */
  note: number;
  /** Note /10 de chaque critère. */
  criteres: Record<CritereLongue, number>;
  alertes: AlerteControleLongue[];
}

/** Signature du contrôle PUR (`controle.ts`, lot QUALL-4) : la mise en page est injectée (vraie ou factice dans les tests). */
export type ControlerStoryboard = (sb: StoryboardVideoLongue, poser: { scene: PoserScene; sousTitre: PoserSousTitre }) => ControleLongue;
