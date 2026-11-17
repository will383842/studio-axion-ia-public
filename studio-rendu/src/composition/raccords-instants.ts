/**
 * C6-H24c-b · état d'un raccord (fondu, glissement) à une image donnée côté Remotion. PUR, NON BRANCHÉ : rien
 * n'importe ce fichier (H24c-c l'appellera, derrière un champ facultatif). Aucun visage : un raccord n'est jamais
 * demandé sur un plan avec la personne (Q7, H24b-a). Flou : toujours 0 sauf valeur explicite 6 ou 12 (AM-05).
 */

/** Recopie de `RaccordMontage` (src/briques/composition/raccords.ts:9-13) : le rendu n'importe rien de `src/`. */
export interface RaccordLocal {
  indexAvant: number;
  type: "fondu" | "glissement";
}

/** Durée par défaut (s), identique à `DUREE_RACCORD_DEFAUT_SEC` de raccords-ffmpeg.ts. */
export const DUREE_RACCORD_INSTANTS_DEFAUT_SEC = 0.3;
/** Durée maximale (s) d'un raccord (AM-01). */
export const DUREE_RACCORD_INSTANTS_MAX_SEC = 0.4;
/** Décalage horizontal maximal, en part de la largeur. */
export const DECALAGE_MAX_PART = 0.08;
const LARGEUR_DEFAUT_PX = 1080;

export interface EtatRaccord {
  indexAvant: number;
  opaciteAvant: number;
  opaciteApres: number;
  decalageAvantPx: number;
  decalageApresPx: number;
  flouPx: number;
}

/** Courbe douce (smoothstep) : monotone, de 0 à 1, sans dépassement ni rebond. */
const douce = (p: number) => p * p * (3 - 2 * p);

export function etatRaccordA(
  image: number,
  fps: number,
  plans: { debutImage: number; finImage: number }[],
  raccords: readonly RaccordLocal[],
  options: { dureeSec?: number; flouPx?: 0 | 6 | 12; largeurPx?: number } = {},
): EtatRaccord | null {
  if (!(fps > 0) || !Number.isFinite(image) || raccords.length === 0) return null;
  const voulu = options.dureeSec ?? DUREE_RACCORD_INSTANTS_DEFAUT_SEC;
  const flou = options.flouPx === 6 || options.flouPx === 12 ? options.flouPx : 0;
  const largeur = options.largeurPx !== undefined && options.largeurPx > 0 ? options.largeurPx : LARGEUR_DEFAUT_PX;
  const vus = new Set<number>();
  for (const r of raccords) {
    const i = r.indexAvant;
    if (!Number.isInteger(i) || i < 0 || i + 1 >= plans.length || vus.has(i)) continue;
    vus.add(i);
    const a = plans[i]!;
    const b = plans[i + 1]!;
    const plusCourtSec = Math.min(a.finImage - a.debutImage, b.finImage - b.debutImage) / fps;
    const d = Math.max(0, Math.min(voulu, DUREE_RACCORD_INSTANTS_MAX_SEC, plusCourtSec / 2));
    const n = Math.round(d * fps); // nombre d'images de la fenêtre
    if (n < 1) continue;
    const debut = a.finImage - Math.floor(n / 2);
    if (image < debut || image >= debut + n) continue;
    const s = douce((image - debut + 0.5) / n);
    const glisse = r.type === "glissement";
    return {
      indexAvant: i,
      opaciteAvant: 1 - s,
      opaciteApres: s,
      decalageAvantPx: glisse ? -s * DECALAGE_MAX_PART * largeur : 0,
      decalageApresPx: glisse ? (1 - s) * DECALAGE_MAX_PART * largeur : 0,
      flouPx: flou,
    };
  }
  return null;
}
