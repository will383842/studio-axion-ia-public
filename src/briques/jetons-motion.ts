/**
 * JETONS DE MOTION DE LA CHARTE AXION IA (dépôt will383842/axion-brand) — module MINCE et provisoire du lot C : le lot B
 * le remplacera par `src/briques/charte/axion-2026.ts` (garder les mêmes noms exportés, ou ré-exporter depuis ici).
 * PUR, sans React ni Remotion, sans alias « @/ » : lu tel quel par les compositions de `studio-rendu`.
 *
 * Règles : ivoire, gris, noir, terracotta ; orange SEULEMENT sur fond noir ; Manrope seule ; jamais bleu, jaune,
 * saumon ni vert ; mouvement doux sans rebond ; 25 images par seconde.
 */

export const VERSION_JETONS_MOTION = "axion-jetons-1";

export const CHARTE_AXION = {
  ivoire: "#FAF9F5",
  gris: "#E8E6DC",
  noir: "#141413",
  terracotta: "#B23F16",
  /** Sur fond noir seulement. */
  orange: "#D97757",
} as const;

export type NomCouleurAxion = keyof typeof CHARTE_AXION;
export type FondAxion = "ivoire" | "noir";
export type AccentAxion = "terracotta" | "orange";

export const POLICE_AXION = "Manrope";
/** Pile CSS : Manrope, puis la police système neutre seulement si Manrope manque (le rendu attend Manrope). */
export const FAMILLE_CSS_AXION = `${POLICE_AXION}, sans-serif`;
export const FPS_AXION = 25;

/** Teintes que la charte exclut (contrôle des paramètres en texte libre). */
export const TEINTES_INTERDITES = ["bleu", "blue", "jaune", "yellow", "saumon", "salmon", "vert", "green"] as const;

/** Accent permis sur ce fond : l'orange devient terracotta sur fond clair. */
export function accentSur(fond: FondAxion, accent: AccentAxion = "terracotta"): string {
  return fond === "noir" && accent === "orange" ? CHARTE_AXION.orange : CHARTE_AXION.terracotta;
}

/** Couleurs d'usage selon le fond (texte, texte secondaire, panneau, filet). */
export function couleursSur(fond: FondAxion, accent: AccentAxion = "terracotta") {
  const sombre = fond === "noir";
  return {
    fond: sombre ? CHARTE_AXION.noir : CHARTE_AXION.ivoire,
    texte: sombre ? CHARTE_AXION.ivoire : CHARTE_AXION.noir,
    texteDoux: avecOpacite(sombre ? CHARTE_AXION.ivoire : CHARTE_AXION.noir, 0.62),
    panneau: sombre ? avecOpacite(CHARTE_AXION.ivoire, 0.06) : CHARTE_AXION.ivoire,
    panneauRelief: sombre ? avecOpacite(CHARTE_AXION.ivoire, 0.1) : CHARTE_AXION.gris,
    filet: avecOpacite(sombre ? CHARTE_AXION.ivoire : CHARTE_AXION.noir, 0.12),
    accent: accentSur(fond, accent),
  };
}

/** Couleur de la charte avec opacité (rgba), pour ombres et textes secondaires. */
export function avecOpacite(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(a * 1000) / 1000})`;
}

/* Mouvement doux, sans rebond : courbes monotones bornées à [0, 1]. */

/** Entrée-sortie douce (cubique) : jamais au-delà de 1, jamais de retour en arrière. */
export function adoucir(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Sortie douce (décélération) pour les arrivées. */
export function decelerer(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

/** Avancement 0 → 1 entre deux images, adouci. */
export function progression(image: number, debut: number, duree: number, courbe: (t: number) => number = adoucir): number {
  if (duree <= 0) return image >= debut ? 1 : 0;
  return courbe((image - debut) / duree);
}

/** Interpolation linéaire. */
export function entre(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Millisecondes → images à 25 i/s (arrondi à l'image la plus proche). */
export function msEnImages(ms: number, fps: number = FPS_AXION): number {
  return Math.round((ms * fps) / 1000);
}
