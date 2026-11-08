import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-06 : support.ts (textures canvas des trois styles du tableau) ne contient que les hex de la palette de marque.
const PALETTE = new Set(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"]);
const FICHIER = "studio-rendu/compositions/tableau/trois-styles/support.ts";

function hexTrouves(texte: string): string[] {
  const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return (sansCommentaires.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).map((h) => h.toUpperCase());
}

describe("V7-06 support.ts : palette de marque", () => {
  it("n'utilise que les six hex de la palette", () => {
    const hors = [...new Set(hexTrouves(readFileSync(FICHIER, "utf8")).filter((h) => !PALETTE.has(h)))];
    expect(hors).toEqual([]);
  });
});
