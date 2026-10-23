/**
 * G6 et G6b · opération `assemblage` de `studio-rendu`, sur de VRAIS fichiers (FFmpeg du poste, 0 €) :
 *  - sons (G6) : le corps repris de la mère garde ses échantillons TELS QUELS (seuls ses bords sont fondus) ;
 *  - prises filmées (G6b) : trois prises (début, corps, fin) fabriquées depuis la voix d'essai et une image de la
 *    démonstration, mises bout à bout en une vidéo 1080 × 1920 de la bonne durée.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assemblerEchantillons, assemblerFichiers } from "../studio-rendu/src/operations/assemblage";
import { decoderPcm, FREQUENCE } from "../studio-rendu/src/audio/pcm";
import { OPERATIONS } from "../studio-rendu/src/contrat";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;
const VOIX = join(process.cwd(), "tests", "fixtures", "voix-essai.wav");
const IMAGE = join(process.cwd(), "public", "demo", "illustrations", "illu-02.jpg");

describe("assemblage : contrat et calcul pur", () => {
  it("l'opération est déclarée au contrat de studio-rendu", () => expect(OPERATIONS).toContain("assemblage"));

  it("morceaux bout à bout : chaque morceau garde ses échantillons hors des fondus de 12 ms", () => {
    const n = FREQUENCE;
    const mere = Float32Array.from({ length: 4 * n }, (_, i) => Math.sin(i / 7) * 0.5);
    const neuf = Float32Array.from({ length: 2 * n }, (_, i) => Math.cos(i / 5) * 0.3);
    const { echantillons, debuts } = assemblerEchantillons({ mere, partiel: neuf }, [
      { entree: "partiel", deSec: 0, aSec: 1 },
      { entree: "mere", deSec: 1, aSec: 3 },
      { entree: "partiel", deSec: 1, aSec: 2 },
    ]);
    expect(debuts.length).toBe(3);
    // Le milieu du corps est la mère telle quelle : on retrouve son décalage (raccord recalé sur un passage par zéro,
    // ± 2 ms), puis 1,9 s d'échantillons identiques.
    const d = Math.round(debuts[1] * n) + Math.round(0.05 * n);
    let decalage = -1;
    for (let o = n - 200; o <= n + 200 && decalage < 0; o++) {
      let ok = true;
      for (let k = 0; k < 50 && ok; k++) ok = echantillons[d + k] === mere[o + Math.round(0.05 * n) + k];
      if (ok) decalage = o;
    }
    expect(decalage).toBeGreaterThan(0);
    let ecarts = 0;
    for (let k = 0; k < Math.round(1.9 * n); k++) if (echantillons[d + k] !== mere[decalage + Math.round(0.05 * n) + k]) ecarts++;
    expect(ecarts).toBe(0);
    expect(echantillons.length / n).toBeCloseTo(4, 1);
  });
});

describe.skipIf(!ffmpegPresent || !existsSync(VOIX))("assemblage : vrais fichiers (FFmpeg)", { timeout: 120_000 }, () => {
  const dossier = mkdtempSync(join(tmpdir(), "g6b-assemblage-"));

  it("sons (G6) : début neuf + corps de la mère + fin neuve ; le corps est celui de la mère, échantillon pour échantillon", async () => {
    const r = await assemblerFichiers({ mere: VOIX, partiel: VOIX }, { sortie: "wav", morceaux: [
      { entree: "partiel", deSec: 0.3, aSec: 2.9 },
      { entree: "mere", deSec: 3.9, aSec: 6.6 },
      { entree: "partiel", deSec: 7.4, aSec: 10.9 },
    ] }, dossier);
    expect(r.mesures.dureeSec).toBeCloseTo(2.6 + 2.7 + 3.5, 1);
    const sortie = await decoderPcm(r.chemin);
    const source = await decoderPcm(VOIX);
    const debut = Math.round(r.mesures["morceau.1.debut"] * FREQUENCE);
    const decalage = Math.round(3.9 * FREQUENCE) - debut;
    let identiques = 0;
    let total = 0;
    // WAV 16 bits : comparaison au pas de quantification (1/32768) près, hors fondus.
    for (let k = debut + 1500; k < debut + Math.round(2.6 * FREQUENCE); k++) {
      total++;
      if (Math.abs(sortie[k] - source[k + decalage]) < 1 / 16384) identiques++;
    }
    expect(identiques / total).toBeGreaterThan(0.99);
  });

  it("prises filmées (G6b) : début, corps, fin → une vidéo 1080 × 1920 de la bonne durée, son et image", async () => {
    const prises: Record<string, string> = {};
    // Trois « prises » 720 × 1280 (image de démonstration + voix d'essai), comme filmées au téléphone.
    for (const nom of ["debut", "corps", "fin"]) {
      const chemin = join(dossier, `${nom}.mp4`);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-loop", "1", "-i", IMAGE, "-i", VOIX, "-t", "10.9", "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280", "-r", "25", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", chemin]);
      prises[nom] = chemin;
    }
    const r = await assemblerFichiers(prises, { sortie: "mp4", video: { largeur: 1080, hauteur: 1920, fps: 25 }, morceaux: [
      { entree: "debut", deSec: 0.25, aSec: 2.95 },
      { entree: "corps", deSec: 3.9, aSec: 6.7 },
      { entree: "fin", deSec: 7.4, aSec: 10.9 },
    ] }, dossier);
    const sonde = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration", "-of", "json", r.chemin]).toString()) as { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } };
    const video = sonde.streams.find((s) => s.codec_type === "video")!;
    expect([video.width, video.height]).toEqual([1080, 1920]);
    expect(sonde.streams.some((s) => s.codec_type === "audio")).toBe(true);
    expect(Number(sonde.format.duration)).toBeCloseTo(2.7 + 2.8 + 3.5, 0);
  });
});
