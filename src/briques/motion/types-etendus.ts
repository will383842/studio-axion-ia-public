/**
 * TYPES DES MODÈLES 7 À 13 de la brique `motion` (lot F2, éléments reportés après la v1). Mêmes principes que
 * `types.ts` : PUR, sans alias « @/ » (lu par Remotion), heures `aSec` RELATIVES AU DÉBUT DE LA CARTE (s), venues de
 * l'aligneur (`calage-etendu.ts`) ; absentes : réparties d'office.
 *
 * Ces modèles s'AJOUTENT aux 6 modèles validés sans toucher à leurs types (`IdModeleMotion` reste les 6 premiers) :
 * `IdModeleMotionTous` = les 13. Un format qui n'utilise que les 6 premiers ne voit aucun changement.
 */
import type { NomIcone } from "./icones";
import type { CarteModele, IdModeleMotion, MiseEnPageCarte } from "./types";

/** Les modèles 7 à 13. */
export type IdModeleMotionEtendu = "graphique" | "icone-mot" | "probleme-solution" | "check-list" | "capture-annotee" | "titre-plein-ecran" | "documentaire";

/** Les 13 modèles du catalogue (6 validés + 7 du lot F2). */
export type IdModeleMotionTous = IdModeleMotion | IdModeleMotionEtendu;

/* ------------------------------------------------------------------ */
/* 7. Graphique                                                          */
/* ------------------------------------------------------------------ */

export type VarianteGraphique = "barres" | "courbe" | "camembert";

export interface DonneesGraphique {
  /** Barres (comparer des quantités), courbe (une évolution dans le temps) ou camembert (des parts d'un tout). */
  variante: VarianteGraphique;
  titre?: string;
  /** Unité commune des valeurs (« h », « % », « clients »). Camembert sans unité : « % ». */
  unite?: string;
  decimales?: number;
  /** 2 à 6 valeurs, dans l'ordre dit ; chacune arrive (et compte) au mot près. */
  series: { libelle: string; valeur: number; aSec?: number }[];
  /** Index de la valeur mise en avant (orange, halo). Absent : la plus grande (barres, camembert) ou la dernière (courbe). */
  miseEnAvant?: number;
  /** Petite note sous le graphique (« par semaine », « source : enquête 2025 »). */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* 8. Icône + mot                                                        */
/* ------------------------------------------------------------------ */

export interface DonneesIconeMot {
  /** Le mot géant (1 à 3 mots). Un mot entre *astérisques* passe en orange ; sans astérisque, tout le mot l'est. */
  mot: string;
  icone: NomIcone;
  /** Petit texte au-dessus (« Un seul mot »). */
  surTitre?: string;
  /** Ce que le mot veut dire (« les tâches répétitives à l'IA »). */
  sousTitre?: string;
  /** Instant où le mot est dit. */
  aSec?: number;
}

/* ------------------------------------------------------------------ */
/* 9. Problème → solution                                                */
/* ------------------------------------------------------------------ */

export interface FaceProblemeSolution {
  titre: string;
  detail?: string;
  icone?: NomIcone;
}

export interface DonneesProblemeSolution {
  probleme: FaceProblemeSolution;
  solution: FaceProblemeSolution;
  /** Étiquettes (« Le problème » / « La solution » par défaut). */
  etiquetteProbleme?: string;
  etiquetteSolution?: string;
  /** Instant de la bascule (le mot qui dit la solution). */
  aSecSolution?: number;
}

/* ------------------------------------------------------------------ */
/* 10. Check-list                                                        */
/* ------------------------------------------------------------------ */

export interface DonneesCheckList {
  titre?: string;
  /** 2 à 6 points ; chaque case se coche quand la voix le dit. */
  elements: { texte: string; aSec?: number }[];
  aSecTitre?: number;
}

/* ------------------------------------------------------------------ */
/* 11. Capture annotée                                                   */
/* ------------------------------------------------------------------ */

export type TypeAnnotation = "cercle" | "fleche" | "surligne" | "cadre";

export interface AnnotationCapture {
  type: TypeAnnotation;
  /** Zone visée, en FRACTIONS de l'image (0 à 1) : coin haut gauche, largeur, hauteur. */
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  /** Étiquette courte posée à côté (« Un clic »). */
  texte?: string;
  aSec?: number;
}

export interface DonneesCaptureAnnotee {
  /** La capture : une image de « Mes images » ou une image du B-roll (adresse lisible par le rendu). */
  image: { src: string; origine: "mes-images" | "broll"; largeur?: number; hauteur?: number; description?: string };
  titre?: string;
  /** 1 à 4 annotations, chacune se dessine au mot près. */
  annotations: AnnotationCapture[];
  /** Zoom de caméra vers l'annotation dite (par défaut : oui). */
  zoom?: boolean;
}

/* ------------------------------------------------------------------ */
/* 12. Titre plein écran (JAMAIS automatique)                            */
/* ------------------------------------------------------------------ */

export interface DonneesTitrePleinEcran {
  /** Le titre, en mots géants empilés qui remplissent l'image. Un mot entre *astérisques* passe en orange. */
  titre: string;
  /** Mot (ou groupe) mis en orange, si le titre n'a pas d'astérisques. */
  motCle?: string;
  /** Numéro de chapitre (« 02 »), en filigrane géant. */
  numero?: string;
  surTitre?: string;
  sousTitre?: string;
}

/* ------------------------------------------------------------------ */
/* 13. Documentaire (carte de reportage : lieu, date, chiffre clé)       */
/* ------------------------------------------------------------------ */

export interface DonneesDocumentaire {
  /** Lieu (« Lyon, Rhône »). Au moins un des trois : lieu, date, chiffre. */
  lieu?: string;
  /** Date (« Mars 2026 »). */
  date?: string;
  /** Chiffre clé qui compte. */
  chiffre?: { valeur: number; unite?: string; libelle: string; decimales?: number };
  /** Une ligne de contexte (« Une PME de 14 salariés »). JAMAIS de nom de personne, JAMAIS de bandeau « nom · marque ». */
  contexte?: string;
  aSec?: number;
}

/* ------------------------------------------------------------------ */
/* Cartes et propriétés                                                  */
/* ------------------------------------------------------------------ */

export interface DonneesParModeleEtendu {
  graphique: DonneesGraphique;
  "icone-mot": DonneesIconeMot;
  "probleme-solution": DonneesProblemeSolution;
  "check-list": DonneesCheckList;
  "capture-annotee": DonneesCaptureAnnotee;
  "titre-plein-ecran": DonneesTitrePleinEcran;
  documentaire: DonneesDocumentaire;
}

/** Une carte d'un modèle 7 à 13, avec ses données. */
export type CarteModeleEtendu = { [K in IdModeleMotionEtendu]: { modele: K; donnees: DonneesParModeleEtendu[K] } }[IdModeleMotionEtendu];

/** Une carte de l'un des 13 modèles. */
export type CarteMotionTous = CarteModele | CarteModeleEtendu;

/** Propriétés d'une composition des modèles 7 à 13 : la carte et sa mise en page (style et placement compris). */
export type ProprietesCarteMotionEtendue = CarteModeleEtendu & MiseEnPageCarte;
