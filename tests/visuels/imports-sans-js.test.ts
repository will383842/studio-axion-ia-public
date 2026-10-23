import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Turbopack/Next ne résout pas « ./x.js » vers x.ts : les imports relatifs du code carrousels
// pris par l'application doivent être sans extension.
const RACINES = [
  "src/domaine/controles-visuel",
  "src/visuels",
  "src/briques/visuels",
  "src/domaine/visuels",
  "src/components/visuels",
  "src/app/(studio)/carrousels",
];
const IMPORT_JS = /(?:from\s*|import\s*\(\s*|import\s+)["']\.{1,2}\/[^"']*\.jsx?["']/g;

function fichiers(dossier: string): string[] {
  let entrees: string[];
  try {
    entrees = readdirSync(dossier);
  } catch {
    return [];
  }
  return entrees.flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}

describe("imports relatifs sans extension .js", () => {
  it("aucun import relatif ne se termine par .js ou .jsx", () => {
    const fautes = RACINES.flatMap(fichiers).flatMap((f) => {
      const trouves = readFileSync(f, "utf8").match(IMPORT_JS) ?? [];
      return trouves.map((t) => `${f} : ${t}`);
    });
    expect(fautes).toEqual([]);
  });
});
