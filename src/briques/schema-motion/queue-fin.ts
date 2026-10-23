/**
 * TRAIT DE FIN « Image → vidéo » (queue de la vidéo, après la dernière parole). PUR, sans alias « @/ » : lu par le moteur
 * (ligne de temps, rendu) ET par `studio-rendu` (composant `QueueFin`).
 *
 * La vidéo dure ~1,6 s de plus que la voix (Q19 : voix finie ≥ 1,5 s avant la fin). Sans mouvement, cette queue est une
 * image FIGÉE hors voix, refusée au-delà de 0,5 s (Q24, décision de Will du 17/10 : pas de micro-mouvement permanent).
 * Pendant la queue, un TRAIT ORANGE se dessine de gauche à droite, d'un mouvement régulier, dans la bande des
 * sous-titres (libre : la voix a fini) ; le reste de l'image ne bouge pas (ni zoom ni dérive). Il finit `tenueSec` avant
 * la fin : l'image finale est posée, le passage figé qui reste est sous 0,5 s.
 *
 * Taille : `freezedetect=n=-60dB:d=0.1` cumule l'écart à une image de référence sur toute l'image ; mesuré le 17/10 sur
 * un fond uni, un trait de 960 px dessiné en 1,3 s ne laisse que des passages ≤ 0,24 s à 80 px de haut (≤ 0,2 s à
 * 120 px, aucun à 170 px), contre 0,4 s à 40 px. 96 px : la bande des sous-titres (134 px) moins ses marges.
 */
import { ECRAN_IV, miseEnPageDeHauteurIV } from "./types";

/** Queue animée d'un bloc ou d'une ligne : début et fin du trait (secondes). */
export type QueueFinIV = { debutSec: number; finSec: number };
/** Propriétés d'une composition qui peut finir la vidéo : la queue du bloc (absente ou `null` : pas de trait). */
export type AvecQueueIV = { queue?: QueueFinIV | null };

export const QUEUE_FIN_IV = Object.freeze({
  /** Image finale tenue après le trait (s) : passage figé de la fin, sous les 0,5 s permis hors voix. */
  tenueSec: 0.2,
  /** Queue plus courte : rien à animer (le passage figé tient déjà sous 0,5 s). */
  minSec: 0.5,
  /** Hauteur du trait (px) et marge latérale (px, comme les composants). */
  hauteur: 96,
  marge: 60,
  /** Apparition du rail pâle du trait (s). */
  apparition: 0.12,
});

/**
 * Queue animée d'une version (PUR) : de la fin du dernier mot dit à `tenueSec` avant la fin de la vidéo ; `null` si la
 * queue est trop courte pour qu'une image figée y dépasse 0,5 s.
 */
export function queueDeFinIV(finDernierMot: number, dureeSec: number): QueueFinIV | null {
  if (dureeSec - finDernierMot <= QUEUE_FIN_IV.minSec + 1e-9) return null;
  const arrondi = (x: number) => Math.round(x * 1000) / 1000;
  return { debutSec: arrondi(finDernierMot), finSec: arrondi(dureeSec - QUEUE_FIN_IV.tenueSec) };
}

/** Le trait à l'instant `t` (secondes du bloc) dans un cadre `largeur` × `hauteur` : `null` avant la queue. */
export function planQueueFin(q: QueueFinIV, t: number, cadre: { largeur: number; hauteur: number } = ECRAN_IV) {
  if (t < q.debutSec) return null;
  const bande = miseEnPageDeHauteurIV(cadre.hauteur).bandeSousTitres;
  const h = QUEUE_FIN_IV.hauteur;
  const y = ((bande.haut + bande.bas) / 2) * cadre.hauteur - h / 2;
  const x = QUEUE_FIN_IV.marge;
  const largeur = cadre.largeur - 2 * QUEUE_FIN_IV.marge;
  // Mouvement LINÉAIRE (aucun ralenti en bout de course, qui figerait l'image) ; posé à `finSec`.
  const progres = Math.min(1, Math.max(0, (t - q.debutSec) / Math.max(1e-6, q.finSec - q.debutSec)));
  return { x, y, largeur, hauteur: h, rail: Math.min(1, (t - q.debutSec) / QUEUE_FIN_IV.apparition), trait: progres * largeur };
}
