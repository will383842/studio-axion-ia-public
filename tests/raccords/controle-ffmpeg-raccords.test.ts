/**
 * C6-H24c-d · le contrôle réel de FFmpeg (avant mise en ligne) exécute aussi le graphe des fondus entre illustrations (xfade).
 * Test sans FFmpeg : la liste des contrôles et les arguments construits ; l'exécution réelle est dans tests/ffmpeg-reel.test.ts.
 */
import { describe, expect, it } from "vitest";
import { argumentsImageFfmpeg } from "../../studio-rendu/src/composition/image-ffmpeg";
import { argumentsMasterRaccords, controles, FICHIERS_RACCORDS, proprietesIllustrations } from "../../studio-rendu/src/controle-ffmpeg";

const NOM = "master tableau 8 bits avec fondus entre illustrations (argumentsImageFfmpeg + xfade)";
const filtre = (a: string[]) => a[a.indexOf("-filter_complex") + 1] ?? "";

describe("contrôle des fondus entre illustrations", () => {
  it("(a) est dans la liste, juste après le master face caméra 10 bits, avant l'écran divisé et le recollage (qui restent en fin)", () => {
    const noms = controles("/tmp/inutile").map((c) => c.nom);
    expect(noms).toContain(NOM);
    const i = noms.indexOf(NOM);
    expect(noms[i - 1]).toBe("master face caméra 10 bits (argumentsImageFfmpeg)");
    expect(i).toBeLessThan(noms.findIndex((n) => n.includes("graphe écran divisé")));
    expect(noms[noms.length - 2]).toContain("graphe écran divisé");
    expect(noms[noms.length - 1]).toContain("recollage");
  });

  it("(b) les arguments exécutés contiennent un fondu (xfade=fade) et un glissement, aucun concat des 3 plans", () => {
    const g = filtre(argumentsMasterRaccords());
    expect(g).toContain("xfade=transition=fade");
    expect(g).toMatch(/xfade=transition=slide/);
    expect(g).not.toContain("concat=n=3");
  });

  it("(b bis) les propriétés : 3 plans illustration d'au moins 0,6 s, 9:16, images = durée × fps", () => {
    const p = proprietesIllustrations();
    expect(p.ratio).toBe("9:16");
    expect(p.plans).toHaveLength(3);
    for (const pl of p.plans) {
      expect(pl.type).toBe("illustration");
      expect(pl.finSec - pl.debutSec).toBeGreaterThanOrEqual(0.6);
    }
    expect(p.images).toBe(Math.round(p.plans[2]!.finSec * p.fps));
    expect(p.raccords).toEqual([{ indexAvant: 0, type: "fondu" }, { indexAvant: 1, type: "glissement" }]);
  });

  it("(c) garde : les mêmes propriétés SANS raccords donnent le graphe concat (le contrôle teste bien le chemin des fondus)", () => {
    const { raccords: _r, ...sans } = proprietesIllustrations();
    const g = filtre(argumentsImageFfmpeg(sans, { grainPct: 4, grainTaillePx: 2, vignettePct: 12 }, FICHIERS_RACCORDS, sans.images / sans.fps, "x.mov", { fils: 2 }).slice(2));
    expect(g).toContain("concat=n=3");
    expect(g).not.toContain("xfade");
  });
});
