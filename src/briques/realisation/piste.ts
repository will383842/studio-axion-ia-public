/**
 * PISTE DU VISAGE (plan facecam v4, lot B) — format du json.gz déposé sur R2 par la route `/visages` du
 * `studio-aligneur` (MediaPipe FaceLandmarker et Hands, une image sur 2 ou 3, lissage aller-retour). PUR.
 *
 * Toutes les positions sont normalisées (0-1) sur la SOURCE PRÉPARÉE (après rotation), temps de la prise d'origine.
 * Le même format est écrit par `studio-aligneur/aligneur/visages.py` : le modifier aux deux endroits.
 */

export interface EchantillonVisage {
  /** Instant (s) dans la prise. */
  t: number;
  /** Milieu des deux yeux. */
  yeuxX: number;
  yeuxY: number;
  /** Boîte du visage (ovale MediaPipe) : x, y, largeur, hauteur. */
  boite: [number, number, number, number];
  /** Ouverture de la bouche (0 fermée, 1 grande ouverte) : les dents ne sont traitées que bouche ouverte. */
  bouche: number;
  /** 0 : visage non trouvé à cet instant (valeur interpolée). */
  confiance: number;
}

export interface EchantillonMain {
  t: number;
  x: number;
  y: number;
  /** Main ouverte, paume visible (objet posé sur la main, plus tard). */
  ouverte: boolean;
}

export interface PisteVisage {
  version: 1;
  largeurSource: number;
  hauteurSource: number;
  imagesParSec: number;
  echantillons: EchantillonVisage[];
  mains?: EchantillonMain[];
  /** Part des instants où un visage a été trouvé (0-100). */
  visageTrouvePct: number;
  /** Luminance moyenne du visage (Y 0-255), pour l'alerte « image trop sombre ». */
  luminanceVisage?: number;
}

/** Échantillons dans [debut, fin] (temps de la prise), ou à défaut le plus proche. */
export function echantillonsEntre(piste: PisteVisage, debutSec: number, finSec: number): EchantillonVisage[] {
  const dedans = piste.echantillons.filter((e) => e.t >= debutSec - 1e-6 && e.t <= finSec + 1e-6 && e.confiance > 0);
  if (dedans.length) return dedans;
  const milieu = (debutSec + finSec) / 2;
  const proche = [...piste.echantillons].filter((e) => e.confiance > 0).sort((a, b) => Math.abs(a.t - milieu) - Math.abs(b.t - milieu))[0];
  return proche ? [proche] : [];
}

export function mediane(valeurs: number[]): number {
  if (!valeurs.length) return NaN;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/** Position du visage (yeux) à un instant, interpolée entre les échantillons. */
export function visageA(piste: PisteVisage, tSec: number): { yeuxX: number; yeuxY: number } | null {
  const e = piste.echantillons.filter((x) => x.confiance > 0);
  if (!e.length) return null;
  let k = e.findIndex((x) => x.t >= tSec);
  if (k <= 0) k = k === 0 ? 0 : e.length - 1;
  else {
    const a = e[k - 1];
    const b = e[k];
    const r = b.t > a.t ? (tSec - a.t) / (b.t - a.t) : 0;
    return { yeuxX: a.yeuxX + (b.yeuxX - a.yeuxX) * r, yeuxY: a.yeuxY + (b.yeuxY - a.yeuxY) * r };
  }
  return { yeuxX: e[k].yeuxX, yeuxY: e[k].yeuxY };
}
