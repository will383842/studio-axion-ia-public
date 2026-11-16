/**
 * C8-A04 : géométrie de la carte d'avis client. Pur : ni React, ni `remotion`, aucun import par alias.
 * Les étoiles pleines suivent la note RÉELLE (arrondie, bornée de 1 à 5) ; jamais de tri par note.
 */
export type RatioAvis = "9:16" | "16:9" | "1:1";

export const CADRES_AVIS: Readonly<Record<RatioAvis, { largeur: number; hauteur: number }>> = Object.freeze({
  "9:16": { largeur: 1080, hauteur: 1920 },
  "16:9": { largeur: 1920, hauteur: 1080 },
  "1:1": { largeur: 1080, hauteur: 1080 },
});

/** Part du cadre occupée par la carte, par ratio. */
const PARTS: Readonly<Record<RatioAvis, { l: number; h: number }>> = Object.freeze({
  "9:16": { l: 0.84, h: 0.4 },
  "16:9": { l: 0.6, h: 0.62 },
  "1:1": { l: 0.8, h: 0.62 },
});

export interface GeometrieAvis {
  boite: { x: number; y: number; largeur: number; hauteur: number };
  marge: number;
  etoilesPleines: number;
}

/** Nombre d'étoiles pleines (1 à 5) ; `null` (refus) si la note arrondie sort de 1 à 5 ou n'est pas un nombre fini. */
export function etoilesPleines(note: number): number | null {
  if (typeof note !== "number" || !Number.isFinite(note)) return null;
  const n = Math.round(note);
  return n >= 1 && n <= 5 ? n : null;
}

export function geometrieAvis(ratio: RatioAvis, note: number): GeometrieAvis | null {
  const pleines = etoilesPleines(note);
  if (pleines === null) return null;
  const cadre = CADRES_AVIS[ratio];
  const part = PARTS[ratio];
  const largeur = Math.round(cadre.largeur * part.l);
  const hauteur = Math.round(cadre.hauteur * part.h);
  return {
    boite: { x: Math.round((cadre.largeur - largeur) / 2), y: Math.round((cadre.hauteur - hauteur) / 2), largeur, hauteur },
    marge: Math.round(Math.min(largeur, hauteur) * 0.08),
    etoilesPleines: pleines,
  };
}
