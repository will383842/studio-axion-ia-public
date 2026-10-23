/**
 * LOT M4 — `studio-rendu` : graphes FFmpeg (couleurs, export), chaîne de la voix, ton de pièce, lectures des mesures
 * (PUR) ; puis, avec le FFmpeg du poste (pas de Docker, pas de Remotion) : le son préparé atteint −14 LUFS ±1 et
 * une crête vraie ≤ −1,5 dBTP, les pauses restent entre −48 et −35 dB, et l'export final porte les étiquettes
 * BT.709 / tv / yuv420p, H.264 High 4.1, `+faststart`, AAC 48 kHz stéréo — MESURÉS SUR LE FICHIER EXPORTÉ.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { MotHorodate } from "@/domaine/types";
import { pausesDesMots } from "@/moteurs/montage-avocat/composition";
import { angleVignette, argumentsExport, argumentsMaster, expressionPlages, forceGrain, grapheCouleurs, grapheExport, imageNoireEnTete, lireExport, moovAvantMdat, sourceGrain } from "../studio-rendu/src/composition/ffmpeg";
import { fichierEntree, remplacerReferences } from "../studio-rendu/src/composition/entrees";
import { ajusterRms, bouclerTon, filtreLimiteur, filtresVoix, gainVersCible, preparerSon, rmsDb, tonDeSynthese, versWavFlottant } from "../studio-rendu/src/son/chaine";
import { lireEbur128, lireLoudnorm, mesurerFichier } from "../studio-rendu/src/son/mesure";
import { exporter, mesurerExport } from "../studio-rendu/src/operations/composition";
import { executerAvecErreurs } from "../studio-rendu/src/outils";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;
const EXPORT = { fps: 25, debitKbps: 14000, debitMaxKbps: 16000, audioKbps: 320, audioHz: 48000 };

describe("graphes FFmpeg (purs)", () => {
  it("couleurs : RVB BT.709, LUT tétraédrique sur ses plages, retour YUV tv, vignette, grain en luminance seulement", () => {
    const g = grapheCouleurs({ grainPct: 4, grainTaillePx: 2, vignettePct: 8 }, [{ fichier: "lut-1-melangee.cube", plages: [[0, 2.26], [3.96, 5.51]] }], { largeur: 1080, hauteur: 1920 });
    expect(g).toContain("scale=in_color_matrix=bt709:in_range=tv,format=gbrp");
    expect(g).toContain("lut3d=file=lut-1-melangee.cube:interp=tetrahedral:enable='gte(t\\,0.000)*lt(t\\,2.260)+gte(t\\,3.960)*lt(t\\,5.510)'");
    expect(g).toContain("scale=out_color_matrix=bt709:out_range=tv");
    expect(g).toContain(`vignette=angle=${angleVignette(8)}`);
    expect(g).toContain("noise=c0s=10:c0f=t+u");
    expect(g).toContain("blend=c0_mode=overlay:c1_expr=A:c2_expr=A");
    expect(g).toContain("setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv[v]");
    expect(sourceGrain({ largeur: 1080, hauteur: 1920 }, 2, 25, 12)).toBe("color=c=0x808080:s=540x960:r=25:d=12.000");
    // Aucune LUT, aucun grain : le graphe reste valide.
    expect(grapheCouleurs({ grainPct: 0, grainTaillePx: 2, vignettePct: 0 }, [], { largeur: 1080, hauteur: 1350 })).not.toContain("lut3d");
    expect(expressionPlages([])).toBe("0");
    expect(forceGrain(4)).toBe(10);
    expect(Math.cos(angleVignette(8)) ** 4).toBeCloseTo(0.92, 2);
  });

  it("export : deux passes VBR 12-16 Mb/s, High 4.1, GOP fermé de 2 s, yuv420p étiqueté BT.709 / tv, AAC 320 kb/s 48 kHz stéréo, +faststart", () => {
    const a = argumentsExport("master.mov", "texte/t-%06d.png", EXPORT, "passe", "video.mp4");
    const texte1 = a.passe1.join(" ");
    const texte2 = a.passe2.join(" ");
    for (const t of [texte1, texte2]) {
      expect(t).toContain("-profile:v high -level:v 4.1");
      expect(t).toContain("-b:v 14000k -maxrate 16000k -bufsize 24000k");
      expect(t).toContain("-g 50 -keyint_min 50 -sc_threshold 0 -flags +cgop");
      expect(t).toContain("-pix_fmt yuv420p");
      expect(t).toContain("-color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv");
    }
    expect(texte1).toContain("-pass 1");
    expect(texte1).toContain("-an -f null -");
    expect(texte2).toContain("-pass 2");
    expect(texte2).toContain("-c:a aac -b:a 320k -ar 48000 -ac 2 -movflags +faststart");
    expect(grapheExport()).toContain("overlay=format=gbrp");
    expect(argumentsMaster("image.mp4", "son.wav", "G", "S", "m.mov").join(" ")).toContain("-crf 12 -pix_fmt yuv420p");
    expect(argumentsMaster("image.mp4", "son.wav", "G", "S", "m.mov").join(" ")).toContain("pan=stereo|c0=0.7071*c0|c1=0.7071*c0");
  });

  it("lectures : ffprobe, boîtes MP4 (moov avant mdat), blackdetect, ebur128, loudnorm", () => {
    const probe = lireExport(JSON.stringify({ streams: [{ codec_type: "video", width: 1080, height: 1920, r_frame_rate: "25/1", pix_fmt: "yuv420p", color_primaries: "bt709", color_transfer: "bt709", color_space: "bt709", color_range: "tv", profile: "High", level: 41 }, { codec_type: "audio", sample_rate: "48000", bit_rate: "320000", channels: 2 }], format: { duration: "15.56", size: "27416483", bit_rate: "14096000" } }));
    expect(probe).toMatchObject({ largeur: 1080, hauteur: 1920, fps: 25, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, audioHz: 48000, audioCanaux: 2, debitKbps: 14096 });
    const boite = (type: string, taille: number) => {
      const b = Buffer.alloc(taille);
      b.writeUInt32BE(taille, 0);
      b.write(type, 4, "latin1");
      return b;
    };
    expect(moovAvantMdat(Buffer.concat([boite("ftyp", 24), boite("moov", 40), boite("mdat", 16)]))).toBe(true);
    expect(moovAvantMdat(Buffer.concat([boite("ftyp", 24), boite("mdat", 16), boite("moov", 40)]))).toBe(false);
    expect(imageNoireEnTete("[blackdetect @ 0] black_start:0 black_end:0.08 black_duration:0.08")).toBe(true);
    expect(imageNoireEnTete("[blackdetect @ 0] black_start:4.2 black_end:4.3")).toBe(false);
    const e = lireEbur128("...\n[Parsed_ebur128_0] Summary:\n\n  Integrated loudness:\n    I:         -14.1 LUFS\n    Threshold: -24.4 LUFS\n\n  Loudness range:\n    LRA:         2.3 LU\n\n  True peak:\n    Peak:       -1.9 dBFS\n");
    expect(e).toEqual({ lufs: -14.1, lra: 2.3, creteVraieDbtp: -1.9 });
    expect(lireLoudnorm('{\n "input_i" : "-20.55",\n "input_tp" : "-3.51",\n "input_lra" : "2.10",\n "input_thresh" : "-31.0"\n}')).toEqual({ i: -20.55, tp: -3.51, lra: 2.1, seuil: -31 });
  });

  it("entrées : fichier local avec son extension (sans la signature) ; références `entree:` remplacées partout", () => {
    expect(fichierEntree("decor", "https://r2.exemple/studio/dev/decors/fond-1.jpg?X-Amz-Signature=abc")).toBe("decor.jpg");
    expect(fichierEntree("lut-1", "https://r2/x/axion.cube?s=1")).toBe("lut-1.cube");
    expect(fichierEntree("voix", "https://r2/x/sans-extension")).toBe("voix");
    const props = { decor: { image: "entree:decor" }, plans: [{ illustration: { url: "entree:illu-3" } }], texte: "entree libre" };
    expect(remplacerReferences(props, { decor: "http://127.0.0.1:1/decor.jpg", "illu-3": "http://127.0.0.1:1/illu-3.jpg" })).toEqual({ decor: { image: "http://127.0.0.1:1/decor.jpg" }, plans: [{ illustration: { url: "http://127.0.0.1:1/illu-3.jpg" } }], texte: "entree libre" });
    expect(() => remplacerReferences({ a: "entree:absente" }, {})).toThrow(/absente/);
  });
});

describe("chaîne de la voix et ton de pièce (purs)", () => {
  it("ordre du plan : passe-haut 80 Hz, de-esser, présence ; compression SEULEMENT si le LRA brut dépasse 3 LU, à 3:1 au plus", () => {
    const sans = filtresVoix({ passeHautHz: 80, seuilLra: 3, ratioCompression: 3, lraBrut: 2.1 });
    expect(sans).toEqual(["highpass=f=80:poles=2", "deesser=i=0.5:m=0.5:f=0.5:s=o", "equalizer=f=4000:t=q:w=1.0:g=1.8"]);
    const avec = filtresVoix({ passeHautHz: 80, seuilLra: 3, ratioCompression: 4, lraBrut: 5.2, niveauBrutLufs: -22, attenuationBoiteDb: 1.5 });
    expect(avec.map((f) => f.split("=")[0])).toEqual(["highpass", "equalizer", "acompressor", "deesser", "equalizer"]);
    expect(avec[2]).toContain("ratio=3");
    expect(gainVersCible(-20.55, -14)).toBe(6.55);
    // Voix mono posée au centre du stéréo (−3 dB par canal) : le plafond mono tient compte de cette atténuation.
    expect(filtreLimiteur(-1.5)).toBe("alimiter=limit=0.9661:attack=4:release=60:level=false");
    expect(filtreLimiteur(-6)).toBe("alimiter=limit=0.6173:attack=4:release=60:level=false");
  });

  it("ton de pièce bouclé : départ aléatoire stable, fondu à puissance constante (aucun saut), niveau RMS demandé", () => {
    const src = new Float32Array(48000);
    for (let i = 0; i < src.length; i++) src[i] = 0.2 * Math.sin((2 * Math.PI * 110 * i) / 48000);
    const a = bouclerTon(src, 48000 * 3, 42);
    const b = bouclerTon(src, 48000 * 3, 42);
    expect(a).toEqual(b);
    expect(a.length).toBe(48000 * 3);
    let saut = 0;
    for (let i = 1; i < a.length; i++) saut = Math.max(saut, Math.abs(a[i] - a[i - 1]));
    expect(saut).toBeLessThan(0.02);
    expect(a.every((x) => Number.isFinite(x))).toBe(true);
    const ton = tonDeSynthese(48000 * 2, -42.5, 7);
    expect(rmsDb(ton)).toBeCloseTo(-42.5, 1);
    expect(rmsDb(ajusterRms(Float32Array.from(src), -40))).toBeCloseTo(-40, 1);
    expect(versWavFlottant(new Float32Array(10)).readUInt16LE(20)).toBe(3);
  });
});

describe.skipIf(!ffmpegPresent)("avec le FFmpeg du poste : mesures sur le fichier EXPORTÉ", () => {
  const dossier = mkdtempSync(join(tmpdir(), "studio-m4-"));
  const voix = resolve("tests/fixtures/voix-essai.wav");
  const mots = (JSON.parse(readFileSync("tests/fixtures/voix-essai.json", "utf8")) as { mots: MotHorodate[] }).mots;
  const dureeSec = 11.5;

  it("son : −14 LUFS ±1, crête vraie ≤ −1,5 dBTP, pauses entre −48 et −35 dB (ton de pièce de synthèse)", async () => {
    const son = await preparerSon({ voix, dureeSec, dossier, passeHautHz: 80, seuilLraCompression: 3, ratioCompression: 3, lufs: -14, creteVraieMaxDbtp: -1.5, tonPieceDb: -42.5, graine: 3 });
    expect(son.tonDeSynthese).toBe(true);
    expect(son.compression).toBe(son.lraBrut > 3);
    // Encodage AAC comme l'export, puis mesure sur ce fichier.
    const m4a = join(dossier, "son.m4a");
    await executerAvecErreurs("ffmpeg", ["-hide_banner", "-y", "-i", son.chemin, "-c:a", "aac", "-b:a", "320k", "-ar", "48000", "-ac", "2", m4a]);
    const m = await mesurerFichier(m4a, pausesDesMots(mots));
    expect(Math.abs(m.lufs + 14)).toBeLessThanOrEqual(1);
    expect(m.creteVraieDbtp).toBeLessThanOrEqual(-1.5);
    expect(m.pauses).toBeGreaterThan(0);
    expect(m.pauseMinDb).toBeGreaterThanOrEqual(-48);
    expect(m.pauseMaxDb).toBeLessThanOrEqual(-35);
  }, 60_000);

  it("couleurs puis export : étiquettes BT.709 / tv / yuv420p, High 4.1, 25 i/s, +faststart, AAC 48 kHz stéréo, aucune image noire", async () => {
    const lut = join(dossier, "lut-1-melangee.cube");
    copyFileSync(resolve("public/luts/axion-buffer-clair-obscur.cube"), lut);
    // Calques image d'essai (2 s, 1080 × 1920) et son préparé.
    await executerAvecErreurs("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "testsrc2=s=1080x1920:r=25:d=2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "12", join(dossier, "image.mp4")]);
    await executerAvecErreurs("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "sine=f=220:d=2:sample_rate=48000", "-af", "volume=-16dB", join(dossier, "son.wav")]);
    const graphe = grapheCouleurs({ grainPct: 4, grainTaillePx: 2, vignettePct: 8 }, [{ fichier: "lut-1-melangee.cube", plages: [[0, 1]] }], { largeur: 1080, hauteur: 1920 });
    await executerAvecErreurs("ffmpeg", argumentsMaster("image.mp4", "son.wav", graphe, sourceGrain({ largeur: 1080, hauteur: 1920 }, 2, 25, 2), "master-sans-texte.mov"), undefined, dossier);
    // Calques texte : 50 images PNG transparentes (un carré orange au centre).
    mkdirSync(join(dossier, "texte"), { recursive: true });
    await executerAvecErreurs("ffmpeg", ["-hide_banner", "-y", "-f", "lavfi", "-i", "color=c=black@0.0:s=1080x1920:r=25:d=2,format=rgba,drawbox=x=440:y=860:w=200:h=200:color=0xE07040@1:t=fill:replace=1", "-frames:v", "50", join(dossier, "texte", "t-%06d.png")]);
    const video = await exporter(join(dossier, "master-sans-texte.mov"), join(dossier, "texte"), EXPORT, dossier);
    const m = await mesurerExport(video, []);
    expect(m).toMatchObject({ largeur: 1080, hauteur: 1920, fps: 25, bt709: 1, plageTv: 1, yuv420p: 1, profilHigh: 1, niveau: 41, faststart: 1, imageNoireTete: 0, audioHz: 48000, audioCanaux: 2 });
    expect(m.dureeSec).toBeCloseTo(2, 0);
    // Le texte est posé APRÈS les couleurs : l'orange du calque texte ne passe pas dans la LUT.
    const px = spawnSync("ffmpeg", ["-v", "error", "-ss", "0.5", "-i", video, "-frames:v", "1", "-vf", "crop=20:20:530:950,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).stdout;
    expect(Math.abs(px[0] - 0xe0)).toBeLessThan(14);
    expect(Math.abs(px[1] - 0x70)).toBeLessThan(14);
    expect(Math.abs(px[2] - 0x40)).toBeLessThan(14);
  }, 120_000);
});
