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

// Charte du carrousel continu : jetons nommés (maquette v3). Les trois premiers viennent de CHARTE_CARROUSEL.
export const CHARTE_CONTINU = {
  creme: CHARTE_CARROUSEL.couleurs.creme,
  encre: CHARTE_CARROUSEL.couleurs.encre,
  orange: CHARTE_CARROUSEL.couleurs.orange,
  creme2: "#EDE2D1",
  blancCarte: "#FFFBF4",
  peche: "#F7DCC8",
  orangeClair: "#F08A52",
  orangeLumiere: "#FFA66E",
  orangeProfond: "#C4501F",
  orangeBrule: "#B8481A",
  encreDouce: "#241C15",
  brun: "#3A2D22",
  brunClair: "#52412F",
  brunNuit: "#1D1510",
  nuit: "#0E0905",
  brunPierre: "#5B4B3E",
  abricot: "#FFD2AE",
  rouille: "#8F3410",
  cuivre: "#C9511D",
  ecume: "#FFF4E8",
  rosePeche: "#FDEBDD",
  peau: "#F2C6A2",
  grisTexte: "#51463B",
  sableSombre: "#CDBFAE",
  lin: "#CFC3B1",
} as const;

/** Couleur à `a` (0 à 1) d'opacité : `color-mix` sur transparent. */
export function alpha(couleur: string, a: number): string {
  return `color-mix(in srgb, ${couleur} ${Math.round(a * 1000) / 10}%, transparent)`;
}

/** Dégradé linéaire ; chaque arrêt est une couleur, éventuellement suivie d'une position (« #fff 60% »). */
export function degrade(angle: number, arrets: string[]): string {
  return `linear-gradient(${angle}deg, ${arrets.join(", ")})`;
}

const C = CHARTE_CONTINU;
export const DEGRADES_CONTINU = {
  tuile: {
    o: degrade(145, [C.orangeLumiere, `${C.orange} 58%`, C.orangeBrule]),
    k: degrade(145, [C.brunClair, `${C.brunNuit} 62%`, C.nuit]),
    w: degrade(145, ["#FFFFFF", "#F1E6D6"]),
    p: degrade(145, [C.rosePeche, C.peau]),
    g: degrade(145, [alpha("#FFFFFF", 0.26), alpha("#FFFFFF", 0.06)]),
  },
  carte: {
    o: degrade(150, [C.orangeClair, `${C.orange} 60%`, C.orangeProfond]),
    k: degrade(160, ["#2B2118", "#171009"]),
    pl: degrade(160, ["#FBE9DA", "#F4D2B6"]),
  },
  bouton: degrade(90, [C.orangeClair, C.orange]),
  barre: degrade(180, [alpha(C.orange, 0.34), alpha(C.orange, 0)]),
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
