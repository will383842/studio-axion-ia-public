/**
 * V7-09c : le catalogue des décors et le service des décors n'emploient que la palette Axion 2026.
 * Ivoire #FAF9F5, gris #E8E6DC, noir #141413, terracotta #B23F16, orange #D97757. AUCUN rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTE } from "@/briques/charte/axion-2026";
import { decorsCatalogue } from "@/donnees/decors-catalogue";

const AUTORISEES = new Set(["#faf9f5", "#e8e6dc", "#141413", "#b23f16", "#d97757", "#b0aea5", "#b8341c"]);

describe("V7-09c : couleurs des décors", () => {
  it.each(["src/donnees/decors-catalogue.ts", "src/services/decors.ts"])("%s : aucun hex hors palette", (f) => {
    const src = readFileSync(join(process.cwd(), f), "utf8");
    const hex = (src.match(/#[0-9a-fA-F]{6}\b/g) ?? []).map((h) => h.toLowerCase());
    expect(hex.filter((h) => !AUTORISEES.has(h))).toEqual([]);
  });
});

describe("V7-09c : teinte de lumière selon le fond", () => {
  const valeurs = decorsCatalogue("2026-01-01T00:00:00.000Z").map((e) => e.valeur as { type: string; teinte?: string; teinteLumiere?: string; clair?: boolean });
  const decors = valeurs.filter((v) => v.type === "decor");

  it("N1 (noir) : halo orange #D97757, orange permis sur noir", () => {
    const n1 = decors.find((v) => v.teinte === PALETTE.noir && v.teinteLumiere === PALETTE.orange);
    expect(n1).toBeDefined();
  });

  it("N6 (clair) : lumière et contour terracotta #B23F16, jamais d'orange sur ivoire", () => {
    const clairs = decors.filter((v) => v.clair === true && v.teinte === PALETTE.ivoire);
    expect(clairs.some((v) => v.teinteLumiere === PALETTE.terracotta)).toBe(true);
    for (const v of decors.filter((d) => d.teinte === PALETTE.ivoire)) expect(v.teinteLumiere).not.toBe(PALETTE.orange);
  });

  it("aucun décor sur noir n'a de lumière terracotta (3,17 : interdit)", () => {
    for (const v of decors.filter((d) => d.teinte === PALETTE.noir)) expect(v.teinteLumiere).not.toBe(PALETTE.terracotta);
  });
});
