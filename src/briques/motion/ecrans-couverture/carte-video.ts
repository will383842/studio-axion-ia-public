/**
 * C11-E1 : géométrie PURE de la carte vidéo arrondie sous un titre fixe (aucun React, imports relatifs seulement).
 * Titre fixe en haut (marges de 6 % au moins), carte centrée au ratio de la vidéo, coins arrondis,
 * zone réservée aux sous-titres SOUS la carte (la pièce n'y dessine rien : les sous-titres restent ceux du montage).
 */
import { progres } from "../courbes";
import { DUREES } from "../jetons";

export type RatioVideoCarte = "9:16" | "4:5" | "1:1" | "16:9";
export type RectCarte = { x: number; y: number; w: number; h: number };

const RATIOS: Record<RatioVideoCarte, number> = { "9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1, "16:9": 16 / 9 };

/** Marge de sécurité (part de la largeur et de la hauteur). */
export const MARGE_CARTE = 0.06;
/** Hauteur du titre et de la zone des sous-titres (parts de la hauteur du cadre) ; espace entre blocs. */
const PART_TITRE = 0.14;
const PART_SOUS_TITRES = 0.2;
const PART_ESPACE = 0.03;
/** Rayon des coins : part de la largeur de la carte. */
export const RAYON_CARTE = 0.06;
/** Durée de l'entrée de la carte (s), lue dans la table commune. */
export const DUREE_ENTREE_CARTE = DUREES.entree;
/** Échelle de départ de la carte : entrée douce, sans rebond. */
const ECHELLE_DEPART = 0.94;

export function geometrieCarteVideo(p: {
  largeur: number;
  hauteur: number;
  ratioVideo: RatioVideoCarte;
  titre?: string;
}): { titre: RectCarte | null; carte: RectCarte & { rayon: number }; zoneSousTitres: RectCarte } {
  const { largeur: L, hauteur: H } = p;
  const mx = L * MARGE_CARTE;
  const my = H * MARGE_CARTE;
  const espace = H * PART_ESPACE;
  const aTitre = typeof p.titre === "string" && p.titre.trim() !== "";
  const titre: RectCarte | null = aTitre ? { x: mx, y: my, w: L - 2 * mx, h: H * PART_TITRE } : null;
  const haut = titre ? titre.y + titre.h + espace : my;
  const hSous = H * PART_SOUS_TITRES;
  const zoneSousTitres: RectCarte = { x: mx, y: H - my - hSous, w: L - 2 * mx, h: hSous };
  const bas = zoneSousTitres.y - espace;
  const ratio = RATIOS[p.ratioVideo] ?? RATIOS["9:16"];
  const dispoH = Math.max(0, bas - haut);
  const w = Math.min(L - 2 * mx, dispoH * ratio);
  const h = w / ratio;
  const carte = { x: (L - w) / 2, y: haut + (dispoH - h) / 2, w, h, rayon: w * RAYON_CARTE };
  return { titre, carte, zoneSousTitres };
}

/** Entrée de la carte à l'instant `t` (s) pour un début `debut` (s) : 0 avant, 1 après `DUREE_ENTREE_CARTE`, monotone. */
export function entreeCarte(t: number, debut: number): { echelle: number; opacite: number } {
  const k = progres(t, debut, DUREE_ENTREE_CARTE);
  return { echelle: ECHELLE_DEPART + (1 - ECHELLE_DEPART) * k, opacite: k };
}
