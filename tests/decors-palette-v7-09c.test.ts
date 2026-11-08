/**
 * V7-09c : le catalogue des décors et le service des décors n'emploient que la palette Axion 2026.
 * Ivoire #FAF9F5, gris #E8E6DC, noir #141413, terracotta #B23F16, orange #D97757. AUCUN rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PALETTE = new Set(["#faf9f5", "#e8e6dc", "#141413", "#b23f16", "#d97757", "#b0aea5", "#b8341c"]);

describe("V7-09c : couleurs des décors", () => {
  it.each(["src/donnees/decors-catalogue.ts", "src/services/decors.ts"])("%s : aucun hex hors palette", (f) => {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    const hex = (src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase());
    expect(hex.filter((h) => !PALETTE.has(h))).toEqual([]);
  });
});
