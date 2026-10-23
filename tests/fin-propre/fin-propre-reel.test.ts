/**
 * FIN PROPRE (14/10), essai RÉEL avec le FFmpeg du poste : un master synthétique (image animée + son continu, lavfi)
 * passe par l'export du studio (`argumentsExport`) avec et sans `finPropre`, puis la mesure du fichier exporté
 * (`mesurerExport`) est relue par `controleFinPropre`. Avec : durée = master + tenue, son éteint à la dernière 0,1 s,
 * dernières images identiques. Sans : le contrôle dit « la vidéo s'arrête net ».
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { controleFinPropre, FIN_PROPRE_COMMUNE, MOUVEMENT_FIN_MAX, SON_FIN_MAX_DB } from "@/briques/composition/fin-propre";
import type { ParametresExport } from "@/briques/composition/scene";
import { argumentsExport } from "../../studio-rendu/src/composition/ffmpeg";
import { mouvementDernieresImages, niveauFinDb } from "../../studio-rendu/src/composition/fin-video";
import { mesurerExport } from "../../studio-rendu/src/operations/composition";

const ffmpegPresent = spawnSync("ffmpeg", ["-version"]).status === 0;
const DUREE = 3;
const base: ParametresExport = { fps: 25, debitKbps: 2000, debitMaxKbps: 4000, audioKbps: 128, audioHz: 48000, mode: "crf", crf: 23 };

function ffmpeg(args: string[], cwd: string) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", ...args], { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
}

/** Master synthétique (mire animée + son continu à 440 Hz) et calque texte transparent d'une image. */
function preparer(): string {
  const dossier = mkdtempSync(join(tmpdir(), "studio-fin-propre-"));
  ffmpeg(["-f", "lavfi", "-i", `testsrc2=s=320x568:r=25:d=${DUREE}`, "-f", "lavfi", "-i", `sine=f=440:sample_rate=48000:d=${DUREE}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "pcm_s16le", "-shortest", "master.mov"], dossier);
  ffmpeg(["-f", "lavfi", "-i", "color=c=black@0.0:s=320x568,format=rgba", "-frames:v", "1", "t-000000.png"], dossier);
  return dossier;
}

function exporter(dossier: string, e: ParametresExport, nom: string): string {
  const a = argumentsExport("master.mov", "t-%06d.png", e, "passe", nom);
  ffmpeg(a.passe2.filter((x) => x !== "-hide_banner" && x !== "-y"), dossier);
  return join(dossier, nom);
}

describe("fin propre : calculs de la mesure (purs)", () => {
  it("niveau de la dernière 0,1 s : silence -120 dB, sinus fort au-dessus de -60 dB", () => {
    expect(niveauFinDb(new Float32Array(48_000))).toBe(-120);
    const x = Float32Array.from({ length: 48_000 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / 48_000));
    expect(niveauFinDb(x)).toBeGreaterThan(SON_FIN_MAX_DB);
    expect(Number.isNaN(niveauFinDb(new Float32Array(0)))).toBe(true);
  });
  it("mouvement entre les deux dernières images : 0 si identiques, illisible sous deux images", () => {
    const deux = new Uint8Array(8).fill(100);
    expect(mouvementDernieresImages(deux, 4)).toBe(0);
    expect(mouvementDernieresImages(Uint8Array.from([0, 0, 0, 0, 10, 10, 10, 10]), 4)).toBe(10);
    expect(Number.isNaN(mouvementDernieresImages(new Uint8Array(4), 4))).toBe(true);
  });
});

describe.skipIf(!ffmpegPresent)("fin propre : export réel (FFmpeg du poste)", () => {
  const dossier = preparer();

  it("sans fin propre : la mesure voit la coupe sèche, le contrôle dit « la vidéo s'arrête net »", async () => {
    const video = exporter(dossier, base, "sec.mp4");
    const m = await mesurerExport(video, []);
    expect(m.sonDerniere100msDb).toBeGreaterThan(SON_FIN_MAX_DB);
    expect(m.mouvementDerniereImage).toBeGreaterThan(MOUVEMENT_FIN_MAX);
    const defauts = controleFinPropre({ sonDerniere100msDb: m.sonDerniere100msDb, mouvementDerniereImage: m.mouvementDerniereImage });
    expect(defauts.length).toBe(2);
    expect(defauts.join(" ")).toMatch(/s'arrête net/);
  }, 60_000);

  it("avec fin propre : durée = master + tenue, dernière 0,1 s sous -60 dB, dernières images identiques", async () => {
    const video = exporter(dossier, { ...base, finPropre: { ...FIN_PROPRE_COMMUNE, dureeSec: DUREE } }, "propre.mp4");
    const m = await mesurerExport(video, []);
    expect(Math.abs(m.dureeSec - (DUREE + FIN_PROPRE_COMMUNE.tenueSec))).toBeLessThanOrEqual(0.05);
    expect(m.sonDerniere100msDb).toBeLessThan(SON_FIN_MAX_DB);
    expect(m.mouvementDerniereImage).toBeLessThanOrEqual(MOUVEMENT_FIN_MAX);
    expect(controleFinPropre({ sonDerniere100msDb: m.sonDerniere100msDb, mouvementDerniereImage: m.mouvementDerniereImage })).toEqual([]);
  }, 60_000);
});
