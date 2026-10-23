/**
 * Lot D · RÉPÉTITION GÉNÉRALE sur de vrais fichiers locaux (ffmpeg local, 0 appel payant, 0 réseau).
 * Trois segments vidéo+son réellement encodés (9:16), puis, pour chaque réseau, le plan des adaptations est appliqué
 * et le montage est réellement assemblé ; la durée est relue par ffprobe.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { boucleVisuelle, habillageReseau, ratioReseau, segmentsFacultatifsRetenus } from "@/reseaux/adaptations";
import type { ReseauDeclinaison } from "@/domaine/types";

const ffmpegLa = spawnSync("ffmpeg", ["-version"]).status === 0;
const sinon = ffmpegLa ? describe : describe.skip;

const SEGMENTS = [
  { id: "corps", dureeSec: 30, facultatif: false },
  { id: "fac1", dureeSec: 8, facultatif: true },
  { id: "fac2", dureeSec: 8, facultatif: true },
];

let dossier = "";
const chemin = (id: string) => join(dossier, `${id}.mp4`);
const duree = (f: string) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f]).toString());
const dimensions = (f: string) => execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f]).toString().trim();

function assembler(ids: string[], sortie: string) {
  const liste = join(dossier, `liste-${ids.join("-")}.txt`);
  writeFileSync(liste, ids.map((i) => `file '${chemin(i)}'`).join("\n"));
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", sortie]);
}

sinon("répétition générale lot D (vrais fichiers)", () => {
  beforeAll(() => {
    dossier = mkdtempSync(join(tmpdir(), "lot-d-"));
    for (const s of SEGMENTS) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=navy:s=216x384:r=25:d=${s.dureeSec}`, "-f", "lavfi", "-i", `sine=frequency=440:duration=${s.dureeSec}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", chemin(s.id)]);
    }
  }, 60_000);
  afterAll(() => rmSync(dossier, { recursive: true, force: true }));

  it("les fichiers sources existent vraiment et font la durée annoncée", () => {
    for (const s of SEGMENTS) expect(duree(chemin(s.id))).toBeCloseTo(s.dureeSec, 0);
    expect(dimensions(chemin("corps"))).toBe("216,384");
  });

  it("réglage coupé : le montage de chaque réseau garde tout (46 s), rien n'est adapté", () => {
    const retenus = segmentsFacultatifsRetenus({ actif: false, origine: "machine", reseau: "tiktok", dureeSansFacultatifSec: 30, facultatifs: SEGMENTS.filter((s) => s.facultatif) });
    const sortie = join(dossier, "coupe-off.mp4");
    assembler(["corps", ...retenus], sortie);
    expect(duree(sortie)).toBeCloseTo(46, 0);
    expect(habillageReseau({ actif: false, origine: "machine", reseau: "tiktok", ratio: "9:16" })).toBeNull();
  });

  const attendu: Record<ReseauDeclinaison, { ids: string[]; duree: number }> = {
    tiktok: { ids: ["corps"], duree: 30 },
    instagram: { ids: ["corps"], duree: 30 },
    facebook: { ids: ["corps"], duree: 30 },
    "youtube-shorts": { ids: ["corps"], duree: 30 },
    linkedin: { ids: ["corps", "fac1", "fac2"], duree: 46 },
  };
  for (const reseau of Object.keys(attendu) as ReseauDeclinaison[]) {
    it(`réglage allumé · ${reseau} : coupes, montage réel, boucle, ratio, habillage`, () => {
      const fac = SEGMENTS.filter((s) => s.facultatif);
      const retenus = segmentsFacultatifsRetenus({ actif: true, origine: "machine", reseau, dureeSansFacultatifSec: 30, facultatifs: fac });
      const sortie = join(dossier, `sortie-${reseau}.mp4`);
      assembler(["corps", ...retenus], sortie);
      expect(["corps", ...retenus]).toEqual(attendu[reseau].ids);
      expect(duree(sortie)).toBeCloseTo(attendu[reseau].duree, 0);
      expect(ratioReseau({ actif: true, origine: "machine", reseau, disponibles: ["9:16"], mere: "9:16" })).toBe("9:16");
      const h = habillageReseau({ actif: true, origine: "machine", reseau, ratio: "9:16" });
      expect(h).not.toBeNull();
      expect(h!.sousTitres.margeBasPct).toBeGreaterThan(0);
      expect(typeof boucleVisuelle({ actif: true, origine: "machine", reseau, typeAppel: "envoi" })).toBe("boolean");
    });
  }
});
