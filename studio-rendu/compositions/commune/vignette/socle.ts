/**
 * SOCLE DES VIGNETTES AXION V2 (lot 1) — PUR, sans React. Référence visuelle : `docs/vignettes/v2/gabarit/socle.css`.
 * Invariable pour les 12 générateurs : lisere, carré « A », signature (9:16), titre sur 2 lignes, un pavé, 2 ambiances.
 * Charte du 07/11 : ivoire, noir, terracotta, Manrope. Les couleurs viennent UNIQUEMENT des jetons de `charte-video`.
 */
import { COULEURS_VIDEO } from "../../../../src/briques/habillage/charte-video";

export type RatioVignette = "16:9" | "9:16" | "1:1" | "4:5";
export type AmbianceVignette = "encre" | "ivoire";
export type MiseVignette = "m1" | "m2" | "m3";
export const AMBIANCES_VIGNETTE = ["encre", "ivoire"] as const;
export const MISES_VIGNETTE = ["m1", "m2", "m3"] as const;

export interface AmbianceDef {
  fond: string;
  texte: string;
  pave: string;
  paveTexte: string;
  lisere: string;
  /** Contour du titre : ombre encre (encre) ou contour ivoire de 16 px (ivoire). */
  contour: string;
  /** Teinte du voile sous le titre (R, G, B). */
  voile: string;
}

export const AMBIANCES: Readonly<Record<AmbianceVignette, AmbianceDef>> = Object.freeze({
  encre: Object.freeze({
    fond: COULEURS_VIDEO.ecriture, texte: COULEURS_VIDEO.page, pave: COULEURS_VIDEO.soulignement, paveTexte: COULEURS_VIDEO.page,
    lisere: COULEURS_VIDEO.soulignement, contour: COULEURS_VIDEO.ecriture, voile: "20,20,19",
  }),
  ivoire: Object.freeze({
    fond: COULEURS_VIDEO.page, texte: COULEURS_VIDEO.ecriture, pave: COULEURS_VIDEO.soulignement, paveTexte: COULEURS_VIDEO.page,
    lisere: COULEURS_VIDEO.soulignement, contour: COULEURS_VIDEO.page, voile: "250,249,245",
  }),
});

/** Terracotta de la charte (marques, pavé du mot-clé, liseré, carré) et ivoire du « A ». */
export const ORANGE_VIF = COULEURS_VIDEO.soulignement;
export const IVOIRE_CARRE = COULEURS_VIDEO.page;
/** Terracotta en rgba (halo discret) : dérivé du jeton, jamais un autre orange. */
export const TERRACOTTA_RGB = "178,63,22";

export function dimensionsVignette(ratio: RatioVignette): { largeur: number; hauteur: number } {
  if (ratio === "16:9") return { largeur: 1280, hauteur: 720 };
  if (ratio === "9:16") return { largeur: 1080, hauteur: 1920 };
  if (ratio === "1:1") return { largeur: 1080, hauteur: 1080 };
  if (ratio === "4:5") return { largeur: 1080, hauteur: 1350 };
  throw new Error(`Ratio de vignette refusé : ${String(ratio)} (16:9, 9:16, 1:1 ou 4:5).`);
}

export interface Reperes {
  lisere: number;
  carre: { x: number; y: number; taille: number };
  /** « axion-ia.com » collé au carré : verticales seulement. */
  signature: { x: number; y: number } | null;
}

export const REPERES: Readonly<Record<RatioVignette, Reperes>> = Object.freeze({
  "16:9": Object.freeze({ lisere: 16, carre: Object.freeze({ x: 44, y: 36, taille: 62 }), signature: null }),
  "9:16": Object.freeze({ lisere: 22, carre: Object.freeze({ x: 84, y: 456, taille: 86 }), signature: Object.freeze({ x: 190, y: 484 }) }),
  "4:5": Object.freeze({ lisere: 22, carre: Object.freeze({ x: 84, y: 84, taille: 86 }), signature: Object.freeze({ x: 190, y: 112 }) }),
  "1:1": Object.freeze({ lisere: 22, carre: Object.freeze({ x: 84, y: 84, taille: 86 }), signature: Object.freeze({ x: 190, y: 112 }) }),
});

export const ZONES_SURES = Object.freeze({
  "9:16": Object.freeze({ haut: 420, bas: 1500, droite: 940 }),
  "16:9": Object.freeze({ coinDuree: Object.freeze({ largeur: 140, hauteur: 60 }) }),
});

export type EntreeVignette = {
  ratio: RatioVignette;
  ambiance?: AmbianceVignette;
  mise?: MiseVignette;
  instagram?: boolean;
  /** Image pleine de la vidéo (repli sans détourage). */
  image?: string;
  /** Sujet détouré (PNG / WebP). */
  sujet?: string;
  /** Boîte du visage dans le sujet, en parts [x0, y0, x1, y1] de l'image. */
  boiteVisage?: [number, number, number, number];
  couverture?: string;
  motCle?: string;
};

export type ProprietesVignette = EntreeVignette & {
  ambiance: AmbianceVignette;
  mise: MiseVignette;
  instagram: boolean;
  reperes: Reperes;
};

/** Valide et normalise. Instagram : jamais d'image ni de sujet (règle « aucune photo sur Instagram »). PUR. */
export function proprietesVignette(e: EntreeVignette): ProprietesVignette {
  dimensionsVignette(e.ratio);
  const ambiance = e.ambiance && AMBIANCES_VIGNETTE.includes(e.ambiance) ? e.ambiance : "encre";
  const mise = e.mise && MISES_VIGNETTE.includes(e.mise) ? e.mise : "m1";
  const instagram = e.instagram === true;
  if (instagram) {
    if (e.ratio !== "9:16") throw new Error("La vignette Instagram est en 9:16 seulement.");
    if (e.sujet || e.image) throw new Error("La vignette Instagram n'accepte ni image ni sujet.");
  }
  return { ...e, ambiance, mise, instagram, reperes: REPERES[e.ratio] };
}

/** Taille de la composition `VignetteAxion` (`calculateMetadata` de Racine.tsx). */
export function metaVignette(props: { ratio: RatioVignette }): { width: number; height: number } {
  const d = dimensionsVignette(props.ratio);
  return { width: d.largeur, height: d.hauteur };
}
