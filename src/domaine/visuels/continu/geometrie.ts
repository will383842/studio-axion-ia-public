// Géométrie de la toile continue : N pages de 1080 px côte à côte. PUR.
export const LARGEUR_PAGE = 1080;
export const HAUTEURS = { "4:5": 1350, "3:4": 1440 } as const;
export type FormatToile = keyof typeof HAUTEURS;
export const FORMATS_TOILE = Object.keys(HAUTEURS) as FormatToile[];
export const MARGE_SURE = 80;
export const COIN_RESERVE = 200;
export const BANDE_COUTURE = 80;
export const PAGES_MIN = 3;
export const PAGES_MAX = 10;
export const PAGES_DEFAUT_MAX = 6;
/** Longueur maximale de la rubrique d'une page (gabarits et parcours). */
export const RUBRIQUE_MAX = 28;

export function largeurToile(n: number): number {
  return n * LARGEUR_PAGE;
}

/** Abscisses des coutures internes (entre deux pages). */
export function coutures(n: number): number[] {
  return Array.from({ length: Math.max(0, n - 1) }, (_, i) => (i + 1) * LARGEUR_PAGE);
}

export function rectPage(i: number, format: FormatToile): { x: number; y: number; largeur: number; hauteur: number } {
  return { x: i * LARGEUR_PAGE, y: 0, largeur: LARGEUR_PAGE, hauteur: HAUTEURS[format] };
}
