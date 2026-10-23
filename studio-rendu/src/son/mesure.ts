/**
 * MESURES DU SON sur le FICHIER EXPORTÉ (lot M4 ; plan B.7, B.8 `niveau-sonore`) :
 *  - niveau intégré (LUFS) et écart fort / faible (LRA) par `ebur128` ;
 *  - CRÊTE VRAIE (`ebur128` avec `peak=true`, suréchantillonnée), pas la crête d'échantillon d'`astats` ;
 *  - niveau dans les pauses entre les mots (cible −48 à −35 dB, comme les références).
 * Les lectures de la sortie de FFmpeg sont PURES (testées) ; `mesurerFichier` exécute.
 */
import { decoderPcm, niveauDb } from "../audio/pcm.js";
import { executerAvecErreurs, FFMPEG } from "../outils.js";

export interface MesuresSon {
  lufs: number;
  lra: number;
  creteVraieDbtp: number;
  /** Pauses mesurées, et le plus faible / le plus fort de leurs niveaux (dBFS). */
  pauses: number;
  pauseMinDb: number;
  pauseMaxDb: number;
}

const nombre = (texte: string, motif: RegExp): number => {
  const m = motif.exec(texte);
  return m ? Number(m[1]) : NaN;
};

/** Lit le résumé d'`ebur128` (dernier bloc « Summary »). */
export function lireEbur128(sortie: string): { lufs: number; lra: number; creteVraieDbtp: number } {
  const i = sortie.lastIndexOf("Summary:");
  const bloc = i >= 0 ? sortie.slice(i) : sortie;
  return {
    lufs: nombre(bloc, /I:\s+(-?[\d.]+|-inf)\s+LUFS/),
    lra: nombre(bloc, /LRA:\s+(-?[\d.]+)\s+LU/),
    creteVraieDbtp: nombre(bloc, /True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS/),
  };
}

/** Lit la mesure JSON de `loudnorm` (`print_format=json`). */
export function lireLoudnorm(sortie: string): { i: number; tp: number; lra: number; seuil: number } {
  const debut = sortie.lastIndexOf("{");
  const fin = sortie.lastIndexOf("}");
  if (debut < 0 || fin < debut) return { i: NaN, tp: NaN, lra: NaN, seuil: NaN };
  const j = JSON.parse(sortie.slice(debut, fin + 1)) as Record<string, string>;
  return { i: Number(j.input_i), tp: Number(j.input_tp), lra: Number(j.input_lra), seuil: Number(j.input_thresh) };
}

/** Niveaux (dBFS) de chaque pause [début, fin) d'un signal mono 48 kHz. */
export function niveauxDesPauses(x: Float32Array, pauses: [number, number][]): number[] {
  return pauses.filter(([a, b]) => b > a).map(([a, b]) => niveauDb(x, { debutSec: a, finSec: b }));
}

/** Mesure le son d'un fichier (vidéo ou son) : niveau, LRA, crête vraie, niveau dans les pauses. */
export async function mesurerFichier(chemin: string, pauses: [number, number][] = [], signal?: AbortSignal): Promise<MesuresSon> {
  const { erreurs } = await executerAvecErreurs(FFMPEG, ["-hide_banner", "-nostats", "-i", chemin, "-map", "0:a:0", "-af", "ebur128=peak=true:framelog=verbose", "-f", "null", "-"], signal);
  const e = lireEbur128(erreurs);
  let niveaux: number[] = [];
  if (pauses.length) niveaux = niveauxDesPauses(await decoderPcm(chemin, signal), pauses).filter((n) => Number.isFinite(n));
  return {
    ...e,
    pauses: niveaux.length,
    pauseMinDb: niveaux.length ? +Math.min(...niveaux).toFixed(1) : NaN,
    pauseMaxDb: niveaux.length ? +Math.max(...niveaux).toFixed(1) : NaN,
  };
}
