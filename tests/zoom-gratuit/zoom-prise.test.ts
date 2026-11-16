/**
 * Fiche C8-Z08a : fenêtres de zoom → filtre FFmpeg crop/scale (pur, non branché).
 */
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
      "scale=w='trunc(iw*if(between(t,2,5),1.05,1)/2)*2':h='trunc(ih*if(between(t,2,5),1.05,1)/2)*2':eval=frame,crop=1080:1920:'(iw-ow)/2':'(ih-oh)/2'",
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
      "scale=w='trunc(iw*if(between(t,2,5),1.05,if(between(t,10,12),1.04,1))/2)*2':h='trunc(ih*if(between(t,2,5),1.05,if(between(t,10,12),1.04,1))/2)*2':eval=frame,crop=1080:1920:'(iw-ow)/2':'(ih-oh)/2'",
    );
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
