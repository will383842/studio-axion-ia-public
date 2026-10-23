/**
 * TYPES DU TABLEAU ANIMÉ (tâche TB-05 ; brique `tableau-scene`, lue par le rendu et par le studio). Les compositions n'importent RIEN de `src/moteurs/` : les données
 * arrivent par les propriétés. Les types utiles sont RECOPIÉS ici (formes de `src/moteurs/montage-tableau/fiche.ts`,
 * `mise-en-page.ts` et `calage.ts`, version `mise-en-page-tableau/2`) ; un test vérifie qu'ils restent compatibles.
 */

import type { EcranPlace, EtapeBarre, GeometrieV2, MiseEnPageV2, MotDitV2 } from "./v2/types";
import type { DecorGabarit, MiseEnPageReference, ProprietesReference } from "./reference/types";
import type { ElementTableauPlace } from "./trois-styles/types";

/* ------------------------------------------------------------------ */
/* Recopiés de la fiche (`fiche.ts`)                                     */
/* ------------------------------------------------------------------ */

export type Marque = "souligne" | "entoure" | "barre" | "surligne";
export type Cote = "gauche" | "droite" | "centre";
export type Geste = "souligner" | "entourer" | "barrer" | "cocher" | "pointer";
/** `ecran` et `item` : style « blocs/2 » (un écran, un élément de sa liste). */
export type TypeElementPlace = "ligne" | "dessin" | "chiffre" | "preuve" | "mention" | "ecran" | "item";

/* ------------------------------------------------------------------ */
/* Recopiés de la mise en page (`mise-en-page.ts`)                       */
/* ------------------------------------------------------------------ */

export interface RectPx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface Rect {
  px: RectPx;
  fraction: RectPx;
}

export type NiveauMise = "titre" | "corps" | "legende";
export type TonPreuve = "avant" | "apres";

export interface LigneVisuelle extends Rect {
  texte: string;
  colonne?: TonPreuve;
  ton?: TonPreuve;
}

/** Bulle de preuve réservée par la mise en page (`mise-en-page-tableau/2`). */
export interface BullePlacee {
  phrase: LigneVisuelle[];
  zonePhrase: Rect;
  rangeesPhrase: number;
  etiquettes: LigneVisuelle[];
  date: LigneVisuelle;
  tailleLegende: number;
  separateur?: { x: number; y: number; hauteur: number };
  queue: Rect;
  cercle?: Rect;
}

export interface ElementPlace extends Rect {
  elementId: string;
  sceneId: string;
  type: TypeElementPlace;
  ordre: number;
  niveau?: NiveauMise;
  taillePx?: number;
  couleurTexte?: string;
  couleurFond?: string;
  lignes: LigneVisuelle[];
  role?: string;
  marque?: Marque;
  importants?: string[];
  dessinId?: string;
  cote?: Cote;
  deuxColonnes?: boolean;
  bulle?: BullePlacee;
  /** Élément et ses marques (absent d'une mise en page `mise-en-page-tableau/1`). */
  encombrement?: Rect;
  /** Style « reference/1 » : le bloc de texte auquel un dessin est rattaché (un dessin par idée). */
  rattache?: string;  /** Style « reference/2 » : ce que le gabarit de page pose autour de l'élément (repère, pastille, filet, étiquette…). */
  gabarit?: DecorGabarit;
  /** Style « reference/2 » : couleur et épaisseur (px) de la marque, quand elles diffèrent du texte (titre souligné). */
  couleurMarque?: string;
  epaisseurMarque?: number;
  /** Trois styles du tableau (16/10/2026) : polices manuscrites, traits avant et après le texte, objets posés. */
  tableau?: ElementTableauPlace;
}

export interface GestePlace {
  elementId: string;
  sceneId: string;
  geste: Geste;
  cibleId: string;
  cible: Rect;
  zone?: Rect;
  ordre: number;
}

export interface PagePlacee {
  page: number;
  echelle: number;
  occupation?: number;
  gestesSerres?: true;
  elements: ElementPlace[];
  gestes: GestePlace[];
}

/** Sortie de `mettreEnPage` (seuls les champs lus par le rendu). */
export interface MiseEnPageTableau {
  version: string;
  largeurPx: number;
  hauteurPx: number;
  /** Image de référence des tailles (formats de sortie autres que le 9:16) ; absente : l'image elle-même. */
  reference?: { largeur: number; hauteur: number };
  zoneSure: Rect;
  bandeSousTitres: Rect;
  cadre: Rect;
  pages: PagePlacee[];
  /** Style « blocs/2 » : géométrie, écrans posés, étapes (absent : style d'avant). */
  styleV2?: MiseEnPageV2;
  /** Style « reference/1 » : signature, blocs ajoutés par la fin (absent : un autre style). */
  styleReference?: MiseEnPageReference;
}

/* ------------------------------------------------------------------ */
/* Recopiés du calage (`calage.ts`) et de la fiche calée                  */
/* ------------------------------------------------------------------ */

export interface ElementCale {
  elementId: string;
  sceneId: string;
  debutMs: number;
}

/** Ce que le rendu lit d'une scène de la fiche calée. */
export interface SceneCalee {
  id: string;
  page: number;
  role?: string;
  debutMs?: number;
  finMs?: number;
}

/* ------------------------------------------------------------------ */
/* Propriétés des compositions                                           */
/* ------------------------------------------------------------------ */

export const VERSION_TABLEAU_SCENE = "tableau-scene/1";

/** Phrase testée et date du test d'une bulle de preuve (matière « demonstration » ou `Preuve`). */
export interface ContenuPreuve {
  /** Phrase testée, telle qu'elle a été tapée. */
  phrase: string;
  /** Date du test, AAAA-MM-JJ (`source.date`). */
  testeLe: string;
}

/**
 * Propriétés de `TableauScene` : UNE scène, rendue seule (sans son ni sous-titres), 25 i/s, aux dimensions de la mise
 * en page (1080 × 1920 par défaut ; ou un autre format de sortie : `DIMENSIONS_SCENES`).
 * Durée = `scene.finMs − scene.debutMs`. Un `type` (et non une `interface`) : Remotion veut des propriétés indexables.
 */
export type ProprietesTableauScene = {
  version: typeof VERSION_TABLEAU_SCENE;
  largeur: number;
  hauteur: number;
  /**
   * Image de référence des tailles du style (hauteur du crayon, épaisseur des traits) quand elle diffère de l'image
   * (formats de sortie autres que le 9:16). Absente : l'image elle-même, comme avant.
   */
  reference?: { largeur: number; hauteur: number };
  fps: number;
  /** Identifiant du stylo (« crayon/1 »), figé dans la fiche. */
  stylo: string;
  scene: {
    id: string;
    page: number;
    debutMs: number;
    finMs: number;
    /** Première scène de la vidéo : ce qui part à l'heure 0 (l'accroche) est visible dès la première image. */
    premiere: boolean;
  };
  /** Cadre d'écriture et bande des sous-titres (mise en page). */
  cadre: Rect;
  zoneSure: Rect;
  bandeSousTitres: Rect;
  /** Mise en page de la page ENTIÈRE (toutes ses scènes). */
  page: PagePlacee;
  /** Heures de début (ms, horloge de la vidéo) des éléments DE CETTE SCÈNE (gestes compris). */
  heures: ElementCale[];
  /** Éléments (et gestes) déjà écrits par les scènes précédentes de la même page : là dès la première image. */
  dejaEcrits: string[];
  /** Page qui précède, pleine, quand cette scène ouvre une nouvelle page : elle glisse d'un geste du crayon. */
  pagePrecedente: PagePlacee | null;
  /** Mots importants par élément (en noir, soulignés d'orange). */
  importants: Record<string, string[]>;
  /** Phrase testée et date, par élément « preuve ». */
  preuves: Record<string, ContenuPreuve>;
  /** Style « blocs/2 » : écrans de la scène (absent : la page écrite d'avant). */
  v2?: ProprietesV2;
  /** Style « reference/1 » : la page blanche écrite au crayon (absent : un autre style). */
  styleReference?: ProprietesReference;
};

/** Ce qu'une scène du style « blocs/2 » reçoit en plus. */
export type ProprietesV2 = {
  style: "blocs/2";
  geometrie: GeometrieV2;
  /** Écrans montrés pendant la scène, dans l'ordre ; le premier peut être celui d'avant (sous le balayage). */
  ecrans: EcranPlace[];
  /** Début et fin (ms, horloge de la vidéo) de chaque écran. */
  temps: Record<string, { debutMs: number; finMs: number }>;
  /** Heures (ms) des sources de ces écrans : éléments, éléments de liste, écrans. */
  heures: Record<string, number>;
  etapes: EtapeBarre[];
  /** Fin de la voix (signature en grand, sous-titres effacés) et fin de la vidéo (fondu de l'image). */
  finVoixMs: number;
  finVideoMs: number;
  /**
   * Fil de progression d'une scène propre à un vertical dont la fin diffère (TikTok et Shorts) : il repart de la part
   * atteinte dans la vidéo de référence à `ms` (`partFilV2`). Absent : `t` ÷ `finVoixMs`.
   */
  filDepart?: { ms: number; part: number };
  /** Mots dits de la scène (si fournis) : sous-titres mot à mot dans leur pastille, heure des mots forts. */
  mots?: MotDitV2[];
};
