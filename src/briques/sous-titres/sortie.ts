/**
 * C2-U19 (AM-08) : SORTIE ANIMÉE d'un groupe de texte (fondu de 0,2 s et glissement court, sans rebond). PUR : ni React,
 * ni Remotion, aucun alias `@/`, aucune horloge, aucun hasard. Lu par le rendu (`scene.ts`).
 * Allumé côté code : c'est le champ `sortie`, posé seulement quand la capacité `texte.sortie-animee` est permise
 * (BR-SORTIE-ANIMEE), qui décide. Champ absent : le groupe disparaît net à sa fin, comme aujourd'hui. Flou à 0 seulement (le flou de 6 px
 * attend la mesure AM-05).
 */

/** Allumé côté code (BR-SORTIE-ANIMEE) : le champ `sortie` de `DonneesCalque`, posé seulement quand la capacité est permise, décide. Sans champ, rien ne change. */
export const SORTIE_ACTIVE = true;

export interface SortieGroupe {
  /** Durée du fondu de sortie, en secondes. */
  dureeSec: number;
  /** Glissement court vers le bas pendant la sortie, en px (image de 1 080 px ; ≤ 40). */
  glissementPx: number;
  /** Flou de sortie en px : 0 seulement tant que la mesure AM-05 n'a pas tranché. */
  flouPx: 0;
}

export const SORTIE_PAR_DEFAUT: Readonly<SortieGroupe> = Object.freeze({ dureeSec: 0.2, glissementPx: 16, flouPx: 0 });

const borne01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * État de sortie d'un groupe qui a fini à `finSec`, à l'instant t : `null` hors de la fenêtre [fin, fin + durée[
 * (avant la fin le groupe est dessiné comme d'habitude, après il a disparu). Fondu et glissement sont monotones et
 * bornés : aucun rebond.
 */
export function sortieDuGroupe(s: Pick<SortieGroupe, "dureeSec" | "glissementPx">, finSec: number, t: number): { opacite: number; decalageYPx: number } | null {
  if (!(s.dureeSec > 0)) return null;
  const u = (t - finSec) / s.dureeSec;
  if (u < 0 || u >= 1) return null;
  const douce = u * u * (3 - 2 * u);
  return { opacite: 1 - borne01(douce), decalageYPx: s.glissementPx * borne01(douce) };
}

/** Groupe encore en sortie à l'instant t : celui dont la fin précède t de moins que la durée (jamais si un groupe est déjà actif). */
export function segmentEnSortie<S extends { debutSec: number; finSec: number }>(segments: readonly S[], s: Pick<SortieGroupe, "dureeSec">, t: number): S | null {
  if (segments.some((x) => t >= x.debutSec && t < x.finSec)) return null;
  return segments.find((x) => t >= x.finSec && t < x.finSec + s.dureeSec) ?? null;
}
