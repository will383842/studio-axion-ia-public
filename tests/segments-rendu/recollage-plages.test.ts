import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const deposes: string[] = [];
vi.mock("../../studio-rendu/src/outils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../studio-rendu/src/outils")>()),
  telecharger: async (url: string, chemin: string) => void (await import("node:fs")).copyFileSync(url, chemin),
  deposer: async (_u: string, chemin: string) => void deposes.push(chemin),
}));

import { bornesSurImagesCles, imagesDans, listeConcatPlages, lireParametresRecollage, recollagePlages, type SegmentRecollage } from "../../studio-rendu/src/operations/recollage-plages";
import type { DemandeRendu } from "../../studio-rendu/src/contrat";

const avantPlage: SegmentRecollage[] = [
  { source: "avant", debutSec: 0, finSec: 2 },
  { source: "plage", entree: "p1", dureeSec: 1.5 },
  { source: "avant", debutSec: 4, finSec: 6 },
];
const base = { segments: avantPlage, avant: "avant", voix: "voix", dureeSec: 5.5 };

describe("recollage-plages : paramètres (purs)", () => {
  it("accepte des paramètres valides", () => {
    expect(lireParametresRecollage(base)).toEqual(base);
    expect(lireParametresRecollage({ ...base, voix: undefined }).voix).toBeUndefined();
  });
  it("refuse un trou entre deux tronçons d'avant", () => {
    const segments = [{ source: "avant", debutSec: 0, finSec: 2 }, { source: "avant", debutSec: 3, finSec: 4 }];
    expect(() => lireParametresRecollage({ ...base, segments })).toThrow(/trou/);
  });
  it("refuse un recouvrement", () => {
    const segments = [{ source: "avant", debutSec: 0, finSec: 2 }, { source: "avant", debutSec: 1, finSec: 4 }];
    expect(() => lireParametresRecollage({ ...base, segments })).toThrow(/recouvrement/);
  });
  it("refuse une entrée absente, une durée nulle, une durée de recollage nulle", () => {
    expect(() => lireParametresRecollage({ ...base, segments: [{ source: "plage", dureeSec: 1 }] })).toThrow(/entrée/);
    expect(() => lireParametresRecollage({ ...base, segments: [{ source: "plage", entree: "p", dureeSec: 0 }] })).toThrow(/durée nulle/);
    expect(() => lireParametresRecollage({ ...base, segments: [{ source: "avant", debutSec: 2, finSec: 2 }] })).toThrow(/durée nulle/);
    expect(() => lireParametresRecollage({ ...base, dureeSec: 0 })).toThrow(/Durée/);
    expect(() => lireParametresRecollage({ ...base, avant: "" })).toThrow(/avant/);
    expect(() => lireParametresRecollage({ ...base, segments: [] })).toThrow(/Aucun segment/);
  });
  it("tous les refus sont des ErreurRendu « refuse » non réessayables", () => {
    try { lireParametresRecollage({ ...base, segments: [] }); } catch (e) {
      expect(e).toMatchObject({ name: "ErreurRendu", erreur: { code: "refuse", reessayable: false } });
    }
  });
});

describe("recollage-plages : liste ffconcat et bornes (purs)", () => {
  it("3 segments (avant, plage, avant) → texte exact", () => {
    expect(listeConcatPlages(avantPlage, { avant: "/d/avant.mp4", plages: { p1: "/d/p'1.mp4" } })).toBe(
      ["ffconcat version 1.0", "file '/d/avant.mp4'", "inpoint 0.000000", "outpoint 2.000000", "file '/d/p'\\''1.mp4'", "file '/d/avant.mp4'", "inpoint 4.000000", "outpoint 6.000000", ""].join("\n"),
    );
  });
  it("une borne hors image clé est refusée en la nommant", () => {
    expect(() => bornesSurImagesCles(avantPlage, [0, 2, 4, 6])).not.toThrow();
    expect(() => bornesSurImagesCles(avantPlage, [0, 2, 3.9, 6])).toThrow(/4 s n'est pas une image clé/);
    expect(() => bornesSurImagesCles(avantPlage, [0, 1.5, 4, 6])).toThrow(/2 s/);
    expect(() => bornesSurImagesCles(avantPlage, [])).toThrow(/aucune image clé/);
  });
  it("compte les images d'un tronçon", () => {
    expect(imagesDans([0, 0.04, 0.08, 0.12], { source: "avant", debutSec: 0.04, finSec: 0.12 })).toBe(2);
  });
});

describe("recollage-plages : garde « éteint » (texte)", () => {
  const racine = join(__dirname, "../../studio-rendu/src");
  it("n'importe rien de payant", () => {
    const t = readFileSync(join(racine, "operations/recollage-plages.ts"), "utf8");
    expect(t).not.toMatch(/from\s+["'][^"']*(remotion-lambda|@remotion\/lambda)/);
  });
  it("n'est citée dans aucun fichier d'aiguillage", () => {
    for (const f of ["contrat.ts", "index.ts"]) expect(readFileSync(join(racine, f), "utf8")).not.toMatch(/recollage-plages/);
    expect(readFileSync(join(__dirname, "../../src/fournisseurs/types.ts"), "utf8")).not.toMatch(/recollage-plages/);
  });
});

const ffmpeg = spawnSync("ffmpeg", ["-version"]).status === 0 && spawnSync("ffprobe", ["-version"]).status === 0;
describe.skipIf(!ffmpeg)("recollage-plages : vrai recollage (ffmpeg présent)", () => {
  it("recolle 2 tronçons d'avant et 1 morceau neuf, voix posée", async () => {
    const d = mkdtempSync(join(tmpdir(), "recol-"));
    const ff = (...a: string[]) => execFileSync("ffmpeg", ["-v", "error", "-y", ...a], { cwd: d });
    const enc = ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", "25", "-g", "25", "-keyint_min", "25", "-sc_threshold", "0", "-flags", "+cgop", "-video_track_timescale", "12800", "-colorspace", "bt709", "-color_trc", "bt709", "-color_primaries", "bt709", "-color_range", "tv", "-an"];
    ff("-f", "lavfi", "-i", "testsrc=size=160x120:rate=25:duration=6", ...enc, "avant.mp4");
    ff("-f", "lavfi", "-i", "testsrc2=size=160x120:rate=25:duration=2", ...enc, "p1.mp4");
    ff("-f", "lavfi", "-i", "sine=frequency=440:duration=6", "voix.wav");
    writeFileSync(join(d, "ok"), "");
    const demande: DemandeRendu = { idRendu: "r", operation: "assemblage", file: "longue", entrees: { avant: join(d, "avant.mp4"), p1: join(d, "p1.mp4"), voix: join(d, "voix.wav") }, sortie: { urlDepot: "x", cle: "k" }, parametres: { ...base, segments: [{ source: "avant", debutSec: 0, finSec: 2 }, { source: "plage", entree: "p1", dureeSec: 2 }, { source: "avant", debutSec: 4, finSec: 6 }], dureeSec: 6 } };
    const r = await recollagePlages(demande, { progression: () => {}, dossier: d, signal: new AbortController().signal });
    expect(r.mesures).toMatchObject({ segments: 3, plages: 1, voix: 1 });
    const f = deposes.at(-1)!;
    const n = execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", f]).toString().trim();
    expect(Number(n)).toBe(150);
  }, 60000);
});
