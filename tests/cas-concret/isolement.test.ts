/**
 * M9b : isolement du moteur « Cas concret MD ». Aucun fichier de `src/moteurs/montage-cas-concret/` n'importe un autre
 * moteur, HeyGen, les services ni `studio-rendu/` (lecture des fichiers, imports statiques et dynamiques).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(__dirname, "../../src/moteurs/montage-cas-concret");
const INTERDITS = ["montage-avocat", "montage-facecam", "montage-tableau", "@/fournisseurs/heygen", "@/services/", "studio-rendu/"];

/** Chemins importés d'un fichier : `from "…"`, `import("…")`, `require("…")`. */
function imports(source: string): string[] {
  return [...source.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*|^\s*import\s+)["']([^"']+)["']/gm)].map((m) => m[1]);
}

describe("M9b · isolement du moteur", () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => /\.tsx?$/.test(f));

  it("le dossier du moteur a ses fichiers", () => {
    expect(fichiers).toEqual(expect.arrayContaining(["index.ts", "fabriquer.ts", "etapes.ts"]));
  });

  for (const f of fichiers) {
    it(`${f} n'importe aucun autre moteur, ni HeyGen, ni les services, ni le rendu`, () => {
      const chemins = imports(readFileSync(join(DOSSIER, f), "utf8"));
      expect(chemins.length).toBeGreaterThan(0);
      expect(chemins.filter((c) => INTERDITS.some((i) => c.includes(i)))).toEqual([]);
    });
  }
});
