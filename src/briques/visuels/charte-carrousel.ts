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
  /** Accent des fonds ivoire, blanc et gris (contrastes 5,51 / 5,81 / 4,64). */
  accentClair: P.terracotta,
  /** Accent du fond NOIR SEULEMENT (5,90) ; sur ivoire 2,96 et sur gris 2,50 : interdit. */
  accentSombre: P.orange,
  // Clés historiques : alias de accentSombre, noir seulement.
  orange: P.orange,
  creme2: P.gris,
  blancCarte: P.blanc,
  peche: P.gris,
  orangeClair: P.orange, // noir seulement
  orangeLumiere: P.orange, // noir seulement
  orangeProfond: P.terracotta,
  orangeBrule: P.terracotta,
  encreDouce: P.noir,
  brun: P.texteSecondaire, // décor seulement, jamais en texte
  brunClair: P.texteSecondaire, // décor seulement, jamais en texte
  brunNuit: P.noir,
  nuit: P.noir,
  brunPierre: P.texteSecondaire, // décor seulement, jamais en texte
  abricot: P.gris,
  rouille: P.terracotta, // la valeur de survol est la décision D5 (ouverte) : non employée
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
 * Tuiles : `k` noir (icône accentSombre) et `w` blanche (icône accentClair) sont distinctes.
 */
export const DEGRADES_CONTINU = {
  tuile: {
    o: C.accentClair,
    k: C.nuit,
    w: C.blancCarte,
    p: C.peche,
    g: alpha(C.creme, 0.12),
  },
  carte: {
    o: C.accentClair,
    k: C.nuit,
    pl: C.peche,
  },
  bouton: C.accentClair,
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
