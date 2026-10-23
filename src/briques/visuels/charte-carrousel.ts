// Charte graphique des carrousels : `charte-carrousel/1`.
// Couleurs de la charte « charte-carrousel/1 » ; l'orange est réservé aux GRANDS éléments.

export const CHARTE_CARROUSEL = {
  id: "charte-carrousel/1",
  couleurs: {
    creme: "#F8F0E3",
    encre: "#0D0A07",
    orange: "#D9622B",
    orangeFonce: "#B44F29",
    pale: "#F2DFCB",
    // Blanc chaud : fond des cartes impaires (L1), plus clair que la crème de la page.
    blanc: "#FFFCF7",
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
