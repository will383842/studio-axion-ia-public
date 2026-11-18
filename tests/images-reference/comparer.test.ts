// N-10. Le rendu ne tourne pas dans la CI (aucune ligne de `.github/`) : la session qui déploie lance `npx tsx outils/images-reference/rendre-et-comparer.mts` avant toute mise en ligne d'une pièce neuve.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { comparerImages, type ImageRgba } from "./comparer";

function unie(l: number, h: number, v = 100): ImageRgba {
  return { largeur: l, hauteur: h, rgba: new Uint8Array(l * h * 4).fill(v) };
}

describe("comparerImages", () => {
  it("deux images identiques : écart 0", () => {
    const r = comparerImages(unie(100, 100), unie(100, 100));
    expect(r).toMatchObject({ identiques: true, partEcart: 0, pixelsDifferents: 0 });
  });

  it("un carré de 10 × 10 changé sur 100 × 100 : écart 0,01", () => {
    const b = unie(100, 100);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) b.rgba[(y * 100 + x) * 4] = 200;
    const r = comparerImages(unie(100, 100), b);
    expect(r.pixelsDifferents).toBe(100);
    expect(r.partEcart).toBeCloseTo(0.01, 10);
    expect(r.identiques).toBe(false);
  });

  it("un bruit d'au plus 16 par canal est ignoré, 17 est compté", () => {
    expect(comparerImages(unie(10, 10, 100), unie(10, 10, 116)).identiques).toBe(true);
    const r = comparerImages(unie(10, 10, 100), unie(10, 10, 117));
    expect(r.identiques).toBe(false);
    expect(r.partEcart).toBe(1);
  });

  it("le seuil par canal est réglable", () => {
    expect(comparerImages(unie(4, 4, 0), unie(4, 4, 40), { seuilCanal: 50 }).identiques).toBe(true);
  });

  it("tailles différentes : refus", () => {
    const r = comparerImages(unie(10, 10), unie(10, 20));
    expect(r.identiques).toBe(false);
    expect(r.message).toBe("tailles différentes");
  });
});

describe("references.json", () => {
  const dossier = __dirname;
  const refs = JSON.parse(readFileSync(join(dossier, "references.json"), "utf8")) as {
    version: number;
    seuil: number;
    pieces: { id: string; composition: string; image: number; ratio: string; fichier: string }[];
  };

  it("est lisible, version 1, seuil dans ]0 ; 0,05]", () => {
    expect(refs.version).toBe(1);
    expect(refs.seuil).toBeGreaterThan(0);
    expect(refs.seuil).toBeLessThanOrEqual(0.05);
    expect(Array.isArray(refs.pieces)).toBe(true);
  });

  it("chaque fichier cité existe", () => {
    for (const p of refs.pieces) expect(existsSync(join(dossier, "images", p.fichier)), p.id).toBe(true);
  });
});
