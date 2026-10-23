/**
 * LOT R5 — opérations `etalonnage` et `mixage` de studio-rendu, en VRAI FFmpeg (si présent), par un petit serveur
 * local qui joue le stockage (entrées lues, résultat déposé à part ; l'original n'est jamais modifié) :
 *   - écart FFmpeg (lut3d tétraédrique) / `lib/lut3d` (calcul du navigateur) ≤ 2/255 sur la LUT Axion 65 points ;
 *   - intensité 0 : l'image ressort identique ; intensité 50 % : le mélange exact de l'avant et de l'après ;
 *   - mixage d'une vraie voix (Windows, démonstration M4) avec et sans musique : −14 LUFS ± 0,5, crête ≤ −1,5 dBTP.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appliquerLutPixels, lireCube } from "@/lib/lut3d";
import { OPERATIONS } from "../studio-rendu/src/contrat";
import { etalonnage, filtreEtalonnage, intensiteBornee } from "../studio-rendu/src/operations/etalonnage";
import { gainsEffacement, limiteurStereo, mixage, reglagesMixage } from "../studio-rendu/src/operations/mixage";
import { mesurerFichier } from "../studio-rendu/src/son/mesure";

describe("R5 · étalonnage et mixage : règles pures", () => {
  it("les deux opérations sont déclarées au contrat", () => {
    expect(OPERATIONS).toContain("etalonnage");
    expect(OPERATIONS).toContain("mixage");
  });
  it("intensité bornée à [0 ; 1], illisible = LUT entière", () => {
    expect([intensiteBornee(-1), intensiteBornee(0.4), intensiteBornee(7), intensiteBornee("x"), intensiteBornee(undefined)]).toEqual([0, 0.4, 1, 1, 1]);
  });
  it("filtre : LUT relative au dossier, tétraédrique, en RVB ; vidéo en BT.709 ; aucune LUT à l'intensité 0", () => {
    expect(filtreEtalonnage("lut-melangee.cube", "image")).toBe("format=gbrp,lut3d=file=lut-melangee.cube:interp=tetrahedral,format=rgb24");
    expect(filtreEtalonnage(null, "image")).toBe("format=gbrp,format=rgb24");
    expect(filtreEtalonnage("l.cube", "video")).toBe("scale=in_color_matrix=bt709:in_range=tv,format=gbrp,lut3d=file=l.cube:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv");
  });
  it("mixage : réglages bornés, musique bouclée qui s'efface sous la voix, voix centrée", () => {
    expect(reglagesMixage({})).toEqual({ lufs: -14, creteVraieMaxDbtp: -1.5, baisseSousVoixDb: 12, musiqueDb: -24 });
    expect(reglagesMixage({ lufs: 3, creteVraieMaxDbtp: 0, baisseSousVoixDb: 99 })).toMatchObject({ lufs: -9, creteVraieMaxDbtp: -1, baisseSousVoixDb: 30 });
    // Effacement : 1 s de silence, 1 s de voix, 1 s de silence → gain 1, puis −12 dB, puis retour à 1.
    const f = 48_000;
    const voix = new Float32Array(3 * f);
    for (let i = f; i < 2 * f; i++) voix[i] = 0.3 * Math.sin((2 * Math.PI * 1000 * i) / f);
    const g = gainsEffacement(voix, 12, f);
    const db = (i: number) => 20 * Math.log10(g[i]);
    expect(db(Math.round(0.5 * f))).toBeCloseTo(0, 5);
    expect(db(Math.round(1.5 * f))).toBeCloseTo(-12, 1);
    expect(db(Math.round(2.9 * f))).toBeCloseTo(0, 1);
    expect(gainsEffacement(voix, 0, f).every((x) => x === 1)).toBe(true);
    expect(limiteurStereo(-1.5)).toBe("alimiter=limit=0.7674:attack=4:release=60:level=false");
  });
});

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.skipIf(!ffmpegPresent)("R5 · vrai passage FFmpeg", { timeout: 180_000 }, () => {
  let serveur: Server;
  let base = "";
  const recus = new Map<string, Buffer>();
  const dossier = mkdtempSync(join(tmpdir(), "r5-operations-"));
  const sources: Record<string, string> = {
    "/image.png": join(dossier, "image.png"),
    "/lut.cube": join("public", "luts", "axion-buffer-clair-obscur.cube"),
    "/voix.wav": join("outils", "demo-m4", "voix-demo.wav"),
    "/musique.wav": join(dossier, "musique.wav"),
  };

  beforeAll(async () => {
    // Image d'essai : mire colorée et dégradés (toutes les teintes passent dans la LUT).
    expect(spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x180", "-frames:v", "1", sources["/image.png"]]).status).toBe(0);
    // « Musique » d'essai : accord continu, assez fort pour que l'effacement sous la voix se mesure.
    expect(spawnSync("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "sine=f=220:d=6,volume=0.5", "-f", "lavfi", "-i", "sine=f=330:d=6,volume=0.4", "-filter_complex", "amix=inputs=2:normalize=0", "-ar", "48000", "-ac", "2", sources["/musique.wav"]]).status).toBe(0);
    serveur = createServer((req, res) => {
      if (req.method === "GET") {
        const chemin = sources[req.url ?? ""];
        if (!chemin) return void res.writeHead(404).end();
        res.writeHead(200);
        res.end(readFileSync(chemin));
        return;
      }
      const morceaux: Buffer[] = [];
      req.on("data", (c: Buffer) => morceaux.push(c));
      req.on("end", () => {
        recus.set(req.url ?? "", Buffer.concat(morceaux));
        res.writeHead(200);
        res.end();
      });
    });
    await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
    base = `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`;
  });
  afterAll(() => serveur.close());

  const contexte = (nom: string) => {
    const d = join(dossier, nom);
    mkdirSync(d, { recursive: true });
    return { progression: () => undefined, dossier: d, signal: new AbortController().signal };
  };
  /** Pixels RVB 8 bits d'une image PNG. */
  const pixels = (png: Buffer): Uint8Array => {
    const f = join(dossier, `p-${Math.random().toString(36).slice(2)}.png`);
    writeFileSync(f, png);
    return new Uint8Array(spawnSync("ffmpeg", ["-v", "error", "-i", f, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 26 }).stdout);
  };
  const etalonner = async (nom: string, intensite: number, lut = "/lut.cube") => {
    const r = await etalonnage(
      { idRendu: nom, operation: "etalonnage", file: "courte", entrees: { image: `${base}/image.png`, lut: `${base}${lut}` }, sortie: { urlDepot: `${base}/depot/${nom}.png`, cle: nom }, parametres: { intensite, format: "png" } },
      contexte(nom),
    );
    return { r, png: recus.get(`/depot/${nom}.png`)! };
  };

  for (const nomLut of ["axion-buffer-clair-obscur", "axion-buffer-naturel", "axion-buffer-doux", "axion-buffer-nuit"])
  it(`écart FFmpeg / lib/lut3d ≤ 2/255 (LUT Axion ${nomLut}, 65 points, à 100 %)`, async () => {
    sources[`/${nomLut}.cube`] = join("public", "luts", `${nomLut}.cube`);
    const { r, png } = await etalonner(`e100-${nomLut}`, 1, `/${nomLut}.cube`);
    expect(r.mesures).toMatchObject({ tailleLut: 65, intensite: 1, largeur: 320, hauteur: 180 });
    const ffmpeg = pixels(png);
    const avant = pixels(readFileSync(sources["/image.png"]));
    expect(ffmpeg.length).toBe(avant.length);
    // Calcul du navigateur (trilinéaire) sur les mêmes pixels.
    const rgba = new Uint8ClampedArray((avant.length / 3) * 4);
    for (let i = 0, j = 0; i < avant.length; i += 3, j += 4) [rgba[j], rgba[j + 1], rgba[j + 2], rgba[j + 3]] = [avant[i], avant[i + 1], avant[i + 2], 255];
    appliquerLutPixels(rgba, lireCube(readFileSync(sources[`/${nomLut}.cube`], "utf8")), 1);
    let ecartMax = 0;
    let differents = 0;
    for (let i = 0, j = 0; i < ffmpeg.length; i += 3, j += 4)
      for (let c = 0; c < 3; c++) {
        const e = Math.abs(ffmpeg[i + c] - rgba[j + c]);
        ecartMax = Math.max(ecartMax, e);
        if (ffmpeg[i + c] !== avant[i + c]) differents++;
      }
    expect(ecartMax).toBeLessThanOrEqual(2);
    // La LUT a bien changé l'image (sinon l'écart nul ne prouverait rien).
    expect(differents).toBeGreaterThan(ffmpeg.length / 4);
  });

  it("intensité 0 : l'image ressort identique ; 50 % : le mélange de l'avant et de l'après (± 1/255)", async () => {
    const avant = pixels(readFileSync(sources["/image.png"]));
    expect(Buffer.from(pixels((await etalonner("e0", 0)).png)).equals(Buffer.from(avant))).toBe(true);
    const plein = pixels((await etalonner("e100b", 1)).png);
    const moitie = pixels((await etalonner("e50", 0.5)).png);
    let ecartMax = 0;
    for (let i = 0; i < moitie.length; i++) ecartMax = Math.max(ecartMax, Math.abs(moitie[i] - (avant[i] + plein[i]) / 2));
    expect(ecartMax).toBeLessThanOrEqual(1.5);
  });

  it("une LUT cassée est refusée clairement (aucun dépôt)", async () => {
    writeFileSync(join(dossier, "casse.cube"), "LUT_3D_SIZE 3\n0 0 0\n");
    sources["/casse.cube"] = join(dossier, "casse.cube");
    await expect(
      etalonnage({ idRendu: "x", operation: "etalonnage", file: "courte", entrees: { image: `${base}/image.png`, lut: `${base}/casse.cube` }, sortie: { urlDepot: `${base}/depot/casse.png`, cle: "x" }, parametres: {} }, contexte("casse")),
    ).rejects.toThrow(/LUT illisible/);
    expect(recus.has("/depot/casse.png")).toBe(false);
  });

  for (const avecMusique of [false, true]) {
    it(`mixage ${avecMusique ? "avec" : "sans"} musique : −14 LUFS ± 0,5, crête vraie ≤ −1,5 dBTP, stéréo 48 kHz`, async () => {
      const nom = avecMusique ? "mix-musique" : "mix-voix";
      const r = await mixage(
        { idRendu: nom, operation: "mixage", file: "longue", entrees: { voix: `${base}/voix.wav`, ...(avecMusique ? { musique: `${base}/musique.wav` } : {}) }, sortie: { urlDepot: `${base}/depot/${nom}.wav`, cle: nom }, parametres: {} },
        contexte(nom),
      );
      const wav = join(dossier, `${nom}.wav`);
      writeFileSync(wav, recus.get(`/depot/${nom}.wav`)!);
      const m = await mesurerFichier(wav);
      expect(Math.abs(m.lufs - -14)).toBeLessThanOrEqual(0.5);
      expect(m.creteVraieDbtp).toBeLessThanOrEqual(-1.5);
      expect(r.mesures).toMatchObject({ musique: avecMusique ? 1 : 0 });
      expect(Math.abs(r.mesures!.lufs - m.lufs)).toBeLessThan(0.05);
      const sonde = spawnSync("ffprobe", ["-v", "error", "-show_entries", "stream=channels,sample_rate", "-of", "csv=p=0", wav]).stdout.toString().trim();
      expect(sonde).toBe("48000,2");
    });
  }
});
