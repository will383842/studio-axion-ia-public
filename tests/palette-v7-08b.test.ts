import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-08b : seules les couleurs de la charte Axion 2026 sont permises dans ces fichiers.
const PALETTE = new Set(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"]);
const BASE = "studio-rendu/compositions/commune/";
const FICHIERS = ["effets/PlateauEffets.tsx", "MicroPodcast.tsx", "effets/objets.ts", "Silhouette.tsx"].map((f) => BASE + f);

function hexHorsCommentaires(src: string): string[] {
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return sansCommentaires.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
}

describe("palette V7-08b", () => {
  for (const f of FICHIERS) {
    it(`${f} n'utilise que la palette`, () => {
      const hors = [...new Set(hexHorsCommentaires(readFileSync(f, "utf8")).filter((h) => !PALETTE.has(h.toUpperCase())))];
      expect(hors).toEqual([]);
    });
  }
});
