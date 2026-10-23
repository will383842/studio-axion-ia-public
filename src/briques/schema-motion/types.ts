/**
 * MOTION DE SCHÉMA (format « Image → vidéo ») · types purs. PUR, sans React, sans Zod et SANS alias « @/ » : lu tel quel
 * par `studio-rendu` (compositions `image-video/`) et par le moteur. Des `type` (et non des `interface`) : Remotion veut
 * des propriétés indexables.
 *
 * Unités : la toile se mesure en pixels d'un écran vertical 1080 × 1920 vu à l'échelle 1 ; les tailles de texte en
 * fraction de la HAUTEUR de l'écran (comme la charte `charte-duo`) ; les instants en secondes.
 */

import { DIMENSIONS_SCENE } from "../composition/scene";

/** Écran de référence (9:16) : repris de la brique commune `composition/scene`, jamais recopié. */
export const ECRAN_IV = Object.freeze({ ...DIMENSIONS_SCENE["9:16"] });


/*
 * MISE EN PAGE (#224, décision de la direction) : SEULE SOURCE de la bande des sous-titres et de la zone utile, lue par
 * les compositions (`studio-rendu/compositions/image-video/mise-en-page.ts` les ré-exporte) et par le moteur (sous-titres,
 * contrôle Q22). Ici parce que `src/` n'importe jamais `studio-rendu/` (garde-fou `tests/organisation/src-autonome`).
 */

/** Bas de l'en-tête (fraction de la hauteur) : égal à `BAS_ENTETE` de `plan.ts` (un test vérifie l'égalité). */
export const BAS_ENTETE_IV = 0.245;

/**
 * Vitesse de frappe de la recherche (signes par seconde) : SEULE SOURCE, lue par la composition (`planFrappe`,
 * `planFrappeMots` de `plan-objets.ts`) et par le moteur (heures des mots tapés, `mise-en-scene.ts`).
 */
export const VITESSE_FRAPPE = 22;

/**
 * Bande des sous-titres (fractions de la hauteur), LA MÊME pour toutes les versions (décision de la direction) : elle se
 * termine au-dessus de la limite la plus contraignante des réseaux visés, marge comprise. Limites relevées dans le
 * registre `src/reseaux` (zones masquées en 9:16, bas) : Instagram et Facebook 30 % (guide Meta des Reels), TikTok 26 %,
 * YouTube Shorts 20 %, LinkedIn 14 % ; avec la marge de 2 %, le bas permis le plus contraignant est 68 % (Meta). La
 * bande s'arrête à 67 % ; Q22 (`sous-titres.ts`) le vérifie, bloquant, réseau par réseau.
 */
export const BANDE_SOUS_TITRES_IV = Object.freeze({ haut: 0.6, bas: 0.67 });

/** Zone utile sous un en-tête (fractions de la hauteur) : du bas de l'en-tête (+ 2 %) au haut des sous-titres (− 2 %). */
export const ZONE_UTILE_IV = Object.freeze({ haut: BAS_ENTETE_IV + 0.02, bas: BANDE_SOUS_TITRES_IV.haut - 0.02 });

/**
 * Bande où vit le contenu animé d'une toile sans en-tête (fractions de la hauteur) : du haut de l'écran (sous la marque)
 * au bas de la zone utile, donc au-dessus des sous-titres et des zones masquées (§ 5).
 */
export const ZONE_CONTENU_IV = Object.freeze({ haut: 0.09, bas: ZONE_UTILE_IV.bas });

/*
 * MISE EN PAGE PAR FORMAT (lot F45, plans 73 § 3 et 76) : le 9:16 garde EXACTEMENT les valeurs ci-dessus ; le 4:5
 * (1080 × 1350, LinkedIn et fil Facebook) est la mise en page du 9:16 REMONTÉE de `DECALAGE_REFERENCE_4X5_PX` (60 px :
 * en-tête y 199 → 410, repère des chapitres y 94, contenu des moments y 449 → 1054), la marque à y 54 (juste sous les
 * 54 px masqués, au-dessus du repère) et la bande des sous-titres du doc 76 (y 1042 → 1176, au-dessus des 135 px du bas que la barre de lecture recouvre). En 9:16, tout
 * tient déjà entre y 86 et 1286 : le 4:5 perd la place vide du bas, pas de la lisibilité (lettres à la taille du 9:16,
 * `hauteurTexte`). Fractions de la hauteur DU FORMAT.
 */
export type FormatEcranIV = "9:16" | "4:5";

/** Cadre 4:5 en pixels (doc 76) : seule source ici, recopiée par le contrat de variété (`CADRES_IV`, test d'égalité). */
const H45 = 1350;
/** Remontée (px) de l'écran de référence 1080 × 1920 dans le cadre 4:5 (moments, objets, en-tête). */
export const DECALAGE_REFERENCE_4X5_PX = 60;
const BANDE_45 = Object.freeze({ haut: 1042 / H45, bas: 1176 / H45 });
const ENTETE_45 = Object.freeze({ haut: (0.135 * ECRAN_IV.hauteur - DECALAGE_REFERENCE_4X5_PX) / H45, bas: (BAS_ENTETE_IV * ECRAN_IV.hauteur - DECALAGE_REFERENCE_4X5_PX) / H45 });

export interface MiseEnPageFormatIV {
  format: FormatEcranIV;
  largeur: number;
  hauteur: number;
  /** Hauteur de référence des textes (px) : 1920 dans les deux formats (mêmes tailles de lettres qu'en 9:16). */
  hauteurTexte: number;
  /** Haut de la marque (fraction de la hauteur). */
  hautMarque: number;
  /** Remontée (px) de l'écran de référence 1080 × 1920 dans le cadre (0 en 9:16). */
  decalageReference: number;
  /** Haut et bas de l'en-tête (étiquette + titre). */
  entete: { haut: number; bas: number };
  bandeSousTitres: { haut: number; bas: number };
  zoneUtile: { haut: number; bas: number };
  zoneContenu: { haut: number; bas: number };
}

export const MISE_EN_PAGE_IV: Readonly<Record<FormatEcranIV, Readonly<MiseEnPageFormatIV>>> = Object.freeze({
  "9:16": Object.freeze({
    format: "9:16" as const,
    largeur: ECRAN_IV.largeur,
    hauteur: ECRAN_IV.hauteur,
    hauteurTexte: ECRAN_IV.hauteur,
    hautMarque: 0.045,
    decalageReference: 0,
    entete: Object.freeze({ haut: 0.135, bas: BAS_ENTETE_IV }),
    bandeSousTitres: BANDE_SOUS_TITRES_IV,
    zoneUtile: ZONE_UTILE_IV,
    zoneContenu: ZONE_CONTENU_IV,
  }),
  "4:5": Object.freeze({
    format: "4:5" as const,
    largeur: ECRAN_IV.largeur,
    hauteur: H45,
    hauteurTexte: ECRAN_IV.hauteur,
    hautMarque: 54 / H45,
    decalageReference: DECALAGE_REFERENCE_4X5_PX,
    entete: ENTETE_45,
    bandeSousTitres: BANDE_45,
    zoneUtile: Object.freeze({ haut: ENTETE_45.bas + 0.02, bas: BANDE_45.haut - 0.02 }),
    zoneContenu: Object.freeze({ haut: 120 / H45, bas: BANDE_45.haut - 0.02 }),
  }),
});

/** Format d'un écran d'après sa hauteur en pixels (1350 → 4:5 ; tout le reste → 9:16, comme aujourd'hui). */
export function formatDeHauteurIV(hauteur: number): FormatEcranIV {
  return Math.abs(hauteur - H45) < 0.5 ? "4:5" : "9:16";
}

/** Mise en page d'un écran d'après sa hauteur (voir `formatDeHauteurIV`). */
export const miseEnPageDeHauteurIV = (hauteur: number): Readonly<MiseEnPageFormatIV> => MISE_EN_PAGE_IV[formatDeHauteurIV(hauteur)];

/** Un élément (nœud, chiffre, ligne) surgit un peu avant son mot, pour être posé quand il est dit (L7, `TEMPS_IV.avanceNoeud`). */
export const AVANCE_NOEUD_IV = 0.15;

export type CouleurSchema = "orange" | "noir" | "vert" | "neutre";

/**
 * Ce que la disposition lit de la carte de l'image : sous-ensemble structurel de `CarteImage`
 * (`src/domaine/image-video/carte.ts`), recopié ici pour ne rien importer du domaine.
 */
export type NoeudEntree = {
  id: string;
  libelle: string;
  detail?: string;
  role: string;
  couleur: CouleurSchema;
  ordre: number;
  groupe?: string;
  /** Nom d'icône déjà résolu (table `domaine/image-video/icones.ts`) ; sans icône, la carte n'en montre pas. */
  icone?: string;
  /** Libellé COURT (≤ 3 mots) écrit sur le bloc de la scène « Ensemble » ; absent, il est tiré du libellé. */
  court?: string;
};
export type StyleLien = "plein" | "pointille";
export type LienEntree = { id: string; de: string; vers: string; part?: number; couleur: CouleurSchema; etiquette?: string; style?: StyleLien };
export type GroupeEntree = { id: string; sorte: string; titre?: string; noeuds: string[]; majoritaire?: boolean };
export type ChiffreEntree = { brut: string; dansNoeud?: string; aDire: boolean };
export type SchemaEntree = {
  noeuds: NoeudEntree[];
  liens: LienEntree[];
  groupes: GroupeEntree[];
  chiffres?: ChiffreEntree[];
};

/** Un texte posé dans une boîte. */
export type TexteBoite = {
  texte: string;
  role: "libelle" | "detail";
  /** Taille, fraction de la hauteur de l'écran, à l'échelle 1. */
  taille: number;
  /** Lignes estimées après retour à la ligne. */
  lignes: number;
};

/** Un nœud posé sur la toile (coin haut-gauche, pixels de toile). */
export type BoiteNoeud = {
  id: string;
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Profondeur dans le graphe (0 = entrée). */
  couche: number;
  /** Colonne de branche ou de groupe (`null` = tronc commun). */
  colonne: string | null;
  couleur: CouleurSchema;
  textes: TexteBoite[];
};

export type FlecheToile = { id: string; de: string; vers: string; couleur: CouleurSchema; style?: StyleLien };

export type BrancheDisposee = {
  id: string;
  /** 0 = la plus à gauche. */
  rang: number;
  couleur: CouleurSchema;
  majoritaire: boolean;
};

export type DispositionToile = {
  largeur: number;
  hauteur: number;
  boites: BoiteNoeud[];
  fleches: FlecheToile[];
  branches: BrancheDisposee[];
};

/** Pastille de la scène « Ensemble » : aucun texte à lire, au plus un numéro ou un chiffre-clé (≤ 3 mots). */
export type PastilleEnsemble = {
  id: string;
  /** Centre, pixels de l'écran. */
  cx: number;
  cy: number;
  rayon: number;
  /** Boîte du nœud réduite à l'échelle de l'écran (la pastille y est inscrite) : forme possible du dessin, sans texte. */
  cadre: { x: number; y: number; largeur: number; hauteur: number };
  couleur: CouleurSchema;
  allume: boolean;
  /** Numéro de lecture, montré seulement s'il tient au plancher (`taille` ≥ plancher). */
  numero?: { texte: string; taille: number };
};

/** Chiffre-clé écrit en grand dans la scène « Ensemble » (1 à 3). */
export type ChiffreCleEnsemble = { texte: string; x: number; y: number; largeur: number; taille: number };

export type DispositionEnsemble = {
  largeur: number;
  hauteur: number;
  pastilles: PastilleEnsemble[];
  fleches: FlecheToile[];
  chiffresCles: ChiffreCleEnsemble[];
};

/** Heure à laquelle la voix dit le mot d'un nœud. */
export type MotParle = { noeud: string; t: number };

/** Pose de la caméra : centre visé sur la toile et zoom. */
export type PoseCamera = { cx: number; cy: number; zoom: number };

/** Image clé : entre deux images clés, la caméra suit une courbe douce. Deux poses égales = maintien. */
export type ImageCleCamera = PoseCamera & { t: number };

export type TrajectoireCamera = {
  images: ImageCleCamera[];
  /** Mots où la caméra n'a pas pu arriver à temps sans dépasser sa vitesse (une phrase chacun). */
  alertes: string[];
};

/* ------------------------------------------------------------------ */
/* Propriétés de la composition `ImageVideoScene` (studio-rendu)        */
/* ------------------------------------------------------------------ */

/** En-tête fixe d'un moment (charte v4) : étiquette espacée + titre Anton, `*mot*` en orange (un seul). */
export type EnteteSceneIV = { debut: number; fin: number; etiquette: string; titre: string };

/** Scène « Ensemble » (K21) posée entre `debut` et `fin` (≤ 1,5 s) : la toile laisse place au schéma réduit. */
export type EnsembleSceneIV = { debut: number; fin: number; allumes?: string[]; chiffresCles?: string[] };

/**
 * Une séquence continue sur la toile : le schéma (disposé au rendu par `disposerToile`, pur et déterministe), les
 * heures des mots (la caméra et l'apparition des nœuds en découlent), les séparations (embranchement qui se déploie),
 * les coches. Instants en secondes depuis le début de la séquence.
 */
export type ProprietesSceneIV = {
  largeur: number;
  hauteur: number;
  fps: number;
  dureeSec: number;
  fond: "ivoire" | "sombre";
  /** La marque, comme les écrans v4. */
  marque: "axion-ia.com";
  schema: SchemaEntree;
  mots: MotParle[];
  /** Heure où le fil se sépare au nœud de décision (`noeud` = la décision). */
  separations?: MotParle[];
  /** Heure de la coche verte d'un nœud (« fait »). */
  coches?: MotParle[];
  entetes?: EnteteSceneIV[];
  ensembles?: EnsembleSceneIV[];
  /** La caméra coupe franc quand un panoramique arriverait après le mot (`CadrageCamera.coupeFranche`). */
  coupeFranche?: true;
};
