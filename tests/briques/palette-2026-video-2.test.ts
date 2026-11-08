import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-04 : les chartes vidéo (2) ne portent que la palette 2026. reference/charte.ts est HORS fiche (décision en attente).
const FICHIERS = [
  "studio-rendu/compositions/interface-claire/charte.ts",
  "src/briques/motion/jetons.ts",
  "src/briques/tableau-scene/v2/charte.ts",
  "src/briques/tableau-scene/trois-styles/styles.ts",
];
const PALETTE = ["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"];
const lire = (f: string) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8");

describe("palette 2026 des chartes vidéo (2)", () => {
  it.each(FICHIERS)("%s : aucun hex hors palette", (f) => {
    const src = lire(f).replace(/\(critique #\d+[^)]*\)/g, "");
    for (const h of src.match(/#[0-9a-fA-F]{6}\b/g) ?? []) expect(PALETTE, `${f} ${h}`).toContain(h.toUpperCase());
  });

});
