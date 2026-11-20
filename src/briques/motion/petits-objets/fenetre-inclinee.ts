/**
 * X1-03 — FENÊTRE INCLINÉE EN 3D (CSS). PUR : angle au temps, ≤ 20°, redressé à 0° en `DUREES.entree`.
 * Aucune bibliothèque 3D : seulement `perspective` + `rotateX/rotateY` du CSS. Jamais devant le visage.
 * Imports relatifs seulement (dossier lu par le rendu). Aucun hasard, aucune horloge : même entrée = même image.
 * Ajout pur, ÉTEINT : non inscrit au registre (C9-27) ni à la porte C9-33.
 */
import { createElement, type ReactElement } from "react";
import type { FondAxion } from "../../jetons-motion";
import { OBJET_FENETRE_APP, type ParametresFenetreApp } from "./fenetre-app";
import { progres } from "../courbes";
import { DUREES } from "../jetons";
import { devantLeVisage, type Position } from "../../plan-scenes/zones";

/** Inclinaison maximale d'un axe, en degrés (plafond de la fiche). */
export const ANGLE_MAX = 20;
/** Part de l'angle maximal portée par l'axe Y au départ (l'axe X porte le maximum). */
const PART_Y = 0.6;
/** Perspective CSS, en % de la hauteur du cadre (toile de référence 1000 px → 1500 px). */
export const PERSPECTIVE_POURCENT = 150;
/** Hauteur apparente minimale du plus petit texte, en % du cadre, après projection. */
export const HAUTEUR_TEXTE_MIN_POURCENT = 3;

/** Délai (s) avant le début du redressement : la fenêtre reste inclinée pendant que le contenu apparaît (le tracé du contour dure `DUREES.entree`). */
export const DELAI_INCLINAISON = DUREES.entree;

export interface AngleFenetre {
  rotateX: number;
  rotateY: number;
}

const borne = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** Angle au temps `t` (secondes) : plein au départ, 0 exactement dès `DUREES.entree`. `sens` : +1 ou −1 (côté de l'inclinaison en Y). */
export function angleFenetre(t: number, o: { sens?: number } = {}): AngleFenetre {
  if (!Number.isFinite(t) || t >= DUREES.entree) {
    return t === -Infinity || Number.isNaN(t) ? plein(o.sens) : { rotateX: 0, rotateY: 0 };
  }
  const reste = 1 - progres(Math.max(0, t), 0, DUREES.entree);
  const sens = o.sens !== undefined && o.sens < 0 ? -1 : 1;
  const rx = borne(ANGLE_MAX * reste, 0, ANGLE_MAX);
  const ry = borne(ANGLE_MAX * PART_Y * reste * sens, -ANGLE_MAX, ANGLE_MAX);
  return { rotateX: arrondi(rx), rotateY: arrondi(ry) };
}

function plein(sens?: number): AngleFenetre {
  return { rotateX: ANGLE_MAX, rotateY: ANGLE_MAX * PART_Y * (sens !== undefined && sens < 0 ? -1 : 1) };
}

const arrondi = (n: number): number => Math.round(n * 1000) / 1000 || 0;

/**
 * Hauteur apparente (en % du cadre) d'un texte de `hauteurPourcent` après inclinaison, au pire point :
 * réduction par cos(rotateX) × cos(rotateY), puis perspective au bord le plus reculé de la fenêtre
 * (`etenduePourcent` = plus grande dimension de la fenêtre, en % du cadre).
 */
export function hauteurApparente(hauteurPourcent: number, a: AngleFenetre, etenduePourcent: number): number {
  const rad = (d: number): number => (borne(Math.abs(d), 0, 90) * Math.PI) / 180;
  const rx = rad(a.rotateX);
  const ry = rad(a.rotateY);
  const recul = (Math.max(0, etenduePourcent) / 2) * (Math.sin(rx) + Math.sin(ry));
  const echelle = PERSPECTIVE_POURCENT / (PERSPECTIVE_POURCENT + recul);
  return hauteurPourcent * Math.cos(rx) * Math.cos(ry) * echelle;
}

/** Vrai si la position n'est pas devant le visage (zone `ZONE_VISAGE`). */
export function positionPermise(p: Position): boolean {
  return !devantLeVisage(p);
}

/** Style CSS de l'enveloppe : `perspective` + `transform` (rotateX/rotateY seulement). */
export function styleInclinaison(a: AngleFenetre): { perspective: string; transform: string } {
  return { perspective: `${PERSPECTIVE_POURCENT * 10}px`, transform: `rotateX(${a.rotateX}deg) rotateY(${a.rotateY}deg)` };
}

export interface PropsFenetreInclinee {
  image: number;
  fps: number;
  dureeImages: number;
  fond: FondAxion;
  graine: number;
  parametres: ParametresFenetreApp;
  /** +1 ou −1 : côté de l'inclinaison. */
  sens?: number;
}

/** Vue pure (testable sans Remotion) : enveloppe CSS `perspective` + `rotateX/rotateY` autour de la fenêtre d'application C9-18. */
export function FenetreInclineeVue({ image, fps, dureeImages, fond, graine, parametres, sens }: PropsFenetreInclinee): ReactElement {
  // L'angle est décalé de `DELAI_INCLINAISON` : inclinée ET remplie pendant le redressement. Perspective relative au cadre (cqh).
  const a = angleFenetre(image / fps - DELAI_INCLINAISON, { sens });
  const s = styleInclinaison(a);
  return createElement(
    "div",
    { style: { position: "absolute", inset: 0, containerType: "size", perspective: `${PERSPECTIVE_POURCENT}cqh` } },
    createElement(
      "div",
      { style: { position: "absolute", inset: 0, transform: s.transform, transformOrigin: "50% 50%" } },
      OBJET_FENETRE_APP.Rendu({ image, fps, dureeImages, fond, parametres, ton: "neutre", graine }),
    ),
  );
}
