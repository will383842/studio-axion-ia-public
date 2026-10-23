/**
 * ÉCRAN PARTAGÉ PAR FORMAT (lot F1, plan v4 « écran partagé 45/55 »). PUR.
 *  - 9:16 : carte en haut, Will en bas, 50/50 (lot C, inchangé) ;
 *  - 4:5 et 1:1 : carte en haut (45 %), Will en bas (55 %), yeux à 37,5 % de sa partie (cadrage par calque) ;
 *  - 16:9 : côte à côte, carte à GAUCHE (45 %), Will à DROITE (55 %), visage entre 35 et 45 % de sa colonne, compté
 *    depuis le bord extérieur (même règle que « mets-moi à droite » du lot C : il garde de l'air vers la carte).
 * La carte du 16:9 est une carte motion 4:5 plein écran (1080 × 1350, mêmes modèles, même charte, mêmes zones sûres),
 * réduite à 864 × 1080 (même rapport 0,8) : aucun nouveau format de carte, rendu plus fin que l'écran.
 * En 16:9, une carte « plein écran » devient elle aussi un écran partagé côte à côte (Will reste visible).
 */
import type { DispositionCarte } from "@/briques/motion/types";
import type { RatioMotion } from "@/briques/motion/jetons";
import { CADRAGE_CALQUE, sourceYMoitieBasse } from "@/briques/habillage-facecam/cadrage";
import { DIMENSIONS_FACECAM, type RatioFacecam } from "./ratios";

/** Part de la carte dans l'écran partagé : 50 % en 9:16 (lot C), 45 % ailleurs. */
export const PART_CARTE: Record<RatioFacecam, number> = { "9:16": 0.5, "4:5": 0.45, "1:1": 0.45, "16:9": 0.45 };

/** Visage dans la colonne de Will (16:9), compté depuis le bord extérieur : 35 à 45 % (40 % visé). */
export const VISAGE_COLONNE = CADRAGE_CALQUE.visageCote;

export type DispositionEcranPartage =
  | { type: "haut"; hauteurCarte: number; hauteurPersonne: number }
  | { type: "gauche"; largeurCarte: number; largeurPersonne: number };

const pair = (x: number) => Math.round(x / 2) * 2;

/** Géométrie de l'écran partagé d'un format (px). Même arrondi que la brique `composition` et la brique `motion`. */
export function dispositionEcranPartage(ratio: RatioFacecam): DispositionEcranPartage {
  const { largeur: W, hauteur: H } = DIMENSIONS_FACECAM[ratio];
  if (ratio === "16:9") {
    const largeurCarte = pair(W * PART_CARTE[ratio]);
    return { type: "gauche", largeurCarte, largeurPersonne: W - largeurCarte };
  }
  const hauteurCarte = pair(H * PART_CARTE[ratio]);
  return { type: "haut", hauteurCarte, hauteurPersonne: H - hauteurCarte };
}

/** Comment rendre et poser une carte dans un format : mise en page motion à demander, et où elle se pose. */
export interface RenduCarteFormat {
  ratioMotion: RatioMotion;
  dispositionMotion: DispositionCarte;
  posee: "plein-ecran" | "ecran-partage";
}

export function renduCarteFormat(ratio: RatioFacecam, disposition: DispositionCarte): RenduCarteFormat {
  // 16:9 : carte 4:5 plein écran, posée dans la colonne de gauche (plein écran compris).
  if (ratio === "16:9") return { ratioMotion: "4:5", dispositionMotion: "plein-ecran", posee: "ecran-partage" };
  return { ratioMotion: ratio, dispositionMotion: disposition, posee: disposition === "moitie-haute" ? "ecran-partage" : "plein-ecran" };
}

/** Où se place la personne pendant un passage partagé (px de l'image pré-cadrée du format). */
export type PlacementPersonne = { sourceY: number } | { sourceX: number };

/** Air minimal entre la jonction et le haut de la tête (px), en plus de la demi-ligne des sous-titres. */
export const AIR_JONCTION_PX = 8;

/**
 * Placement de la personne d'après ses yeux (px de l'image pré-cadrée) :
 *  - en haut / bas : ligne de l'image qui arrive à la jonction, yeux à 37,5 % de sa partie ; si la tête (plan serré)
 *    monterait alors sous la ligne des sous-titres posée à la jonction, la personne descend juste assez (yeux à
 *    50 % de sa partie au plus), sans jamais couper le menton ;
 *  - côte à côte : colonne de l'image qui arrive au bord gauche de sa colonne, visage à 40 % du bord extérieur.
 * `tete` : haut (cheveux compris) et bas (menton) de la tête la plus grande du passage, en px ; `demiLignePx` :
 * demi-hauteur de la ligne des sous-titres posée à la jonction (0 sans sous-titres).
 */
export function placementPersonne(ratio: RatioFacecam, yeux: { yeuxX: number; yeuxY: number }, tete?: { haut: number; bas: number }, demiLignePx = 0): PlacementPersonne {
  const { largeur: W, hauteur: H } = DIMENSIONS_FACECAM[ratio];
  const d = dispositionEcranPartage(ratio);
  if (d.type === "haut") {
    const vise = sourceYMoitieBasse({ yeuxY: yeux.yeuxY }, H, d.hauteurPersonne);
    if (!tete) return { sourceY: vise };
    const plafond = tete.haut - demiLignePx - AIR_JONCTION_PX;
    const plancher = Math.max(tete.bas - d.hauteurPersonne + 4, yeux.yeuxY - 0.5 * d.hauteurPersonne);
    const y = Math.max(plancher, Math.min(vise, plafond));
    return { sourceY: Math.round(Math.min(Math.max(0, y), H - d.hauteurPersonne)) };
  }
  const part = (VISAGE_COLONNE[0] + VISAGE_COLONNE[1]) / 2;
  const x = yeux.yeuxX - (1 - part) * d.largeurPersonne;
  return { sourceX: Math.round(Math.min(Math.max(0, x), W - d.largeurPersonne)) };
}

/** Rectangle de la carte et de la personne dans l'image finale (px), une fois l'entrée finie. */
export function rectanglesEcranPartage(ratio: RatioFacecam): { carte: { x: number; y: number; largeur: number; hauteur: number }; personne: { x: number; y: number; largeur: number; hauteur: number } } {
  const { largeur: W, hauteur: H } = DIMENSIONS_FACECAM[ratio];
  const d = dispositionEcranPartage(ratio);
  if (d.type === "haut") return { carte: { x: 0, y: 0, largeur: W, hauteur: d.hauteurCarte }, personne: { x: 0, y: d.hauteurCarte, largeur: W, hauteur: d.hauteurPersonne } };
  return { carte: { x: 0, y: 0, largeur: d.largeurCarte, hauteur: H }, personne: { x: d.largeurCarte, y: 0, largeur: d.largeurPersonne, hauteur: H } };
}

/** Un point de l'image pré-cadrée (px), une fois la personne placée : où il arrive dans l'image finale (px). */
export function versImageFinale(ratio: RatioFacecam, placement: PlacementPersonne, p: { x: number; y: number }): { x: number; y: number } {
  const d = dispositionEcranPartage(ratio);
  if (d.type === "haut" && "sourceY" in placement) return { x: p.x, y: p.y - placement.sourceY + d.hauteurCarte };
  if (d.type === "gauche" && "sourceX" in placement) return { x: p.x - placement.sourceX + d.largeurCarte, y: p.y };
  return p;
}
