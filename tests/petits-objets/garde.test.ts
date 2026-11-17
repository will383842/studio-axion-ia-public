/** C9-01 — garde statique du dossier `src/briques/motion/petits-objets/` (lu par le rendu : aucun import `@/`). Lecture du texte seulement. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOSSIER = join(__dirname, "..", "..", "src", "briques", "motion", "petits-objets");

const INTERDITS: readonly [string, RegExp][] = [
  ["alias @/", /@\//],
  ["zod", /\bzod\b/],
  ["Math.random", /Math\.random/],
  ["remotion", /remotion/],
  ["moteurs/", /from\s+["'][^"']*moteurs\//],
  ["motion-v4 / -v4", /from\s+["'][^"']*-v4/],
  ["VideoAnimeeV4", /VideoAnimeeV4/],
  ["briques-v4", /briques-v4/],
  ["faits-script", /faits-script/],
  ["droits", /from\s+["'][^"']*\/droits/],
  ["bibliotheque-video", /bibliotheque-video/],
  ["src/domaine", /src\/domaine|from\s+["'][^"']*\/domaine\//],
  ["services", /from\s+["'][^"']*\/services\//],
];

export function violations(texte: string): string[] {
  return INTERDITS.filter(([, re]) => re.test(texte)).map(([nom]) => nom);
}

describe("C9-01 garde du dossier petits-objets", () => {
  const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".ts"));
  it("le dossier contient les 8 fichiers (socle + progres.ts de C9-02 + icones-objets.ts de C9-28)", () => {
    expect(fichiers.sort()).toEqual(["contrat.ts", "graine.ts", "icones-objets.ts", "index.ts", "progres.ts", "tons.ts", "tremblement.ts", "zones.ts"]);
  });
  for (const f of fichiers) {
    it(`${f} : aucun import ni appel interdit`, () => {
      expect(violations(readFileSync(join(DOSSIER, f), "utf8"))).toEqual([]);
    });
  }
  it("la garde mord : un faux texte qui importe ../../droits est détecté", () => {
    expect(violations('import { x } from "../../droits";')).toContain("droits");
    expect(violations('import { y } from "@/services/a"; const a = Math.random();')).toEqual(expect.arrayContaining(["alias @/", "Math.random"]));
  });
});
