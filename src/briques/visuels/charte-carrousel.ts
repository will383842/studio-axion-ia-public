// Charte graphique des carrousels : `charte-carrousel/1`, branchée sur la charte Axion 2026 (V7-02).
import { PALETTE } from "../charte/axion-2026";

export const CHARTE_CARROUSEL = {
  id: "charte-carrousel/1",
  // Palette Axion 2026 : l'orange (sur noir seulement) ne sert qu'aux grands éléments des pages sombres.
  couleurs: {
    creme: PALETTE.ivoire,
    encre: PALETTE.noir,
    orange: PALETTE.orange,
    orangeFonce: PALETTE.terracotta,
    pale: PALETTE.gris,
    // Cartes impaires (L1) : ivoire, comme la page (plus de blanc chaud hors palette).
    blanc: PALETTE.ivoire,
  },
  // Au-delà de ce corps (px), un texte compte comme « grand » (seuil de 3:1).
  grandTextePx: 40,
  seuils: { normal: 4.5, grand: 3 },
} as const;

const HEX = /^#[0-9A-Fa-f]{6}$/;

function luminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`Couleur invalide : ${hex}`);
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste WCAG 2.x entre deux couleurs #RRGGBB (de 1 à 21). */
export function contrasteWcag(avantPlan: string, fond: string): number {
  const [a, b] = [luminance(avantPlan), luminance(fond)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Vrai si le texte de `taillePx` est lisible : 4,5:1 en texte normal, 3:1 seulement pour un grand texte. */
export function texteLisible(avantPlan: string, fond: string, taillePx: number): boolean {
  const { normal, grand } = CHARTE_CARROUSEL.seuils;
  const seuil = taillePx >= CHARTE_CARROUSEL.grandTextePx ? grand : normal;
  return contrasteWcag(avantPlan, fond) >= seuil;
}
