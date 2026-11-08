/**
 * Charte Axion 2026 : source unique des couleurs, de la police et des règles de contraste du Studio.
 * Module PUR : aucun import. Pas encore branché (fiche V7-01) : aucun changement visible.
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

const { ivoire, gris, noir, terracotta, orange, grisSurNoir } = PALETTE;

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
