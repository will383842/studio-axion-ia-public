/**
 * C5-5.09b-v20b : lit `outils/chantier5/reference.json` (produit par `planche-plan-scenes.mts`). Aucun rendu en CI, aucun pixel comparé.
 * La colonne « sans plan » doit avoir le même balisage que le filet C5-5.09a : mêmes 6 instants, même nombre d'images rendues
 * (comparés à l'instantané du filet, en lecture seule).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface Reference {
  tempsTexteSec: number[];
  imagesTexte: Record<string, number>;
  images: { colonne: string; tSec: number; md5: string }[];
}
const reference = JSON.parse(readFileSync("outils/chantier5/reference.json", "utf8")) as Reference;
const instantane = readFileSync("tests/chantier5/__snapshots__/filet-texte-compose.test.ts.snap", "utf8");

describe("référence de la planche (C5-5.09b-v20b)", () => {
  it("forme : 12 entrées, md5 hexadécimal, 6 instants par colonne", () => {
    expect(reference.images).toHaveLength(12);
    expect(reference.tempsTexteSec).toHaveLength(6);
    for (const colonne of ["sans-plan", "avec-plan"]) {
      const lignes = reference.images.filter((i) => i.colonne === colonne);
      expect(lignes.map((i) => i.tSec)).toEqual(reference.tempsTexteSec);
      for (const l of lignes) expect(l.md5).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(Object.keys(reference.imagesTexte).sort()).toEqual(["avec-plan", "sans-plan"]);
  });

  it("l'ajout du plan change le rendu d'au moins un instant", () => {
    const sans = reference.images.filter((i) => i.colonne === "sans-plan").map((i) => i.md5);
    const avec = reference.images.filter((i) => i.colonne === "avec-plan").map((i) => i.md5);
    expect(avec.some((m, k) => m !== sans[k])).toBe(true);
  });

  it("colonne « sans plan » : mêmes instants et même nombre d'images que le filet C5-5.09a", () => {
    const balisages = [...instantane.matchAll(/"t": ([0-9.]+),/g)].map((m) => Number(m[1]));
    expect(balisages).toEqual(reference.tempsTexteSec);
    const durees = instantane.match(/"durees": \[([^\]]*)\]/)![1].match(/\d+/g)!.map(Number);
    expect(reference.imagesTexte["sans-plan"]).toBe(durees.length);
  });
});
