/**
 * FIN PROPRE (14/10) : mesure de la fin d'un fichier exporté, relue par `controleFinPropre`
 * (`src/briques/composition/fin-propre.ts`) dans les contrôles de sortie du tableau animé et du cas concret :
 *  - `sonDerniere100msDb` : niveau du son sur la dernière 0,1 s (dBFS ; -120 : silence numérique) ;
 *  - `mouvementDerniereImage` : écart moyen (0-255) entre les deux dernières images, en gris réduit à 64 × 64.
 * Les calculs sont PURS (testés) ; seule `mesurerFinVideo` lance FFmpeg.
 */
import { spawn } from "node:child_process";
import { decoderPcm, FREQUENCE, niveauDb } from "../audio/pcm.js";
import { FFMPEG } from "../outils.js";

/** Côté de l'image réduite comparée (gris, 8 bits). */
export const COTE_IMAGE_FIN = 64;

/** Niveau (dBFS) des `sec` dernières secondes d'un son. PUR. */
export function niveauFinDb(x: Float32Array, sec = 0.1, frequence = FREQUENCE): number {
  const duree = x.length / frequence;
  if (!x.length) return Number.NaN;
  return +niveauDb(x, { debutSec: Math.max(0, duree - sec), finSec: duree }, frequence).toFixed(1);
}

/** Écart moyen absolu (0-255) entre les deux dernières images d'une suite d'images grises de `taille` octets. PUR. */
export function mouvementDernieresImages(brut: Uint8Array, taille = COTE_IMAGE_FIN * COTE_IMAGE_FIN): number {
  const n = Math.floor(brut.length / taille);
  if (n < 2) return Number.NaN;
  const a = brut.subarray((n - 2) * taille, (n - 1) * taille);
  const b = brut.subarray((n - 1) * taille, n * taille);
  let s = 0;
  for (let i = 0; i < taille; i++) s += Math.abs(a[i] - b[i]);
  return +(s / taille).toFixed(3);
}

function sortieBinaire(args: string[], signal?: AbortSignal): Promise<Uint8Array> {
  return new Promise((ok, ko) => {
    const p = spawn(FFMPEG, args, { signal, windowsHide: true });
    const morceaux: Buffer[] = [];
    p.stdout.on("data", (d: Buffer) => morceaux.push(d));
    p.stderr.resume();
    p.on("error", ko);
    p.on("close", (code) => (code === 0 ? ok(new Uint8Array(Buffer.concat(morceaux))) : ko(new Error(`ffmpeg a rendu ${code}`))));
  });
}

/**
 * Mesure la fin d'un fichier exporté. Une mesure en panne (pas de son, image illisible) rend `NaN` : le contrôle la
 * dit « non mesurée » ; elle ne bloque jamais l'export.
 */
export async function mesurerFinVideo(video: string, signal?: AbortSignal): Promise<{ sonDerniere100msDb: number; mouvementDerniereImage: number }> {
  const son = await decoderPcm(video, signal).then((x) => niveauFinDb(x), () => Number.NaN);
  const images = await sortieBinaire(["-v", "error", "-sseof", "-1", "-i", video, "-an", "-vf", `scale=${COTE_IMAGE_FIN}:${COTE_IMAGE_FIN},format=gray`, "-f", "rawvideo", "-"], signal).then(
    (b) => mouvementDernieresImages(b),
    () => Number.NaN,
  );
  return { sonDerniere100msDb: son, mouvementDerniereImage: images };
}
