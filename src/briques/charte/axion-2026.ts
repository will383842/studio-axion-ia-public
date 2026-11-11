/**
 * Charte Axion 2026 : source unique des couleurs, de la police et des règles de contraste du Studio.
 * Module PUR : aucun import. Branché par le lot B : seule référence des couleurs, polices, durées et courbes des vidéos.
 * Règles : orange et gris #B0AEA5 sur noir seulement ; terracotta jamais en texte sur noir ; ni bleu, ni jaune, ni dégradé.
 */

export const PALETTE = {
  ivoire: "#FAF9F5",
  gris: "#E8E6DC",
  noir: "#141413",
  terracotta: "#B23F16",
  /** Sur noir seulement. */
  orange: "#D97757",
  /** Sur noir seulement. */
  grisSurNoir: "#B0AEA5",
  /** État « réussite » seulement, jamais en accent. */
  reussite: "#5E7050",
  /** Blanc pur : cartes sur ivoire, texte sur terracotta ou survol. */
  blanc: "#FFFFFF",
  /** Survol et attention (à confirmer par Williams). Texte blanc dessus ; jamais sur noir. */
  survol: "#8F3412",
  /** Texte secondaire sur ivoire ou gris. */
  texteSecondaire: "#5E5D59",
  /** Filet d'erreur ; le texte d'erreur reste noir. */
  erreurFilet: "#B8341C",
} as const;

/** Police unique. */
export const POLICE = "Manrope";

export type Fond = "clair" | "sombre";

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

const { ivoire, gris, noir, terracotta, orange, grisSurNoir, blanc, survol, texteSecondaire } = PALETTE;

/** Paires [texte, fond] autorisées. */
export const PAIRES_TEXTE: readonly (readonly [string, string])[] = [
  [noir, ivoire],
  [noir, gris],
  [terracotta, ivoire],
  [terracotta, gris],
  [ivoire, noir],
  [gris, noir],
  [orange, noir],
  [grisSurNoir, noir],
  [blanc, terracotta],
  [blanc, survol],
  [texteSecondaire, ivoire],
  [texteSecondaire, gris],
  [noir, blanc],
];

/** Vrai si le texte `texte` sur le fond `fond` est une paire de la charte (casse indifférente). */
export function autoriserTexte(texte: string, fond: string): boolean {
  const n = (s: string) => s.toUpperCase();
  return PAIRES_TEXTE.some(([t, f]) => n(t) === n(texte) && n(f) === n(fond));
}

/** Fond d'un visuel : jamais deux « sombre » de suite ; sinon le fond voulu. */
export function choisirFond(_index: number, precedent: Fond | null, voulu: Fond): Fond {
  return precedent === "sombre" ? "clair" : voulu;
}

/* ------------------------------------------------------------------ */
/* Lot B (08/11/2026) : jetons communs des vidéos — source UNIQUE de src/moteurs/** et des compositions.     */
/* ------------------------------------------------------------------ */

/** Cadence du studio : 25 images par seconde, partout. */
export const FPS = 25;

/** Famille CSS de Manrope dans les rendus (fichier local, jamais de CDN) et pile de repli (aucune autre police de marque). */
export const FAMILLE_CSS = "Axion Manrope";
export const PILE_CSS = `"${FAMILLE_CSS}", "${POLICE}", sans-serif`;

/** Graisses de Manrope utilisées (axe variable 200 à 800). */
export const GRAISSES = { corps: 500, appui: 600, gras: 700, titre: 800 } as const;

/** Couleurs sur fond clair (par défaut, ~80 % de la vidéo). */
export const SUR_CLAIR = {
  fond: PALETTE.ivoire,
  fondSecondaire: PALETTE.gris,
  texte: PALETTE.noir,
  accent: PALETTE.terracotta,
  /** Filets, contours discrets. */
  filet: PALETTE.gris,
} as const;

/** Couleurs sur le bloc sombre (UNE seule carte sombre arrondie par vidéo : la carte de fin). */
export const SUR_SOMBRE = {
  fond: PALETTE.noir,
  texte: PALETTE.ivoire,
  accent: PALETTE.orange,
  secondaire: PALETTE.grisSurNoir,
  filet: PALETTE.grisSurNoir,
} as const;

/** Espacements (px sur une image de 1080 de large) et rayons des blocs arrondis. */
export const ESPACEMENTS = { xs: 8, s: 16, m: 32, l: 56, xl: 96 } as const;
export const RAYONS = { petit: 16, carte: 48 } as const;

/** Durées d'animation (secondes) : douces, sans rebond. */
export const DUREES = { courte: 0.2, normale: 0.36, longue: 0.6, fondu: 0.45 } as const;

/** Courbes d'easing douces (cubic-bezier x1, y1, x2, y2) : jamais de dépassement (y entre 0 et 1) donc jamais de rebond. */
export const COURBES = {
  douce: [0.25, 0.1, 0.25, 1],
  entree: [0, 0, 0.2, 1],
  sortie: [0.4, 0, 1, 1],
  continue: [0.45, 0, 0.55, 1],
} as const;

/** Nombre d'images d'une durée en secondes à `FPS` (au moins 1). */
export function images(secondes: number): number {
  return Math.max(1, Math.round(secondes * FPS));
}

/**
 * Couleurs permises dans les vidéos (#RRGGBB majuscules), pour le test garde : la palette définitive de la charte du
 * 07/11/2026 (REPRENDRE.md d'axion-brand : le vert sauge `reussite` est GARDÉ, pour l'état « réussite » seulement).
 * Tout autre bleu, jaune, saumon ou vert est refusé.
 */
export const COULEURS_CHARTE: readonly string[] = Object.values(PALETTE).map((c) => c.toUpperCase());

/** `#RRGGBB` + opacité (0 à 1) → `rgba(...)`. */
export function avecOpacite(hex: string, opacite: number): string {
  if (!HEX.test(hex)) throw new Error(`Couleur invalide : ${hex}`);
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, opacite)).toFixed(3)})`;
}
