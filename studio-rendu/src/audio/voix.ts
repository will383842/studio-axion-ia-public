/**
 * MESURE D'UNE VOIX (14/10, voix de référence) : portage fidèle de `docs/voix-reference/comparer-voix.py`. Le son est
 * décodé par FFmpeg en PCM mono 16 kHz (comme l'outil d'origine), puis, en mémoire : fenêtres de 40 ms au pas de
 * 10 ms, parole = énergie (RMS) > 0,02, hauteur par autocorrélation (70-300 Hz, seuil 0,4 de l'énergie), « rythme » =
 * pics de l'enveloppe lissée (5 fenêtres) au-dessus de 0,03, par seconde. `mesurerVoix` est PURE (testée sur un sinus).
 *
 * VERSION 2 DE LA MESURE (15/10, v-dd3049053f88) : la « part de parole » ne compte plus les silences de début et de fin
 * du fichier (blanc ajouté par la voix). Elle se mesure ENTRE la première et la dernière fenêtre de parole, comme la
 * référence, coupée en pleine phrase. Sur une fin de 3 s, 0,3-0,4 s de blanc aux bords faisaient perdre plus de 12 %.
 * Les cinq autres mesures sont inchangées (elles ne lisent que les fenêtres de parole, ou le fichier entier pour le rythme).
 *
 * VERSION 3 (19/10, Image → vidéo seulement) : la voix de référence (v4) est un extrait de VIDÉO FINIE (compressée,
 * -18,1 LUFS, LRA 1,4) alors que le corps était mesuré BRUT (-19,0 LUFS, LRA 2 à 3,9) : énergie -19/-21 %, dynamique
 * +19/+24 % sans que la voix soit en cause. `mesurerVoixVideoFinie` passe le son par la chaîne d'une vidéo finie
 * (gain vers -19 LUFS, passe-haut 80 Hz, compresseur forcé, gain vers -18,1 LUFS) AVANT la mesure ; `mesurerVoix`,
 * les seuils et les tolérances ne bougent pas. Le son traité ne sort jamais du dossier du travail.
 */
import { executerAvecErreurs, FFMPEG } from "../outils.js";
import { lireEbur128 } from "../son/mesure.js";
import { decoderPcm } from "./pcm.js";

/** Version 2 : part de parole sans les bords silencieux (mesure brute). */
export const VERSION_MESURE_VOIX_BRUTE = 2;
/** Version 3 : mesure après traitement « vidéo finie » (demandé par `parametres.traitement = "video-finie"`). */
export const VERSION_MESURE_VOIX_VIDEO_FINIE = 3;
/** Version courante de la mesure (rapportée avec elle). */
export const VERSION_MESURE_VOIX = VERSION_MESURE_VOIX_VIDEO_FINIE;

/** Niveau (LUFS) d'un corps de voix avant compression, et niveau d'une vidéo finie (la référence v4). */
export const NIVEAU_AVANT_COMPRESSION_LUFS = -19;
export const NIVEAU_REFERENCE_MESURE_LUFS = -18.1;
/** Gain le plus fort appliqué (dB, dans les deux sens) et niveau en dessous duquel un son n'est pas mesurable. */
export const GAIN_MESURE_MAX_DB = 15;
export const NIVEAU_MESURABLE_MIN_LUFS = -60;
/** Compresseur FORCÉ de la mesure (celui de la chaîne finale, sans condition sur la dynamique brute). */
export const COMPRESSEUR_MESURE_VOIX = "acompressor=threshold=0.15849:ratio=3:attack=12:release=140:knee=4:makeup=1";
/** Valeur de `parametres.traitement` qui demande ce traitement. */
export const TRAITEMENT_MESURE_VIDEO_FINIE = "video-finie";

/** Fréquence de la mesure (celle de `comparer-voix.py`). */
export const FREQUENCE_MESURE_VOIX = 16_000;

/** Les six mesures (mêmes noms que `MesureVoix`, `src/briques/voix-maitre/reference.ts`). */
export interface MesureVoix {
  hauteurHz: number;
  variationHz: number;
  energie: number;
  dynamique: number;
  rythmePicsParSec: number;
  partieParole: number;
}

const moyenne = (t: readonly number[]) => t.reduce((s, x) => s + x, 0) / t.length;
/** Écart type « population » (`numpy.std`). */
const ecartType = (t: readonly number[]) => {
  const m = moyenne(t);
  return Math.sqrt(t.reduce((s, x) => s + (x - m) * (x - m), 0) / t.length);
};
/** Médiane (`numpy.median` : moyenne des deux du milieu quand le nombre est pair). */
function mediane(t: readonly number[]): number {
  if (!t.length) return Number.NaN;
  const s = [...t].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Mesures d'une voix (échantillons mono, `frequence` Hz). PUR. */
export function mesurerVoix(x: Float32Array, frequence = FREQUENCE_MESURE_VOIX): MesureVoix {
  const n = Math.trunc(0.04 * frequence);
  const h = Math.trunc(0.01 * frequence);
  const lo = Math.trunc(frequence / 300);
  const hi = Math.trunc(frequence / 70);
  const rms: number[] = [];
  const f0: number[] = [];
  const f = new Float64Array(n);
  for (let i = 0; i < x.length - n; i += h) {
    let somme = 0;
    let carres = 0;
    for (let k = 0; k < n; k++) {
      somme += x[i + k];
      carres += x[i + k] * x[i + k];
    }
    const r = Math.sqrt(carres / n);
    rms.push(r);
    if (r < 0.02) {
      f0.push(0);
      continue;
    }
    const m = somme / n;
    for (let k = 0; k < n; k++) f[k] = x[i + k] - m;
    // Autocorrélation aux décalages 0 et [lo, hi[ (seuls ceux-là servent) ; premier maximum gardé (`argmax`).
    const ac = (d: number) => {
      let s = 0;
      for (let k = 0; k + d < n; k++) s += f[k] * f[k + d];
      return s;
    };
    const ac0 = ac(0);
    let kMax = lo;
    let vMax = Number.NEGATIVE_INFINITY;
    for (let d = lo; d < hi; d++) {
      const v = ac(d);
      if (v > vMax) {
        vMax = v;
        kMax = d;
      }
    }
    f0.push(vMax > 0.4 * ac0 ? frequence / kMax : 0);
  }
  const voisees = f0.filter((v) => v > 0);
  const parole = rms.filter((r) => r > 0.02);
  // Enveloppe lissée sur 5 fenêtres, centrée, bords complétés par des zéros (`numpy.convolve(..., 'same')`).
  const env = rms.map((_, i) => {
    let s = 0;
    for (let j = i - 2; j <= i + 2; j++) if (j >= 0 && j < rms.length) s += rms[j];
    return s / 5;
  });
  let pics = 0;
  for (let i = 1; i + 1 < env.length; i++) if (env[i] > env[i - 1] && env[i] > env[i + 1] && env[i] > 0.03) pics++;
  const energie = parole.length ? moyenne(parole) : Number.NaN;
  // Version 2 : part de parole entre la première et la dernière fenêtre de parole (bords silencieux retirés).
  const premiere = rms.findIndex((r) => r > 0.02);
  let derniere = rms.length - 1;
  while (derniere >= 0 && !(rms[derniere] > 0.02)) derniere--;
  return {
    hauteurHz: mediane(voisees),
    variationHz: voisees.length ? ecartType(voisees) : Number.NaN,
    energie,
    dynamique: parole.length ? ecartType(parole) / energie : Number.NaN,
    rythmePicsParSec: x.length ? pics / (x.length / frequence) : Number.NaN,
    partieParole: premiere >= 0 ? parole.length / (derniere - premiere + 1) : Number.NaN,
  };
}

/** Mesure un fichier son (ou vidéo) : décodé à 16 kHz mono par FFmpeg, puis `mesurerVoix`. */
export async function mesurerVoixFichier(source: string, signal?: AbortSignal): Promise<MesureVoix> {
  return mesurerVoix(await decoderPcm(source, signal, FREQUENCE_MESURE_VOIX), FREQUENCE_MESURE_VOIX);
}

/** Mesures à plat pour l'état d'un rendu (des nombres seulement ; une mesure illisible est omise). */
export function mesuresVoixAPlat(m: MesureVoix): Record<string, number> {
  const sortie: Record<string, number> = {};
  for (const [k, v] of Object.entries(m)) if (Number.isFinite(v)) sortie[`voix.${k}`] = +v.toFixed(5);
  return sortie;
}

/** Gain (dB) pour passer de `mesureLufs` à `cibleLufs` : 0 si la mesure n'est pas exploitable, borné à ±15, arrondi 0,01. PUR. */
export function gainBorne(cibleLufs: number, mesureLufs: number): number {
  if (!Number.isFinite(mesureLufs) || !Number.isFinite(cibleLufs) || mesureLufs <= NIVEAU_MESURABLE_MIN_LUFS) return 0;
  const g = Math.max(-GAIN_MESURE_MAX_DB, Math.min(GAIN_MESURE_MAX_DB, cibleLufs - mesureLufs));
  return Math.round(g * 100) / 100 + 0; // + 0 : jamais -0
}

/** Filtres du traitement « vidéo finie » (avant le gain final), d'après le niveau brut mesuré. PUR. */
export function filtresMesureVideoFinie(niveauBrutLufs: number): string[] {
  return [`volume=${gainBorne(NIVEAU_AVANT_COMPRESSION_LUFS, niveauBrutLufs)}dB`, "highpass=f=80:poles=2", COMPRESSEUR_MESURE_VOIX];
}

export interface MesureVoixVideoFinie {
  voix: MesureVoix;
  /** Durée du son décodé (s). */
  dureeSec: number;
  niveauBrutLufs: number;
  lraBrut: number;
  gainAvantDb: number;
  gainApresDb: number;
  /** 1 si le niveau brut était mesurable, 0 sinon (gains à 0, filtres appliqués quand même). */
  niveauMesurable: 0 | 1;
}

/**
 * Mesure une voix « comme une vidéo finie » : niveau brut, traitement (filtres + gain vers -18,1 LUFS), son traité écrit
 * en flottant 32 bits (`<source>-mesure-voix.wav`, jamais déposé : un gain en 16 bits écrêterait), décodé à 16 kHz puis
 * mesuré par `mesurerVoix` (inchangée).
 */
export async function mesurerVoixVideoFinie(source: string, signal?: AbortSignal): Promise<MesureVoixVideoFinie> {
  const entree = ["-hide_banner", "-nostats", "-i", source, "-map", "0:a:0", "-af"];
  const sortieNulle = ["-f", "null", "-"];
  const brut = lireEbur128((await executerAvecErreurs(FFMPEG, [...entree, "ebur128", ...sortieNulle], signal)).erreurs);
  const filtres = filtresMesureVideoFinie(brut.lufs);
  const gainAvantDb = gainBorne(NIVEAU_AVANT_COMPRESSION_LUFS, brut.lufs);
  const traite = lireEbur128((await executerAvecErreurs(FFMPEG, [...entree, [...filtres, "ebur128"].join(","), ...sortieNulle], signal)).erreurs);
  const gainApresDb = gainBorne(NIVEAU_REFERENCE_MESURE_LUFS, traite.lufs);
  const chemin = `${source}-mesure-voix.wav`;
  await executerAvecErreurs(FFMPEG, ["-v", "error", "-y", "-i", source, "-map", "0:a:0", "-af", [...filtres, `volume=${gainApresDb}dB`].join(","), "-ac", "1", "-c:a", "pcm_f32le", chemin], signal);
  const y = await decoderPcm(chemin, signal, FREQUENCE_MESURE_VOIX);
  return {
    voix: mesurerVoix(y, FREQUENCE_MESURE_VOIX),
    dureeSec: y.length / FREQUENCE_MESURE_VOIX,
    niveauBrutLufs: brut.lufs,
    lraBrut: brut.lra,
    gainAvantDb,
    gainApresDb,
    niveauMesurable: Number.isFinite(brut.lufs) && brut.lufs > NIVEAU_MESURABLE_MIN_LUFS ? 1 : 0,
  };
}
