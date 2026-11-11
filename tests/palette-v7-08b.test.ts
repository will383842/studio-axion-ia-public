import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-08b (lot L6) : dans ces fichiers, seules les couleurs de la charte Axion 2026 sont permises, plus les
// matières réalistes (métal du micro) déclarées en constantes nommées MATIERE_* en tête de fichier, sans teinte
// bleue ni jaune. Les silhouettes (peau, cheveux) gardent leurs teintes réalistes : décision D1, hors de ce test.
const PALETTE = new Set(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"]);
const BASE = "studio-rendu/compositions/commune/";
const FICHIERS = ["MicroPodcast.tsx", "effets/objets.ts"].map((f) => BASE + f);
const DECLARATION_MATIERE = /^const (MATIERE_[A-Z0-9_]+) = "(#[0-9A-Fa-f]{6})";$/gm;

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}
function hexHorsMatieres(src: string): string[] {
  return sansCommentaires(src).replace(DECLARATION_MATIERE, "").match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
}
function matieres(src: string): string[] {
  return [...sansCommentaires(src).matchAll(DECLARATION_MATIERE)].map((m) => m[2]);
}
function rgbaHorsPalette(src: string): string[] {
  const permis = new Set(["20,20,19", "250,249,245", "232,230,220", "178,63,22", "217,119,87", "176,174,165"]);
  return [...sansCommentaires(src).matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)].map((m) => `${m[1]},${m[2]},${m[3]}`).filter((c) => !permis.has(c));
}

describe("palette V7-08b", () => {
  for (const f of FICHIERS) {
    const src = readFileSync(f, "utf8");
    it(`${f} n'utilise que la palette et des matières déclarées`, () => {
      const hors = [...new Set(hexHorsMatieres(src).filter((h) => !PALETTE.has(h.toUpperCase())))];
      expect(hors).toEqual([]);
      expect(rgbaHorsPalette(src)).toEqual([]);
    });
    it(`${f} : les matières déclarées n'ont ni teinte bleue ni teinte jaune`, () => {
      for (const h of matieres(src)) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        expect(b - r, h).toBeLessThanOrEqual(0);
        expect(Math.min(r, g) - b, h).toBeLessThanOrEqual(2);
      }
    });
  }
  it("MicroPodcast : sa lumière par défaut est l'orange de la charte", () => {
    expect(readFileSync(BASE + "MicroPodcast.tsx", "utf8")).toContain('const COULEUR_LUMIERE = "#D97757";');
  });
});
