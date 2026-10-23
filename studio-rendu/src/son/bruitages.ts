/**
 * MIXAGE DES BRUITAGES (lot du 02/10, D1 ; consigne `INTENSITE-ET-BRUITAGES.md` §2). Les sons sont posés SOUS la
 * voix déjà traitée, sans jamais la toucher (aucune remontée, aucun creusement) :
 *   passe-haut 120 Hz (12 dB/oct) → niveau mesuré du son (sa partie active) → posé `gainDb` sous le niveau de la voix
 *   (sa partie parlée, même mesure) → fondus de 1 ms (attaque) et 8 ms (fin) → ajouté au mélange.
 * « Niveau » = RMS des trames de 10 ms actives (à moins de 30 dB de la plus forte) : la même mesure pour la voix et
 * pour le son, si bien que « −21 dB sous la voix » se vérifie sur le fichier (`mesurerEcarts`). Fonctions PURES.
 */
import { FREQUENCE } from "../audio/pcm.js";

export interface BruitageAMixer {
  /** Son décodé (mono, 48 kHz). */
  pcm: Float32Array;
  debutSec: number;
  /** Sous la voix (dB, négatif). */
  gainDb: number;
  passeHautHz: number;
}

/** Durée maximale d'un son posé (s) : le plus long déclencheur (papier, vibration) dure moins de 400 ms. */
export const DUREE_MAX_SON_SEC = 0.4;
const TRAME = Math.round(FREQUENCE / 100);
const FONDU = Math.round(0.008 * FREQUENCE);
const ATTAQUE = Math.round(0.001 * FREQUENCE);

/** Passe-haut de Butterworth d'ordre 2 (12 dB/oct), sur une copie. */
export function passeHaut(x: Float32Array, hz: number, frequence = FREQUENCE): Float32Array {
  const w = Math.tan((Math.PI * hz) / frequence);
  const q = Math.SQRT1_2;
  const n = 1 / (1 + w / q + w * w);
  const b0 = n;
  const b1 = -2 * n;
  const b2 = n;
  const a1 = 2 * (w * w - 1) * n;
  const a2 = (1 - w / q + w * w) * n;
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

/** Niveau actif (dBFS) : RMS des trames de 10 ms à moins de 30 dB de la plus forte. -Infinity si silence. */
export function niveauActifDb(x: Float32Array, debut = 0, fin = x.length): number {
  const energies: number[] = [];
  for (let i = debut; i + TRAME <= fin; i += TRAME) {
    let s = 0;
    for (let k = i; k < i + TRAME; k++) s += x[k] * x[k];
    energies.push(s / TRAME);
  }
  const max = Math.max(0, ...energies);
  if (max <= 1e-14) return -Infinity;
  const actives = energies.filter((e) => e >= max / 1000);
  return 10 * Math.log10(actives.reduce((a, b) => a + b, 0) / actives.length);
}

/**
 * Pose les bruitages dans `mix` (en place) sous la voix `voix` (déjà traitée, même longueur). Renvoie la piste des
 * bruitages seule (mesures, écoute) et les niveaux. Aucun bruitage : rien n'est touché.
 */
export function poserBruitages(mix: Float32Array, voix: Float32Array, sons: BruitageAMixer[], frequence = FREQUENCE): { piste: Float32Array; voixDb: number; sons: { debutSec: number; niveauDb: number; ecartDb: number }[] } {
  const piste = new Float32Array(mix.length);
  const voixDb = niveauActifDb(voix);
  const sortie: { debutSec: number; niveauDb: number; ecartDb: number }[] = [];
  if (!sons.length || !Number.isFinite(voixDb)) return { piste, voixDb, sons: sortie };
  for (const s of sons) {
    const filtre = passeHaut(s.pcm.subarray(0, Math.min(s.pcm.length, Math.round(DUREE_MAX_SON_SEC * frequence))), s.passeHautHz, frequence);
    // Fondus (1 ms à l'attaque, 8 ms à la fin) AVANT la mesure : le niveau mesuré est celui du son réellement posé.
    const n = filtre.length;
    for (let k = 0; k < n; k++) filtre[k] *= Math.min(1, k / ATTAQUE, (n - 1 - k) / FONDU);
    const niveau = niveauActifDb(filtre);
    if (!Number.isFinite(niveau)) continue;
    const g = Math.pow(10, (voixDb + s.gainDb - niveau) / 20);
    const depart = Math.round(s.debutSec * frequence);
    for (let k = 0; k < n && depart + k < mix.length; k++) {
      if (depart + k < 0) continue;
      const v = filtre[k] * g;
      piste[depart + k] += v;
      mix[depart + k] += v;
    }
    sortie.push({ debutSec: s.debutSec, niveauDb: +(niveau + 20 * Math.log10(g)).toFixed(2), ecartDb: +s.gainDb.toFixed(2) });
  }
  return { piste, voixDb, sons: sortie };
}

/**
 * Vérification sur les fichiers : écart (dB) entre la voix (partie parlée) et chaque son posé (sa partie active),
 * mesuré avec la même méthode. Attendu : entre 18 et 24 dB.
 */
export function mesurerEcarts(voix: Float32Array, piste: Float32Array, debutsSec: number[], frequence = FREQUENCE): { voixDb: number; ecartsDb: number[] } {
  const voixDb = niveauActifDb(voix);
  const ecartsDb = debutsSec.map((t) => {
    const d = Math.max(0, Math.round(t * frequence));
    const niveau = niveauActifDb(piste, d, Math.min(piste.length, d + Math.round(DUREE_MAX_SON_SEC * frequence)));
    return +(voixDb - niveau).toFixed(2);
  });
  return { voixDb: +voixDb.toFixed(2), ecartsDb };
}
