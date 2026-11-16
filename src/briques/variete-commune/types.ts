/**
 * Empreinte visuelle d'une vidéo (E2-ANTI-REPETITION). Aucun comportement.
 * Module côté Studio seulement, jamais importé par `studio-rendu/**`.
 * Aucune date du jour, aucun hasard.
 */
export const AXES_COMMUNS = [
  "habillage", "typo", "palette", "ouverture", "fin", "transitions",
  "sousTitres", "sons", "objets", "recit", "camera", "dosage",
] as const;

export type AxeCommun = (typeof AXES_COMMUNS)[number];

export interface EmpreinteVideo {
  version: string;
  videoId: string;
  formatId: string;
  le: string;
  axes: Partial<Record<AxeCommun, string[]>>;
  imposes?: AxeCommun[];
}

export interface Voisine {
  empreinte: EmpreinteVideo;
  reseau: string;
  rang: number;
}

export interface ResultatGarde {
  ok: boolean;
  score: number | null;
  voisine?: string;
  axesCommuns: AxeCommun[];
  phrase: string;
}
