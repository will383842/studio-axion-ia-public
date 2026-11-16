/**
 * Fiche C8-Z08a : fenêtres de zoom → filtre FFmpeg crop/scale (pur, non branché).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { filtreZoomPrise } from "../../studio-rendu/src/composition/zoom-prise";

describe("filtreZoomPrise", () => {
  it("liste vide → chaîne vide", () => {
    expect(filtreZoomPrise([], 1080, 1920)).toBe("");
  });

  it("une fenêtre → expression attendue au caractère", () => {
    expect(filtreZoomPrise([{ debutSec: 2, finSec: 5, facteur: 1.05 }], 1080, 1920)).toBe(
      "scale=w='trunc(iw*if(between(t,2,5),1.05,1)/2)*2':h='trunc(ih*if(between(t,2,5),1.05,1)/2)*2':eval=frame,crop=1080:1920:'(trunc(1080*if(between(t,2,5),1.05,1)/2)*2-1080)/2':'(trunc(1920*if(between(t,2,5),1.05,1)/2)*2-1920)/2'",
    );
  });

  it("deux fenêtres, triées", () => {
    expect(
      filtreZoomPrise(
        [
          { debutSec: 10, finSec: 12, facteur: 1.04 },
          { debutSec: 2, finSec: 5, facteur: 1.05 },
        ],
        1080,
        1920,
      ),
    ).toBe(
      "scale=w='trunc(iw*if(between(t,2,5),1.05,if(between(t,10,12),1.04,1))/2)*2':h='trunc(ih*if(between(t,2,5),1.05,if(between(t,10,12),1.04,1))/2)*2':eval=frame,crop=1080:1920:'(trunc(1080*if(between(t,2,5),1.05,if(between(t,10,12),1.04,1))/2)*2-1080)/2':'(trunc(1920*if(between(t,2,5),1.05,if(between(t,10,12),1.04,1))/2)*2-1920)/2'",
    );
  });

  it("x/y du crop dépendent du facteur (zoom centré, pas ancré en haut à gauche)", () => {
    const f = filtreZoomPrise([{ debutSec: 1, finSec: 2, facteur: 1.08 }], 320, 240);
    expect(f).toContain("crop=320:240:'(trunc(320*if(between(t,1,2),1.08,1)/2)*2-320)/2'");
    expect(f).toContain("'(trunc(240*if(between(t,1,2),1.08,1)/2)*2-240)/2'");
    expect(f).not.toContain("(iw-ow)");
  });

  it("facteur 1,2 → 1,08", () => {
    expect(filtreZoomPrise([{ debutSec: 1, finSec: 3, facteur: 1.2 }], 100, 100)).toContain("1.08");
  });

  it("chevauchement → erreur claire", () => {
    expect(() =>
      filtreZoomPrise(
        [
          { debutSec: 1, finSec: 4, facteur: 1.05 },
          { debutSec: 3, finSec: 6, facteur: 1.05 },
        ],
        100,
        100,
      ),
    ).toThrow(/chevauche/);
  });

  it("fenêtre invalide → erreur", () => {
    expect(() => filtreZoomPrise([{ debutSec: 5, finSec: 5, facteur: 1.05 }], 100, 100)).toThrow();
  });

  it("même entrée = même sortie", () => {
    const f = [{ debutSec: 2, finSec: 5, facteur: 1.05 }];
    expect(filtreZoomPrise(f, 1080, 1920)).toBe(filtreZoomPrise(f, 1080, 1920));
  });
});

const aFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

function image(vf: string, t: number): Buffer {
  const args = ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25:duration=3", "-vf", vf, "-ss", String(t), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"];
  return execFileSync("ffmpeg", args, { maxBuffer: 1 << 24 });
}
function ecart(a: Buffer, b: Buffer): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

describe.skipIf(!aFfmpeg)("ffmpeg réel : zoom centré", () => {
  const filtre = filtreZoomPrise([{ debutSec: 1, finSec: 2, facteur: 1.08 }], 320, 240);
  it("mi-fenêtre = recadrage centré, hors fenêtre = image d'origine", () => {
    const zoome = image(filtre, 1.5);
    const centre = image("scale=344:258,crop=320:240:12:9", 1.5);
    const coin = image("scale=344:258,crop=320:240:0:0", 1.5);
    expect(ecart(zoome, centre)).toBeLessThan(5);
    expect(ecart(zoome, coin)).toBeGreaterThan(15);
    expect(ecart(image(filtre, 0.5), image("null", 0.5))).toBe(0);
    expect(ecart(image(filtre, 2.5), image("null", 2.5))).toBe(0);
  });
});

describe("garde : zoom-prise non branché", () => {
  it("aucun fichier existant n'importe zoom-prise", () => {
    const racine = resolve(__dirname, "../..");
    const trouves: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules" || n === ".git" || n === ".next") continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n) && !p.endsWith("zoom-prise.ts") && !p.endsWith("zoom-prise.test.ts")) {
          if (/from\s+["'][^"']*zoom-prise["']/.test(readFileSync(p, "utf8"))) trouves.push(p);
        }
      }
    };
    parcourir(join(racine, "src"));
    parcourir(join(racine, "studio-rendu/src"));
    expect(trouves).toEqual([]);
  });
});
