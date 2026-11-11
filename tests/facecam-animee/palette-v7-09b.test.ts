/**
 * V7-09b : motion-v2/lot1, motion-v4/lot1 et briques-v4 n'emploient que la palette Axion 2026.
 * Ivoire #FAF9F5, gris #E8E6DC, noir #141413, terracotta #B23F16, orange #D97757 et gris #B0AEA5 (sur noir),
 * texte secondaire #5E5D59 et blanc de carte #FFFFFF. #8F3412 reste exclu tant que D5 est ouverte. AUCUN rendu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BASE = join(process.cwd(), "studio-rendu/compositions/interface-claire");
const PALETTE = new Set(["#faf9f5", "#e8e6dc", "#141413", "#b23f16", "#d97757", "#b0aea5", "#b8341c", "#5e5d59", "#ffffff"]);
const FICHIERS = ["motion-v2/lot1/commun-lot1.tsx", "motion-v4/lot1/commun-lot1.tsx", "motion-v4/communs/briques-v4.tsx"];

describe("V7-09b : couleurs en dur", () => {
  it.each(FICHIERS)("%s : aucun hex hors palette", (f) => {
    const src = readFileSync(join(BASE, f), "utf8");
    const hex = (src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase());
    expect(hex.filter((h) => !PALETTE.has(h))).toEqual([]);
  });

  it.each(FICHIERS)("%s : #8F3412 (D5 ouverte) n'est employé nulle part", (f) => {
    const src = readFileSync(join(BASE, f), "utf8");
    expect(src.toLowerCase()).not.toContain("#8f3412");
  });

  it("briques-v4 : blanc #FFFFFF, accent 1 = terracotta (jamais l'orange hors noir)", () => {
    const src = readFileSync(join(BASE, "motion-v4/communs/briques-v4.tsx"), "utf8");
    expect(src).toMatch(/BLANC: "#FFFFFF"/);
    expect(src).toMatch(/ACCENT_1: COULEURS\.ORANGE_MARQUE/);
    expect(src).toMatch(/ORANGE_MARQUE: "#B23F16"/);
  });

  it("briques-v4 : le texte d'une plaque terracotta est blanc (5,81)", () => {
    const src = readFileSync(join(BASE, "motion-v4/communs/briques-v4.tsx"), "utf8");
    expect(src).toMatch(/couleurTexte = fond === COULEURS\.ORANGE_MARQUE \? COULEURS\.BLANC : ENCRE/);
    expect(src).toMatch(/fondPlaque === COULEURS\.ORANGE_MARQUE \? COULEURS\.BLANC : ENCRE/);
  });

  it("motion-v2 : sableProfond et encreDouce = #5E5D59, distincts de l'encre", () => {
    const src = readFileSync(join(BASE, "motion-v2/lot1/commun-lot1.tsx"), "utf8");
    expect(src).toMatch(/sableProfond: "#5E5D59"/);
    expect(src).toMatch(/encreDouce: "#5E5D59"/);
    expect(src).toMatch(/encre: "#141413"/);
  });
});
