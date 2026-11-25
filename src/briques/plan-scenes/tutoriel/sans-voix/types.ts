/**
 * CONTRAT DU TUTORIEL SANS VOIX « COMPOSÉ » (lot qualité 25-11, QUAL-1) — TYPES SEULS, partagés par :
 *  - QUAL-1 `grammaire.ts` / `geometrie.ts` (zones, tailles, éléments posés à chaque instant) ;
 *  - QUAL-2 `src/moteurs/montage-tutoriel-outil/plan-sans-voix.ts` (plan déterministe déduit du script) ;
 *  - QUAL-3 `studio-rendu/compositions/plan-scenes/tutoriel-sans-voix/*` (dessin : ne fait QUE dessiner les éléments) ;
 *  - QUAL-4 `controle-composition.ts` (contrôle objectif : texte trop petit, collision, image vide, hors cadre…).
 * PUR : aucun import (ni `@/`, ni React, ni Remotion) : lu tel quel par les compositions de `studio-rendu`.
 * Unités : millisecondes depuis le début de la vidéo ; pixels de l'image finale (ex. 1080 × 1350 en 4:5).
 * Règle d'or : tout texte affiché est une suite CONTIGUË de mots du script, la phrase titre saisie ou le libellé de fin.
 * Aucun nombre absent du script : les valeurs sont des SQUELETTES (barres sans chiffre).
 */

export const VERSION_SANS_VOIX = "sans-voix-1" as const;

export interface FormatImage {
  largeur: number;
  hauteur: number;
  fps: number;
}

/** Rectangle en pixels de l'image finale. */
export interface RectPx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

/** Plage de mots du script (indices dans `mots`, bornes comprises). */
export interface PlageMots {
  premier: number;
  dernier: number;
}

/** Couleurs de la charte, par NOM (jamais une valeur libre) : ivoire, gris, noir, terracotta ; blanc pour les panneaux ; grisTexte (gris foncé lisible) pour les barres et textes secondaires. */
export type CouleurCharte = "ivoire" | "gris" | "noir" | "terracotta" | "blanc" | "grisTexte";

/* ------------------------------------------------------------------ */
/* Plan composé (sortie de QUAL-2, entrée de la géométrie)             */
/* ------------------------------------------------------------------ */

/** Événements qui CONSTRUISENT l'écran dessiné, calés au mot (`aMs` = instant absolu du mot déclencheur). */
export type EvenementEcran =
  /** Les cartes-chiffres montent une à une ; `libelles` = suites du script nettoyées ; valeur = squelette. */
  | { genre: "cartes-chiffres"; aMs: number; cartes: { libelle: string; aMs: number; source: PlageMots }[] }
  /** Panneau liste : titre (« Articles à commander »), `lignes` squelettes (4 par défaut) qui arrivent en cascade. */
  | { genre: "liste"; aMs: number; titre: string; lignes: number; source: PlageMots }
  /** Les lignes de la liste se réordonnent ; `etiquette` (« Par urgence ») apparaît. */
  | { genre: "tri"; aMs: number; etiquette: string; source: PlageMots }
  /** Curseur qui part d'un coin et vient cliquer la `cible` (toujours un élément existant) au mot `aMs`. */
  | { genre: "clic"; aMs: number; cible: "ligne-1" | "bouton-appel"; source: PlageMots }
  /** Panneau latéral (« Historique ») qui glisse dans la fenêtre ; rubriques apparaissant chacune sur son mot. */
  | { genre: "panneau"; aMs: number; titre: string; rubriques: { libelle: string; aMs: number; source: PlageMots }[]; source: PlageMots }
  /** Notification qui tombe en haut de la fenêtre ; `cartePulse` = index de la carte-chiffre qui pulse (ou absent). */
  | {
      genre: "alerte";
      aMs: number;
      texte: string;
      /** Instant (ms) du mot déclencheur : la notification apparaît là ; avant, depuis `aMs`, l'écran montre la condition. */
      declencheurAMs?: number;
      cartePulse?: number;
      source: PlageMots;
    }
  /** Mise en valeur d'une partie de l'écran (contour terracotta et atténuation du reste ; AUCUN zoom, aucune caméra mobile). */
  | { genre: "focus"; aMs: number; finMs: number; cible: "cartes" | "liste" | "panneau" | "alerte" | "ensemble"; source: PlageMots };

interface BaseScene {
  id: string;
  debutMs: number;
  finMs: number;
  /** Mots du script couverts (littéralité, couverture). */
  mots: PlageMots;
}

export type SceneSansVoix =
  /** Accroche : la phrase titre (ou la 1re phrase), grand texte + filet terracotta qui se trace. */
  | (BaseScene & { genre: "titre"; texte: string; surTitre?: string })
  /** L'écran dessiné persistant (« Tableau de bord ») qui se construit par événements. */
  | (BaseScene & { genre: "ecran"; titreFenetre: string; evenements: EvenementEcran[] })
  /** « en X au lieu de Y » : Y barré (gris) puis X qui monte. */
  | (BaseScene & { genre: "repere"; avant: string; apres: string; barreAMs: number; apresAMs: number })
  /** Question finale + appel : texte de la question puis bouton pilule cliqué par un curseur. */
  | (BaseScene & {
      genre: "appel";
      question?: string;
      bouton: string;
      /** Instant du mot du clic. Le clic réel arrive à min(clicAMs, début de scène + 1,5 s) : jamais avant que le bouton soit là. */
      clicAMs: number;
      /** Libellé de la carte de fin (ex. « axion-ia.com ») : texte PERMIS (comme le libellé de fin), affiché sous le bouton
       *  (≥ 40 px) DÈS L'ENTRÉE de la scène (≤ 600 ms), avant le clic. La scène peut durer jusqu'à la fin de la vidéo (elle absorbe la carte de fin). */
      site?: string;
      /** Nom de marque de la carte de fin (ex. « Axion IA ») : texte PERMIS (comme le libellé de fin), affiché entre le bouton et le
       *  site dès l'entrée de la scène (Manrope ExtraBold noir, ≥ 72 px en portrait, ≥ 56 px en format bas, avec un filet terracotta dessous). FACULTATIF. */
      marque?: string;
    })
  /** Repli générique : le groupe nominal principal de la phrase sur une carte ivoire avec filet (jamais un fond nu). */
  | (BaseScene & { genre: "carte-phrase"; texte: string });

export type GenreScene = SceneSansVoix["genre"];

export interface PlanComposeSansVoix {
  version: typeof VERSION_SANS_VOIX;
  format: FormatImage;
  dureeMs: number;
  /** Centre vertical de la bande des sous-titres, en % de la hauteur (sert aux zones). */
  basPct: number;
  /** Scènes triées, pavant [0, dureeMs] sans trou > 300 ms. */
  scenes: SceneSansVoix[];
}

/* ------------------------------------------------------------------ */
/* Zones (grammaire, QUAL-1)                                            */
/* ------------------------------------------------------------------ */

export interface ZonesSansVoix {
  /** Tout ce qui est dessiné (hors sous-titres) reste DANS ce rectangle. */
  contenu: RectPx;
  /** Bande réservée aux sous-titres : aucune scène n'y entre, jamais. */
  bande: RectPx;
  /** Marge minimale au bord de l'image (px). */
  margeBordPx: number;
}

/* ------------------------------------------------------------------ */
/* Éléments posés à un instant (géométrie → dessin et contrôle)        */
/* ------------------------------------------------------------------ */

export type GenreElement =
  /** Texte : `texte`, `taillePx`, `graisse`, `lignes` déjà coupées. */
  | "texte"
  /** Forme de contenu (panneau, carte, barre squelette, filet, pastille, icône). */
  | "forme"
  /** Pointe du curseur (rect = boîte du curseur ; `pointe` = point cliquant). */
  | "curseur"
  /** Zone cliquable visée par un curseur (ligne de liste, bouton). */
  | "cible";

export interface ElementVisible {
  /** Identifiant STABLE d'une image à l'autre (sert aux transitions et aux tests). */
  id: string;
  genre: GenreElement;
  /** Rectangle final à l'écran (après entrée, caméra et zoom). */
  rect: RectPx;
  /** 0..1 (fondu d'entrée/sortie). Un élément d'opacité < 0,05 n'est pas « visible ». */
  opacite: number;
  /** Profondeur de dessin (croissante = devant). */
  z: number;
  remplissage?: CouleurCharte;
  contour?: CouleurCharte;
  /** Rayon des coins (px). */
  rayonPx?: number;
  /** Ombre douce de carte. */
  ombre?: boolean;
  /** Texte : contenu, lignes coupées, taille effective à l'écran (px), graisse, couleur, alignement. */
  texte?: string;
  lignes?: string[];
  taillePx?: number;
  graisse?: 500 | 600 | 700 | 800;
  couleur?: CouleurCharte;
  alignement?: "gauche" | "centre";
  /** Texte raccourci faute de place (coupé à une FRONTIÈRE DE MOT, fini par « … ») : `texteSource` = texte complet du plan.
   *  Le contrôle de composition doit le signaler ; la mise en page change d'abord de disposition avant de couper. */
  tronque?: true;
  texteSource?: string;
  /** Un mot a été coupé par un trait d'union (césure : « Réapprovi- » « sionnements »). Ne pas confondre avec une coupe du cadre. */
  cesure?: true;
  /** Texte barré (repère « avant ») : part 0..1 du trait terracotta déjà tracé. */
  barre?: number;
  /** Forme « filet » ou barre squelette qui se trace/pousse : part 0..1. */
  progression?: number;
  /** Icône simple dessinée (pas de texte) : cloche d'alerte, point de fenêtre, pastille d'urgence, horloge (historique, avant / après),
   *  et les pictogrammes des cartes-chiffres : « boite » (cube : stock), « seuil » (ligne horizontale et flèche vers le bas : seuil),
   *  « valeur » (pile de pièces, sans « € » ni chiffre).
   *  Pour « horloge » : la petite aiguille (heures) est FIXE à 300° (10 h) ; `progression` (0..1) = angle de la grande aiguille (0 = midi,
   *  1 = un tour) : elle reste TOUJOURS à ≥ 60° de la petite (les deux partent du centre, jamais en ligne droite) ; icônes statiques : 0,25 (3 h). */
  icone?: "cloche" | "point" | "pastille" | "horloge" | "fleche" | "boite" | "seuil" | "valeur";
  /** Curseur : point cliquant et anneau de clic (0..1, 0 = pas de clic). */
  pointe?: { x: number; y: number };
  anneauClic?: number;
  /** Curseur : id de la `cible` visée (obligatoire pour un curseur). */
  cibleId?: string;
  /** Élément de contenu « porteur » (carte, panneau) : ses enfants ont `parentId`. Une carte sans enfant visible = vide. */
  parentId?: string;
  /** QUAL-4 (facultatif) : pièce pleine toile ou forme de repli inventée : seule une vraie sortie de l'image est un défaut (pas la marge de 24 px). */
  bordTolere?: boolean;
  /** QUAL-4 (facultatif) : l'élément est COUPÉ par l'image ou par sa boîte (zoom caméra) : défaut « hors cadre ». */
  coupe?: boolean;
}

/** Tout ce que le dessin et le contrôle lisent à l'instant `tMs`. */
export interface ImageSansVoix {
  tMs: number;
  fond: CouleurCharte;
  elements: ElementVisible[];
}

/* ------------------------------------------------------------------ */
/* Contrôle de composition (QUAL-4)                                     */
/* ------------------------------------------------------------------ */

export type CodeDefautComposition = "TEXTE_TROP_PETIT" | "SOUS_TITRES_RECOUVERTS" | "IMAGE_VIDE" | "HORS_CADRE" | "CURSEUR_SANS_CIBLE" | "CHARTE";

export interface DefautComposition {
  code: CodeDefautComposition;
  gravite: "bloquant" | "a-corriger";
  debutMs: number;
  finMs: number;
  message: string;
  elementId?: string;
}

export interface ResultatControleComposition {
  ok: boolean;
  defauts: DefautComposition[];
  mesures: { textePlusPetitPx: number | null; videMaxMs: number; echantillons: number };
}
