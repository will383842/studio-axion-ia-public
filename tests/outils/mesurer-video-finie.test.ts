// T-EXT-54b : lanceur commun de mesure de la vidéo finie. Aucun FFmpeg réel : le lancement de processus est remplacé.
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appels: string[][] = [];
let reponse: (args: string[]) => { error?: Error; stderr: string } = () => ({ stderr: "" });
vi.mock("node:child_process", () => ({
  spawnSync: (_p: string, args: string[]) => {
    appels.push(args);
    return reponse(args);
  },
}));

// @ts-expect-error : `outils/` est hors tsconfig, l'extension .mts n'est pas permise à tsc
import { dureeMs, lireOptions, principal } from "../../outils/mesures/mesurer-video-finie.mts";

const TEXTE = readFileSync(new URL("../../outils/mesures/mesurer-video-finie.mts", import.meta.url), "utf8");
const CLOUD = { CI: "true" };
const FIGE_2S = "[freezedetect @ 0x1] lavfi.freezedetect.freeze_start: 3\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_duration: 2\n[freezedetect @ 0x1] lavfi.freezedetect.freeze_end: 5\n  Duration: 00:00:20.00, start: 0\n";

let dossier: string;
let sortie: string;
beforeEach(() => {
  appels.length = 0;
  reponse = () => ({ stderr: FIGE_2S });
  dossier = mkdtempSync(join(tmpdir(), "mesure-video-"));
  sortie = join(dossier, "sortie");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dossier, { recursive: true, force: true });
});

describe("mesurer-video-finie : lecture du texte", () => {
  it("appelle la garde d'environnement avant le premier lancement de FFmpeg", () => {
    expect(TEXTE).toMatch(/environnementAutorise\(/);
    const garde = TEXTE.indexOf("environnementAutorise(env");
    expect(garde).toBeGreaterThan(0);
    expect(garde).toBeLessThan(TEXTE.indexOf("lancerFfmpeg([\"-version\"])"));
    expect(TEXTE.match(/spawnSync\(/g)).toHaveLength(1); // un seul appel, dans lancerFfmpeg
  });
  it("ne contient ni réseau, ni navigateur, ni mot propre à un générateur", () => {
    expect(TEXTE).not.toMatch(/http/i);
    expect(TEXTE).not.toMatch(/chromium|playwright/i);
    expect(TEXTE).not.toMatch(/tutoriel/i);
    expect(TEXTE).not.toMatch(/@\/services|montage-/);
  });
  it("importe les formules de la pièce commune et ne les réécrit pas", () => {
    expect(TEXTE).toContain("src/briques/controle-image/mesures-video");
    expect(TEXTE).not.toMatch(/freezedetect=|blackdetect=|ssim=/);
  });
});

describe("mesurer-video-finie : arguments", () => {
  it("refuse une sortie dans le dépôt, une adresse réseau, un argument inconnu", () => {
    expect(() => lireOptions(["--video", "a.mp4", "--sortie", "outils/mesures/x"])).toThrow(/hors du dépôt/);
    expect(() => lireOptions(["--video", "https://x.invalid/a.mp4", "--sortie", dossier])).toThrow(/réseau/);
    expect(() => lireOptions(["--video", "a.mp4", "--sortie", dossier, "--autre", "1"])).toThrow(/inconnu/);
    expect(() => lireOptions(["--video", "a.mp4", "--source", "s.mp4", "--sortie", dossier])).toThrow(/vont ensemble/);
  });
  it("accepte une sortie hors du dépôt", () => {
    expect(lireOptions(["--video", "a.mp4", "--sortie", sortie, "--fin-utile-ms", "1000"]).finUtileMs).toBe(1000);
  });
  it("lit la durée", () => {
    expect(dureeMs("Duration: 00:01:02.50, start")).toBe(62500);
    expect(dureeMs("rien")).toBeUndefined();
  });
});

describe("mesurer-video-finie : exécution à blanc", () => {
  it("environnement interdit : code 3 et rien n'est lancé", () => {
    expect(principal(["--video", "a.mp4", "--sortie", sortie], {}, "linux")).toBe(3);
    expect(principal(["--video", "a.mp4", "--sortie", sortie], CLOUD, "win32")).toBe(3);
    expect(appels).toHaveLength(0);
    expect(existsSync(sortie)).toBe(false);
  });
  it("FFmpeg absent : code 5", () => {
    const video = join(dossier, "v.mp4");
    writeFileSync(video, "x");
    reponse = () => ({ error: new Error("absent"), stderr: "" });
    expect(principal(["--video", video, "--sortie", sortie], CLOUD, "linux")).toBe(5);
    expect(existsSync(sortie)).toBe(false);
  });
  it("sans --zones : seulement les détections, écrites sous --sortie", () => {
    const video = join(dossier, "v.mp4");
    writeFileSync(video, "x");
    expect(principal(["--video", video, "--sortie", sortie], CLOUD, "linux")).toBe(0);
    expect(appels).toHaveLength(2); // version, détections
    expect(appels[1]!.join(" ")).toContain("freezedetect");
    const json = JSON.parse(readFileSync(join(sortie, "mesures-video.json"), "utf8"));
    expect(json.zones).toEqual([]);
    expect(json.mesures.imagesFigeesHorsFin).toBe(1);
    expect(json.mesures.imageNoireTete).toBe(0);
  });
  it("avec --zones : une mesure de netteté par zone et une note", () => {
    const video = join(dossier, "v.mp4");
    const source = join(dossier, "s.mp4");
    const zones = join(dossier, "zones.json");
    writeFileSync(video, "x");
    writeFileSync(source, "x");
    const r = { x: 0, y: 0, largeur: 100, hauteur: 50 };
    writeFileSync(zones, JSON.stringify([{ id: "e1#q1", tSourceSec: 1, tVideoSec: 1, rectSource: r, rectVideo: r, echelleSource: 0.5 }]));
    reponse = (a) => ({ stderr: a.includes("-filter_complex") ? "SSIM Y:0.5 All:0.8400 (7.9)" : FIGE_2S });
    expect(principal(["--video", video, "--source", source, "--zones", zones, "--sortie", sortie], CLOUD, "linux")).toBe(0);
    expect(appels).toHaveLength(3);
    const json = JSON.parse(readFileSync(join(sortie, "mesures-video.json"), "utf8"));
    expect(json.zones[0].verdict).toBe("a-revoir");
    expect(json.zones[0].raisons.join(" ")).not.toMatch(/ssim/i);
  });
  it("sortie dans le dépôt : refus, rien n'est lancé", () => {
    expect(principal(["--video", "a.mp4", "--sortie", "outils/mesures/zz"], CLOUD, "linux")).toBe(4);
    expect(appels).toHaveLength(0);
  });
});
