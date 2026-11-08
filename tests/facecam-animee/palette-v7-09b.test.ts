/**
 * V7-09b : motion-v2/lot1, motion-v4/lot1 et briques-v4 n'emploient que la palette Axion 2026.
 * Ivoire #FAF9F5, gris #E8E6DC, noir #141413, terracotta #B23F16, orange #D97757 et gris #B0AEA5 (sur noir). AUCUN rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BASE = join(process.cwd(), "studio-rendu/compositions/interface-claire");
const PALETTE = new Set(["#faf9f5", "#e8e6dc", "#141413", "#b23f16", "#d97757", "#b0aea5", "#b8341c"]);
const FICHIERS = ["motion-v2/lot1/commun-lot1.tsx", "motion-v4/lot1/commun-lot1.tsx", "motion-v4/communs/briques-v4.tsx"];

describe("V7-09b : couleurs en dur", () => {
  it.each(FICHIERS)("%s : aucun hex hors palette", (f) => {
    const src = readFileSync(join(BASE, f), "utf8");
    const hex = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase());
    expect(hex.filter((h) => !PALETTE.has(h))).toEqual([]);
  });
});
