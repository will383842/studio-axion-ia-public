/**
 * B-ROLL ACCORDÉS AU LOOK WILL (plan v4 B.21) : même LUT et même cible que l'image de Will (Look de référence), durée
 * 1,2 à 2,5 s ; refusés : filigrane, texte en anglais, regard caméra (une personne qui regarde l'objectif « parle »
 * à la place de Will). Gratuits : Mes images d'abord, puis Pexels et Pixabay, puis captures du site.
 */

export const REGLES_BROLL = {
  dureeSec: [1.2, 2.5] as const,
  /** Intensité de la LUT du Look appliquée aux B-roll (même cible que Will). */
  intensiteLook: 1,
} as const;

export interface CandidatBroll {
  id: string;
  /** Analyse de l'image (Claude ou règles) : présente quand elle est connue. */
  filigrane?: boolean;
  texteAnglais?: boolean;
  regardCamera?: boolean;
  origine?: "mes-images" | "pexels" | "pixabay" | "capture-site" | string;
}

/** Raison du refus d'un B-roll (null : accepté). */
export function refusBroll(c: CandidatBroll): string | null {
  if (c.filigrane) return "filigrane";
  if (c.texteAnglais) return "texte en anglais";
  if (c.regardCamera) return "regard caméra";
  return null;
}

const ORDRE: Record<string, number> = { "mes-images": 0, pexels: 1, pixabay: 2, "capture-site": 3 };

/** Candidats acceptés, dans l'ordre de préférence (Mes images d'abord). */
export function brollAcceptes<C extends CandidatBroll>(candidats: C[]): C[] {
  return candidats.filter((c) => !refusBroll(c)).sort((a, b) => (ORDRE[a.origine ?? ""] ?? 9) - (ORDRE[b.origine ?? ""] ?? 9));
}

/** Durée d'un B-roll posé sur un espace de parole (1,2 à 2,5 s). */
export function dureeBroll(espaceSec: number): number {
  return +Math.min(REGLES_BROLL.dureeSec[1], Math.max(REGLES_BROLL.dureeSec[0], espaceSec)).toFixed(3);
}

/**
 * Plages de temps où la LUT du Look s'applique aux B-roll : les plans d'illustration (plein écran). Les plans de Will
 * ont déjà le Look (passe image du lot B) : la LUT n'y est pas reposée. Lot I : ni sur les cartes de motion (charte
 * exacte) ni sur les effets spéciaux (rendus sur la piste montée, déjà avec le Look) — drapeau `sansLook`.
 */
export function plagesLookBroll(plans: { type: string; debutSec: number; finSec: number; sansLook?: boolean }[]): [number, number][] {
  return plans.filter((p) => p.type === "illustration" && !p.sansLook).map((p) => [p.debutSec, p.finSec] as [number, number]);
}
