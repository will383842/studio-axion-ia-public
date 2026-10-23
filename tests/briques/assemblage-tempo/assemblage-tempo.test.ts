/**
 * C4 · assemblage : option `tempo` pour la sortie son. Décodage et FFmpeg remplacés par des doubles (la passe `atempo`
 * du double rééchantillonne simplement le WAV) ; une dernière série, sur le vrai FFmpeg du poste, mesure la durée réelle.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => ({ ffmpeg: [] as string[][], reel: false }));
const n = 48_000;
const SONS: Record<string, Float32Array> = {
  "mere.wav": Float32Array.from({ length: 8 * n }, (_, i) => Math.sin(i / 7) * 0.5),
  "partiel.wav": Float32Array.from({ length: 5 * n }, (_, i) => Math.cos(i / 5) * 0.3),
};

vi.mock("../../../studio-rendu/src/audio/pcm", async (orig) => {
  const vrai = await orig<typeof import("../../../studio-rendu/src/audio/pcm")>();
  return { ...vrai, decoderPcm: async (s: string, signal?: AbortSignal) => (doubles.reel ? vrai.decoderPcm(s, signal) : SONS[s]) };
});

/** Double de FFmpeg : compte les appels ; pour `atempo`, réécrit le WAV d'entrée raccourci du facteur demandé. */
vi.mock("../../../studio-rendu/src/outils", async (orig) => {
  const vrai = await orig<typeof import("../../../studio-rendu/src/outils")>();
  const { readFile: lire, writeFile: ecrire } = await import("node:fs/promises");
  return {
    ...vrai,
    executer: async (commande: string, args: string[], signal?: AbortSignal) => {
      doubles.ffmpeg.push(args);
      if (doubles.reel) return vrai.executer(commande, args, signal);
      const filtre = args[args.indexOf("-af") + 1] ?? "";
      const t = Number(/atempo=([\d.]+)/.exec(filtre)?.[1]);
      const entree = await lire(args[args.indexOf("-i") + 1]);
      const m = (entree.length - 44) / 2;
      const k = Math.round(m / t);
      const sortie = Buffer.alloc(44 + 2 * k);
      entree.copy(sortie, 0, 0, 44);
      sortie.writeUInt32LE(36 + 2 * k, 4);
      sortie.writeUInt32LE(2 * k, 40);
      for (let i = 0; i < k; i++) sortie.writeInt16LE(entree.readInt16LE(44 + 2 * Math.min(m - 1, Math.floor(i * t))), 44 + 2 * i);
      await ecrire(args.at(-1)!, sortie);
      return "";
    },
  };
});

const { assemblerFichiers } = await import("../../../studio-rendu/src/operations/assemblage");
const { ErreurRendu } = await import("../../../studio-rendu/src/contrat");

/** Exemple de `tests/g6-moteur.test.ts` : début neuf (« partiel »), deux morceaux du corps de la mère, fin neuve. */
const MORCEAUX = [
  { entree: "partiel", deSec: 0, aSec: 2.4 },
  { entree: "mere", deSec: 1.2, aSec: 3.6 },
  { entree: "mere", deSec: 4.1, aSec: 6.8 },
  { entree: "partiel", deSec: 2.6, aSec: 4.9 },
];
const FICHIERS = { mere: "mere.wav", partiel: "partiel.wav" };
/** Relevé sur `master` avant C4 (même exemple, mêmes doubles). */
const AVANT = {
  sha256: "5f9be11babdf19fd209338a19813f7e3ce75c072b6af824e52b605574214526d",
  mesures: { dureeSec: 9.800104166666667, morceaux: 4, "morceau.0.debut": 0, "morceau.1.debut": 2.3997, "morceau.2.debut": 4.8, "morceau.3.debut": 7.4999 },
};

let dossier = "";
beforeEach(async () => {
  doubles.ffmpeg.length = 0;
  doubles.reel = false;
  dossier = await mkdtemp(join(tmpdir(), "essai-c4-"));
});
afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

const dureeWav = (b: Buffer) => b.readUInt32LE(40) / 2 / n;

describe("C4 · assemblage sans tempo : rien ne change", () => {
  it("même WAV octet pour octet, mêmes mesures, aucun appel FFmpeg", async () => {
    const r = await assemblerFichiers(FICHIERS, { sortie: "wav", morceaux: MORCEAUX }, dossier);
    expect(createHash("sha256").update(await readFile(r.chemin)).digest("hex")).toBe(AVANT.sha256);
    expect(r.mesures).toEqual(AVANT.mesures);
    expect(doubles.ffmpeg).toHaveLength(0);
  });
});

describe("C4 · tempo 1,08", () => {
  it("une passe atempo après l'écriture du WAV ; durée et places divisées par 1,08 (à 5 ms près)", async () => {
    const r = await assemblerFichiers(FICHIERS, { sortie: "wav", morceaux: MORCEAUX, tempo: 1.08 }, dossier);
    expect(doubles.ffmpeg).toHaveLength(1);
    expect(doubles.ffmpeg[0].join(" ")).toContain("atempo=1.08");
    expect(r.chemin.endsWith("assemblage.wav")).toBe(true);
    expect(dureeWav(await readFile(r.chemin))).toBeCloseTo(AVANT.mesures.dureeSec / 1.08, 2);
    expect(Math.abs(r.mesures.dureeSec - AVANT.mesures.dureeSec / 1.08)).toBeLessThanOrEqual(0.005);
    expect(r.mesures.tempo).toBe(1.08);
    expect(r.mesures.dureeAvantTempoSec).toBe(AVANT.mesures.dureeSec);
    expect(r.mesures.morceaux).toBe(4);
    for (let i = 0; i < 4; i++) {
      const avant = AVANT.mesures[`morceau.${i}.debut` as keyof typeof AVANT.mesures];
      expect(Math.abs(r.mesures[`morceau.${i}.debut`] - avant / 1.08)).toBeLessThanOrEqual(0.005);
    }
  });

  it("refus non réessayables : tempo avec mp4, tempo hors de 0,90-1,25, tempo illisible", async () => {
    const video = { largeur: 1080, hauteur: 1920, fps: 25 };
    for (const p of [
      { sortie: "mp4", morceaux: MORCEAUX, video, tempo: 1.08 },
      { sortie: "wav", morceaux: MORCEAUX, tempo: 2 },
      { sortie: "wav", morceaux: MORCEAUX, tempo: 0.89 },
      { sortie: "wav", morceaux: MORCEAUX, tempo: 1.26 },
      { sortie: "wav", morceaux: MORCEAUX, tempo: "1.08" },
      { sortie: "wav", morceaux: MORCEAUX, tempo: Number.NaN },
    ]) {
      const e = await assemblerFichiers(FICHIERS, p, dossier).catch((x: unknown) => x);
      expect(e, JSON.stringify(p)).toBeInstanceOf(ErreurRendu);
      expect((e as InstanceType<typeof ErreurRendu>).erreur).toMatchObject({ code: "refuse", reessayable: false });
    }
    expect(doubles.ffmpeg).toHaveLength(0);
    for (const tempo of [0.9, 1.25]) await expect(assemblerFichiers(FICHIERS, { sortie: "wav", morceaux: MORCEAUX, tempo }, dossier)).resolves.toBeTruthy();
  });
});

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;

describe.skipIf(!ffmpegPresent)("C4 · tempo sur le vrai FFmpeg du poste", { timeout: 60_000 }, () => {
  it("atempo=1.08 : durée réelle = durée / 1,08 à 5 ms près, WAV 48 kHz mono 16 bits", async () => {
    doubles.reel = true;
    const { versWav, decoderPcm } = await import("../../../studio-rendu/src/audio/pcm");
    await writeFile(join(dossier, "mere.wav"), versWav(SONS["mere.wav"]));
    await writeFile(join(dossier, "partiel.wav"), versWav(SONS["partiel.wav"]));
    const fichiers = { mere: join(dossier, "mere.wav"), partiel: join(dossier, "partiel.wav") };
    const r = await assemblerFichiers(fichiers, { sortie: "wav", morceaux: MORCEAUX, tempo: 1.08 }, dossier);
    const relu = await decoderPcm(r.chemin);
    expect(Math.abs(relu.length / n - r.mesures.dureeAvantTempoSec / 1.08)).toBeLessThanOrEqual(0.005);
    expect(Math.abs(r.mesures.dureeSec - relu.length / n)).toBeLessThanOrEqual(0.001);
    const tete = await readFile(r.chemin);
    expect(tete.toString("ascii", 0, 4)).toBe("RIFF");
    expect(tete.readUInt16LE(22)).toBe(1);
    expect(tete.readUInt32LE(24)).toBe(n);
  });
});
