/**
 * Zoom à travers un mot (X1-05). PUR : aucun hook, aucun hasard, aucune horloge, imports relatifs seulement.
 * ÉTEINT : non inscrit à `IDS_TRANSITIONS_COMMUNES` ni à `choix.ts` ; une fiche suivante l'inscrira après planche.
 * Le mot de la scène sortante grossit jusqu'au plein cadre (mot dit, jamais inventé), puis la scène suivante s'ouvre.
 * Jamais avec un visage dans l'une des deux scènes. Au plus une fois par vidéo (`permisDansPlan`). Aucun son.
 */
import { DUREES } from "../jetons";
import { progres } from "../courbes";

export const DUREE_ZOOM_MOT_S = DUREES.entreeLongue;
export const ECHELLE_PLEIN_CADRE = 8;
export const MAX_ZOOM_MOT_PAR_VIDEO = 1;

/** Part de la durée où le mot grossit ; la scène suivante s'ouvre sur la seconde moitié (recouvrement léger). */
const FIN_MOT = 0.65;
const DEBUT_OUVERTURE = 0.45;
const ECHELLE_SCENE_DEPART = 1.15;

export interface ScenesZoomMot {
  visageAvant: boolean;
  visageApres: boolean;
}

export interface EtatZoomMot {
  /** 1 = taille normale du mot, `ECHELLE_PLEIN_CADRE` = plein cadre. */
  echelleMot: number;
  /** Opacité du mot (reste 1 : la scène suivante le recouvre). */
  opaciteMot: number;
  /** 0 = scène suivante masquée, 1 = en place. */
  ouverture: number;
  /** Échelle de la scène suivante : 1,15 → 1. */
  echelleScene: number;
}

const borne = (t: number) => (Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0);

/** Au plus 1 par vidéo : `dejaUtilises` = nombre de zooms déjà placés dans le plan. */
export function permisDansPlan(dejaUtilises: number): boolean {
  return dejaUtilises < MAX_ZOOM_MOT_PAR_VIDEO;
}

/** État à t ∈ [0, 1] (0 = début, 1 = fin) ; `null` (refus) si l'une des deux scènes a un visage. */
export function zoomMot(scenes: ScenesZoomMot, t: number): EtatZoomMot | null {
  if (scenes.visageAvant || scenes.visageApres) return null;
  const x = borne(t);
  const pMot = progres(x, 0, FIN_MOT);
  const pScene = progres(x, DEBUT_OUVERTURE, 1 - DEBUT_OUVERTURE);
  const arrondi = (n: number) => Math.round(n * 1e4) / 1e4;
  return {
    echelleMot: x >= 1 ? ECHELLE_PLEIN_CADRE : x <= 0 ? 1 : arrondi(Math.pow(ECHELLE_PLEIN_CADRE, pMot)),
    opaciteMot: 1,
    ouverture: x >= 1 ? 1 : arrondi(pScene),
    echelleScene: x >= 1 ? 1 : arrondi(ECHELLE_SCENE_DEPART + (1 - ECHELLE_SCENE_DEPART) * pScene),
  };
}

/**
 * FIX-X1-05-a : échelle MAXIMALE pour que le mot ENTIER tienne dans le cadre (largeur du cadre moins deux marges), en pixels.
 * Bornée à `[1, ECHELLE_PLEIN_CADRE]` ; entrée invalide (non finie, mot vide) : 1 (aucun grossissement inventé).
 */
export function echelleMotDansCadre(largeurMot: number, largeurCadre: number, marge: number): number {
  if (![largeurMot, largeurCadre, marge].every(Number.isFinite) || largeurMot <= 0 || marge < 0) return 1;
  const libre = largeurCadre - 2 * marge;
  return Math.min(ECHELLE_PLEIN_CADRE, Math.max(1, libre / largeurMot));
}

/**
 * Comme `zoomMot`, mais tant que le mot est visible (`ouverture < 1`) son échelle ne dépasse pas celle qui le garde ENTIER
 * dans le cadre. `zoomMot` reste inchangé (même signature, mêmes valeurs).
 */
export function zoomMotDansCadre(scenes: ScenesZoomMot, t: number, cadre: { largeurMot: number; largeurCadre: number; marge: number }): EtatZoomMot | null {
  const etat = zoomMot(scenes, t);
  if (!etat || etat.ouverture >= 1) return etat;
  const max = echelleMotDansCadre(cadre.largeurMot, cadre.largeurCadre, cadre.marge);
  return { ...etat, echelleMot: Math.min(etat.echelleMot, max) };
}

/** FIX-ZOOM-MOT-v21u : durée du zoom en trois temps (sortie de la scène, mot seul, entrée de la suivante), tirée de `DUREES`. */
export const DUREE_ZOOM_MOT_SANS_RECOUVREMENT_S = 2 * DUREES.entreeLongue;
/** Opacité (5 %) en dessous de laquelle un élément est tenu pour invisible. */
export const SEUIL_RECOUVREMENT = 0.05;
/** Instant (part de la durée) où tombe la coupe entre les deux scènes : le mot y est SEUL, à pleine opacité. */
export const INSTANT_COUPE = 0.5;

/** Sortie de la scène d'en dessous : [0 ; 0,22]. */
const FIN_SORTIE = 0.22;
/** Le mot monte de 0 à 1 sur [0,22 ; 0,30], reste plein jusqu'à 0,70, redescend sur [0,70 ; 0,78]. */
const FIN_MONTEE_MOT = 0.3;
const DEBUT_DESCENTE_MOT = 0.7;
/** La scène suivante n'arrive qu'après la disparition du mot. */
const DEBUT_ENTREE = 0.78;

export interface EtatZoomMotSansRecouvrement extends EtatZoomMot {
  /** Opacité de la scène qui sort : 1 → 0 avant que le mot n'apparaisse. */
  opaciteSceneAvant: number;
}

/**
 * Zoom sur un mot SANS recouvrement : (1) la scène d'en dessous s'efface, (2) le mot seul grossit (toujours ENTIER dans le cadre),
 * puis s'efface, (3) la scène suivante s'ouvre. Jamais deux de ces éléments visibles (> 5 %) en même temps. `null` si visage.
 * `zoomMot` et `zoomMotDansCadre` restent inchangés.
 */
export function zoomMotSansRecouvrement(scenes: ScenesZoomMot, t: number, cadre: { largeurMot: number; largeurCadre: number; marge: number }): EtatZoomMotSansRecouvrement | null {
  if (scenes.visageAvant || scenes.visageApres) return null;
  const x = borne(t);
  const arrondi = (n: number) => Math.round(n * 1e4) / 1e4;
  const max = echelleMotDansCadre(cadre.largeurMot, cadre.largeurCadre, cadre.marge);
  const pScene = progres(x, DEBUT_ENTREE, 1 - DEBUT_ENTREE);
  const pMot = progres(x, FIN_SORTIE, DEBUT_DESCENTE_MOT - FIN_SORTIE);
  const montee = progres(x, FIN_SORTIE, FIN_MONTEE_MOT - FIN_SORTIE);
  const descente = 1 - progres(x, DEBUT_DESCENTE_MOT, DEBUT_ENTREE - DEBUT_DESCENTE_MOT);
  return {
    echelleMot: x <= 0 ? 1 : Math.floor((1 + (max - 1) * pMot) * 1e4) / 1e4,
    opaciteMot: x >= 1 ? 0 : arrondi(Math.min(montee, descente)),
    ouverture: x >= 1 ? 1 : arrondi(pScene),
    echelleScene: x >= 1 ? 1 : arrondi(ECHELLE_SCENE_DEPART + (1 - ECHELLE_SCENE_DEPART) * pScene),
    opaciteSceneAvant: x <= 0 ? 1 : arrondi(1 - progres(x, 0, FIN_SORTIE)),
  };
}
