// Charte graphique des carrousels : `charte-carrousel/1`.
// Toutes les couleurs viennent de PALETTE (charte Axion 2026) : aucun hex en dur ici.
// L'orange #D97757 est réservé aux fonds noirs et aux GRANDS éléments.
import { PALETTE as P } from "../charte/axion-2026";

export const CHARTE_CARROUSEL = {
  id: "charte-carrousel/1",
  couleurs: {
    creme: P.ivoire,
    encre: P.noir,
    orange: P.orange,
    orangeFonce: P.terracotta,
    pale: P.gris,
    // Blanc pur : fond des cartes impaires (L1), plus clair que l'ivoire de la page.
    blanc: P.blanc,
  },
  // Au-delà de ce corps (px), un texte compte comme « grand » (seuil de 3:1).
  grandTextePx: 40,
  seuils: { normal: 4.5, grand: 3 },
} as const;

// Charte du carrousel continu : jetons nommés (maquette v3), tous rattachés à un rôle de PALETTE.
// Les noms historiques restent (importés par continu/commun) ; seules les valeurs changent.
export const CHARTE_CONTINU = {
  creme: CHARTE_CARROUSEL.couleurs.creme,
  encre: CHARTE_CARROUSEL.couleurs.encre,
  orange: CHARTE_CARROUSEL.couleurs.orange,
  creme2: P.gris,
  blancCarte: P.blanc,
  peche: P.gris,
  orangeClair: P.orange,
  orangeLumiere: P.orange,
  orangeProfond: P.terracotta,
  orangeBrule: P.terracotta,
  encreDouce: P.noir,
  brun: P.noir,
  brunClair: P.texteSecondaire,
  brunNuit: P.noir,
  nuit: P.noir,
  brunPierre: P.texteSecondaire,
  abricot: P.gris,
  rouille: P.survol,
  cuivre: P.terracotta,
  ecume: P.ivoire,
  rosePeche: P.gris,
  peau: P.gris,
  grisTexte: P.texteSecondaire,
  sableSombre: P.grisSurNoir,
  lin: P.gris,
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
/**
 * Fonds du carrousel continu : AUCUN dégradé, un aplat de PALETTE par clé (mêmes clés qu'avant, valeurs utilisables
 * telles quelles en `background`). Le dégradé de `barre` devient un aplat transparent.
 * Variante `w` des tuiles : noir (l'icône `orange` y est lisible, 5,90 ; sur blanc elle ne ferait que 2,96).
 */
export const DEGRADES_CONTINU = {
  tuile: {
    o: C.orangeProfond,
    k: C.nuit,
    w: C.encre,
    p: C.peche,
    g: alpha(C.creme, 0.12),
  },
  carte: {
    o: C.orange,
    k: C.nuit,
    pl: C.peche,
  },
  bouton: C.orange,
  barre: "transparent",
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
