import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { argumentsMiniExportRecollable, controles } from "../../studio-rendu/src/controle-ffmpeg";
import { REGLAGES_RECOLLABLES } from "../../studio-rendu/src/composition/reglages-recollables";

const NOM = "recollage de deux mini-exports recollables (G11-04 : -c copy, mêmes images, temps croissants, son posé une fois)";

describe("argumentsMiniExportRecollable (G11-04)", () => {
  const a = argumentsMiniExportRecollable("p.mp4", 0, 0.6, "s.mp4");
  it("contient chaque réglage recollable une seule fois, -an, libx264, et finit par la sortie", () => {
    for (const [option, valeur] of REGLAGES_RECOLLABLES) {
      expect(a.filter((x) => x === option)).toHaveLength(1);
      expect(a[a.indexOf(option) + 1]).toBe(valeur);
    }
    expect(a).toContain("-an");
    expect(a.join(" ")).toContain("-c:v libx264");
    expect(a[a.length - 1]).toBe("s.mp4");
  });
  it("pose les étiquettes BT.709 dans le graphe (setparams), pas en options de sortie (FFmpeg 7.1 et plus les ignore)", () => {
    expect(a[a.indexOf("-vf") + 1]).toBe("format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv");
    for (const option of ["-color_primaries", "-color_trc", "-colorspace", "-color_range"]) expect(a).not.toContain(option);
  });
  it("place -ss avant -i", () => {
    expect(a.indexOf("-ss")).toBeGreaterThanOrEqual(0);
    expect(a.indexOf("-ss")).toBeLessThan(a.indexOf("-i"));
  });
});

describe("liste des contrôles (G11-04)", () => {
  it("la nouvelle entrée est la dernière, juste après « graphe écran divisé »", () => {
    const noms = controles("/tmp/inutile").map((c) => c.nom);
    expect(noms[noms.length - 1]).toBe(NOM);
    expect(noms[noms.length - 2]).toContain("graphe écran divisé");
    expect(noms.slice(0, -1)).not.toContain(NOM);
  });
});

const ffmpeg = spawnSync(process.env.FFMPEG ?? "ffmpeg", ["-hide_banner", "-version"]).status === 0;
if (!ffmpeg) console.warn("[controle-recollage] FFmpeg introuvable : contrôle réel NON exécuté, test sauté.");

describe.skipIf(!ffmpeg)("recollage réel (G11-04)", () => {
  it("prise, voix puis recollage : aucune exception", async () => {
    const dossier = await mkdtemp(join(tmpdir(), "recollage-"));
    try {
      const liste = controles(dossier);
      for (const nom of ["source : prise 8 bits", "source : voix", NOM]) {
        const c = liste.find((x) => x.nom === nom);
        expect(c, nom).toBeDefined();
        await c!.executer();
      }
    } finally {
      await rm(dossier, { recursive: true, force: true });
    }
  }, 120_000);
});
