/** COUL-ORANGE : GuideTournage et OngletVoix utilisent le jeton --accent, plus l'orange d'accent ni le halo. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "../..");
const ORANGE = /(?<![\w-])(?:[a-z0-9[\]:_-]+:)?(?:bg|text|border|shadow|ring|from|to|via|outline|decoration|fill|stroke)-orange(?:-vif|-doux)?(?:\/\d+)?(?![\w-])|(?<![\w-])lueur(?:-forte)?(?![\w-])/g;

describe("COUL-ORANGE : composants des personnages", () => {
  it("GuideTournage n'a plus d'orange d'accent", () => {
    const src = readFileSync(join(RACINE, "src/components/personnages/GuideTournage.tsx"), "utf-8");
    expect(src.match(ORANGE) ?? []).toEqual([]);
    expect(src).toContain("stroke-accent");
  });
  it("OngletVoix n'a plus de halo ni d'orange vif", () => {
    const src = readFileSync(join(RACINE, "src/components/personnages/OngletVoix.tsx"), "utf-8");
    expect(src).not.toMatch(/bg-orange-vif|(?<![\w-])lueur(?![\w-])/);
  });
});
