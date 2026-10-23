/** Outils PURS de la Bibliothèque (groupe B), utilisables côté navigateur. */
import type { TypeElement, ValeurElement } from "@/domaine/types";
import { validerCube } from "@/lib/qc-lut";

export type ValeurSousTitres = Extract<ValeurElement, { type: "style-sous-titres" }>;
export type ValeurHabillage = Extract<ValeurElement, { type: "habillage" }>;

export interface FormatCourt {
  id: string;
  nom: string;
  icone: string;
}

/**
 * Validation locale d'une LUT .cube (mêmes règles que le service d'étalonnage, contrôle `qc` du lot M4), pour un
 * retour immédiat : refus clair si le fichier est cassé, avertissement si la cassure dépasse 0,02.
 */
export function validerCubeLocal(contenu: string): { ok: true; taille: number; avertissement?: string } | { ok: false; erreur: string } {
  const v = validerCube(contenu);
  return v.ok ? { ok: true, taille: v.taille, avertissement: v.avertissement } : v;
}

/** Valeur par défaut d'un nouvel élément, selon son type. */
export function valeurParDefaut(type: TypeElement, extra: { dureeSec?: number; couleurs?: { nom: string; valeur: string }[]; teinte?: string } = {}): ValeurElement {
  switch (type) {
    case "couleurs":
      return { type, couleurs: extra.couleurs ?? [] };
    case "logo":
      return { type, variante: "clair" };
    case "police":
      return { type, famille: "Manrope", usage: "texte" };
    case "lut":
      return { type, formatFichier: "cube", tailleCube: 65, intensiteParDefaut: 70 };
    case "style-sous-titres":
      return { type, police: "Archivo Black", tailleRelative: 1, motsParLigne: 3, casse: "majuscules", animation: "pop", couleurAccent: "orange", position: "centre" };
    case "illustration-image":
    case "illustration-video":
      return { type };
    case "musique":
      return { type, ambiance: "calme", tempoBpm: 100, dureeSec: Math.round(extra.dureeSec ?? 30) };
    case "bruitage":
      return { type, categorie: "transition", dureeSec: Math.max(1, Math.round(extra.dureeSec ?? 1)) };
    case "habillage":
      return { type, intro: false, fin: true, logoAnime: true, grandTitre: true };
    case "style-montage":
      return { type, rythme: "rythme", dureePlanMoyenneSec: 3, zooms: "doux", transitions: "coupe", bruitagesTransitions: true };
    case "profil-son":
      return { type, volumeMusique: 18, baisseSousVoixDb: 12, traitementVoix: "naturel", densiteBruitages: "leger", niveauCibleLufs: -14 };
    case "decor":
      // Décor en teinte unie (ancien « fond ») ; un fichier déposé le fait passer en image (B.0 §6).
      return { type, mode: "teinte", teinte: extra.teinte ?? "", ambiance: "sombre", profondeurFlou: 12, directionLumiere: "gauche", positionSujet: 0.5 };
    case "accessoire":
      return { type, positionParAngle: {}, flouPx: 8, cote: "regard" };
    case "fond":
      return { type, teinte: extra.teinte ?? "" };
  }
}

/** Types qui demandent un fichier à l'ajout, et ce qu'ils acceptent. */
export const FICHIER_PAR_TYPE: Partial<Record<TypeElement, { accepte: string; libelle: string }>> = {
  logo: { accepte: "image/*", libelle: "Déposer le logo" },
  musique: { accepte: "audio/*", libelle: "Déposer la musique" },
  bruitage: { accepte: "audio/*", libelle: "Déposer le bruitage" },
  decor: { accepte: "image/*,video/*", libelle: "Déposer le décor (facultatif)" },
  accessoire: { accepte: "image/png,image/webp", libelle: "Déposer l'image détourée" },
  habillage: { accepte: "image/*,video/*", libelle: "Déposer un aperçu (facultatif)" },
  police: { accepte: ".ttf,.otf,.woff,.woff2", libelle: "Déposer la police (facultatif)" },
};

/** Lit la valeur d'un jeton de couleur (pour proposer une teinte de départ sans couleur écrite en dur). */
export function lireJeton(nom: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(`--${nom}`).trim();
}
