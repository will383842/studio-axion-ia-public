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
import { ZONE_VISAGE, devantLeVisage, seChevauchent, type Position, type Rectangle } from "../../plan-scenes/zones";

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
  /** FIX-FENETRE-INCLINEE-v21u : boîte de pose, en % du cadre (voir `placerFenetreInclinee`). Absente : toute l'image, comme avant. */
  boite?: Rectangle;
}

/** Vue pure (testable sans Remotion) : enveloppe CSS `perspective` + `rotateX/rotateY` autour de la fenêtre d'application C9-18. */
export function FenetreInclineeVue({ image, fps, dureeImages, fond, graine, parametres, sens, boite }: PropsFenetreInclinee): ReactElement {
  // L'angle est décalé de `DELAI_INCLINAISON` : inclinée ET remplie pendant le redressement. Perspective relative au cadre (cqh).
  const a = angleFenetre(image / fps - DELAI_INCLINAISON, { sens });
  const s = styleInclinaison(a);
  // Trois niveaux : la racine est le conteneur de requête (`container-type: size`), la perspective (cqh) est posée sur son ENFANT
  // (un élément ne peut pas être son propre conteneur : sinon 150cqh se résoudrait contre un ancêtre), la rotation sur le petit-enfant.
  return createElement(
    "div",
    { style: boite ? { position: "absolute", left: `${boite.x}%`, top: `${boite.y}%`, width: `${boite.largeur}%`, height: `${boite.hauteur}%`, containerType: "size" } : { position: "absolute", inset: 0, containerType: "size" } },
    createElement(
      "div",
      { style: { position: "absolute", inset: 0, perspective: `${PERSPECTIVE_POURCENT}cqh` } },
      createElement(
        "div",
        { style: { position: "absolute", inset: 0, transform: s.transform, transformOrigin: "50% 50%" } },
        OBJET_FENETRE_APP.Rendu({ image, fps, dureeImages, fond, parametres, ton: "neutre", graine }),
      ),
    ),
  );
}

/** Part ajoutée de chaque côté de la fenêtre à plat : couvre le débord de la perspective à 20° (vérifié au pire angle, voir le test). */
export const MARGE_INCLINAISON = 0.06;
/** Largeur dessinée minimale de la fenêtre, en % de la largeur du cadre (en dessous, son titre n'est plus lisible). */
export const LARGEUR_MIN_POURCENT = 40;
/** Zone où une fenêtre peut se poser (en % du cadre). */
const CADRE_UTILE: Rectangle = { x: 5, y: 3, largeur: 90, hauteur: 94 };
/** Part minimale de la pièce remplacée que la boîte doit couvrir. */
const COUVERTURE_REMPLACEMENT = 0.5;

type Cadre = { largeur: number; hauteur: number };

function fenetreAPlat(boite: Rectangle, parametres: ParametresFenetreApp, cadre: Cadre): Rectangle {
  // Toile 1000 × 1000 « meet » dans la boîte, centrée ; fenêtre centrée de largeur × hauteur % de la toile (comme `fenetre-app.tsx`).
  const bl = (boite.largeur * cadre.largeur) / 100;
  const bh = (boite.hauteur * cadre.hauteur) / 100;
  const cote = Math.min(bl, bh);
  const w = (parametres.largeur / 100) * cote;
  const h = (parametres.hauteur / 100) * cote;
  const cx = (boite.x * cadre.largeur) / 100 + bl / 2;
  const cy = (boite.y * cadre.hauteur) / 100 + bh / 2;
  return { x: ((cx - w / 2) / cadre.largeur) * 100, y: ((cy - h / 2) / cadre.hauteur) * 100, largeur: (w / cadre.largeur) * 100, hauteur: (h / cadre.hauteur) * 100 };
}

/** Fenêtre réellement dessinée dans `boite` (en % du cadre), élargie de `MARGE_INCLINAISON` de chaque côté. */
export function boiteFenetreDessinee(boite: Rectangle, parametres: ParametresFenetreApp, cadre: Cadre): Rectangle {
  const f = fenetreAPlat(boite, parametres, cadre);
  const mx = f.largeur * MARGE_INCLINAISON;
  const my = f.hauteur * MARGE_INCLINAISON;
  return { x: f.x - mx, y: f.y - my, largeur: f.largeur + 2 * mx, hauteur: f.hauteur + 2 * my };
}

/** Plus grand rectangle (aire) aligné sur les axes, dans `cadreUtile`, qui ne chevauche aucun obstacle. Pur, sans hasard. */
export function plusGrandRectangleLibre(obstacles: readonly Rectangle[], cadreUtile: Rectangle = CADRE_UTILE): Rectangle | null {
  const dans = (v: number, a: number, b: number): boolean => v > a && v < b;
  const xs = new Set<number>([cadreUtile.x, cadreUtile.x + cadreUtile.largeur]);
  const ys = new Set<number>([cadreUtile.y, cadreUtile.y + cadreUtile.hauteur]);
  for (const o of obstacles) {
    for (const v of [o.x, o.x + o.largeur]) if (dans(v, cadreUtile.x, cadreUtile.x + cadreUtile.largeur)) xs.add(v);
    for (const v of [o.y, o.y + o.hauteur]) if (dans(v, cadreUtile.y, cadreUtile.y + cadreUtile.hauteur)) ys.add(v);
  }
  const X = [...xs].sort((a, b) => a - b);
  const Y = [...ys].sort((a, b) => a - b);
  let meilleur: Rectangle | null = null;
  let aire = 0;
  for (let i = 0; i < X.length; i++)
    for (let j = i + 1; j < X.length; j++)
      for (let k = 0; k < Y.length; k++)
        for (let l = k + 1; l < Y.length; l++) {
          const r: Rectangle = { x: X[i], y: Y[k], largeur: X[j] - X[i], hauteur: Y[l] - Y[k] };
          const a = r.largeur * r.hauteur;
          if (a <= aire + 1e-9) continue;
          if (obstacles.some((o) => seChevauchent(r, o))) continue;
          meilleur = r;
          aire = a;
        }
  return meilleur;
}

/**
 * FIX-FENETRE-INCLINEE-v21u — où poser la fenêtre (tout en % du cadre). PUR.
 * a) dans la plus grande zone libre (hors pièces, sous-titres et, si `visage`, `ZONE_VISAGE`) ;
 * b) sinon À LA PLACE d'une pièce (de la plus grande à la plus petite) : CONTRAT : l'appelant n'affiche plus la pièce `remplace` tant que la fenêtre est là ;
 * c) sinon `null` : la fenêtre n'est pas posée. Jamais sur un sous-titre.
 */
export function placerFenetreInclinee(o: { parametres: ParametresFenetreApp; occupees: readonly Rectangle[]; sousTitres: readonly Rectangle[]; visage?: boolean; cadre: Cadre }): { boite: Rectangle; remplace: number | null } | null {
  const fixes: Rectangle[] = [...o.sousTitres, ...(o.visage ? [ZONE_VISAGE] : [])];
  const assezLarge = (b: Rectangle): boolean => fenetreAPlat(b, o.parametres, o.cadre).largeur >= LARGEUR_MIN_POURCENT;
  const libre = plusGrandRectangleLibre([...o.occupees, ...fixes]);
  if (libre && assezLarge(libre)) return { boite: libre, remplace: null };
  const ordre = o.occupees.map((r, i) => ({ r, i })).sort((a, b) => b.r.largeur * b.r.hauteur - a.r.largeur * a.r.hauteur || a.i - b.i);
  for (const { r, i } of ordre) {
    const boite = plusGrandRectangleLibre([...o.occupees.filter((_, k) => k !== i), ...fixes]);
    if (!boite || !assezLarge(boite)) continue;
    const x = Math.max(0, Math.min(boite.x + boite.largeur, r.x + r.largeur) - Math.max(boite.x, r.x));
    const y = Math.max(0, Math.min(boite.y + boite.hauteur, r.y + r.hauteur) - Math.max(boite.y, r.y));
    if (x * y >= COUVERTURE_REMPLACEMENT * r.largeur * r.hauteur) return { boite, remplace: i };
  }
  return null;
}
