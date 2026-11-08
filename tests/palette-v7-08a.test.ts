import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-08a : seules les couleurs de la charte Axion 2026 sont permises dans ces fichiers.
const PALETTE = new Set(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"]);
const FICHIERS = ["studio-rendu/compositions/tableau/trois-styles/PageTableau.tsx"];

function hexHorsCommentaires(src: string): string[] {
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  return sansCommentaires.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
}

describe("palette V7-08a", () => {
  for (const f of FICHIERS) {
    it(`${f} n'utilise que la palette`, () => {
      const hors = [...new Set(hexHorsCommentaires(readFileSync(f, "utf8")).filter((h) => !PALETTE.has(h.toUpperCase())))];
      expect(hors).toEqual([]);
    });
  }
});
