/**
 * Données de l'axe « transitions » lues par les compositions (miroir des types posés par le moteur dans
 * `src/moteurs/montage-image-video/variete/axes/transitions.ts` : une composition n'importe jamais `src/moteurs/**`).
 */
export type RectEcran = { x: number; y: number; l: number; h: number };
export type SortieTransition = { code: "TRA-B"; x: number; y: number; r: number; posee?: true } | { code: "TRA-C" } | { code: "TRA-D"; carte: RectEcran };
export type DonneesTransitions = { duree: number; sortie?: SortieTransition; entree?: { code: "TRA-B" | "TRA-C" | "TRA-D" } };

export function donneesTransitions(x: unknown): DonneesTransitions | null {
  const d = x as DonneesTransitions | null | undefined;
  return d && typeof d.duree === "number" && (d.sortie || d.entree) ? d : null;
}

/** Haut des calques de transition : la marque (y ≈ 0,045 → 0,075 de la hauteur) reste toujours visible au-dessus. */
export const HAUT_TRANSITION = 0.1;
