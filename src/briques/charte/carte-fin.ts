/**
 * CARTE DE FIN AXION (charte 2026) : la SEULE carte sombre d'une vidéo. Page ivoire tout autour, un bloc noir arrondi au
 * centre avec le logo, la marque et l'adresse. Mouvement doux (fondu et glissé court, courbe sans dépassement), 25 i/s.
 * PUR : géométrie et durées calculées depuis les jetons de la charte, sans React ni Remotion.
 */
import { DUREES, ESPACEMENTS, FPS, GRAISSES, PALETTE, RAYONS, SUR_CLAIR, SUR_SOMBRE, images } from "./axion-2026";

export interface PlanCarteFin {
  largeur: number;
  hauteur: number;
  fps: number;
  fondPage: string;
  carte: { x: number; y: number; largeur: number; hauteur: number; rayon: number; fond: string };
  logo: { x: number; y: number; largeur: number; hauteur: number };
  texte: { couleur: string; secondaire: string; accent: string; graisse: number; taillePx: number; y: number };
  entreeImages: number;
  tenueImages: number;
}

/** Rapport largeur/hauteur du fichier du logo (2048 × 1423). */
export const RAPPORT_LOGO = 2048 / 1423;

export function planifierCarteFin(largeur: number, hauteur: number, dureeSec = 3): PlanCarteFin {
  const k = largeur / 1080;
  const marge = ESPACEMENTS.l * k;
  const cl = largeur - 2 * marge;
  const ch = Math.min(hauteur - 2 * marge, cl * 1.1);
  const cx = marge;
  const cy = (hauteur - ch) / 2;
  const lw = cl * 0.78;
  const lh = lw / RAPPORT_LOGO;
  const taille = Math.round(44 * k);
  return {
    largeur,
    hauteur,
    fps: FPS,
    fondPage: SUR_CLAIR.fond,
    carte: { x: cx, y: cy, largeur: cl, hauteur: ch, rayon: RAYONS.carte * k, fond: SUR_SOMBRE.fond },
    logo: { x: cx + (cl - lw) / 2, y: cy + ch * 0.2, largeur: lw, hauteur: lh },
    texte: { couleur: SUR_SOMBRE.texte, secondaire: SUR_SOMBRE.secondaire, accent: PALETTE.orange, graisse: GRAISSES.gras, taillePx: taille, y: cy + ch * 0.2 + lh + ESPACEMENTS.m * k },
    entreeImages: images(DUREES.normale),
    tenueImages: Math.max(images(DUREES.longue), images(dureeSec) - images(DUREES.normale)),
  };
}
