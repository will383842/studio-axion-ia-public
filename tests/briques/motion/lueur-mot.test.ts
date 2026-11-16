import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PALETTE } from "../../../src/briques/charte/axion-2026";
import { HALO_RAYON_MAX_PX, LUEUR_RAYON_MAX_PX } from "../../../src/briques/motion/habillage-commun/lumiere";
import { LUEUR_MOT_ACTIF, haloCarte, lueurMotCle } from "../../../src/briques/motion/habillage-commun/lueur-mot";
import { GABARITS, cssLigne } from "../../../src/briques/sous-titres/style";
import type { CouleursSousTitres } from "../../../src/briques/sous-titres/style";

const C: CouleursSousTitres = { texte: PALETTE.ivoire, accent: PALETTE.orange, contour: PALETTE.noir };
const SRC = "src/briques/motion/habillage-commun/lueur-mot.ts";

const rayons = (s: string) => [...s.matchAll(/0 0 (\d+)px/g)].map((m) => Number(m[1]));

describe("lueur du mot-clé et halo de carte (C10-06)", () => {
  it("éteint par défaut", () => {
    expect(LUEUR_MOT_ACTIF).toBe(false);
  });

  it("lueurMotCle", () => {
    expect(lueurMotCle("orange", 0)).toBe("none");
    const s = lueurMotCle("terracotta", 1);
    expect(s.split("), ").length).toBeLessThanOrEqual(3);
    for (const r of rayons(s)) expect(r).toBeLessThanOrEqual(LUEUR_RAYON_MAX_PX);
    expect(s.toLowerCase()).toContain("rgba(178, 63, 22");
    expect(lueurMotCle("ivoire", 0.5)).toContain("rgba(250, 249, 245");
    expect(lueurMotCle("orange", 0.5)).toContain("rgba(217, 119, 87");
  });

  it("haloCarte", () => {
    const h = haloCarte({ largeur: 2000, hauteur: 2000 }, "orange", 1);
    for (const r of rayons(h.boxShadow)) expect(r).toBeLessThanOrEqual(HALO_RAYON_MAX_PX);
    expect(haloCarte({ largeur: 300, hauteur: 200 }, "ivoire", 0)).toEqual({ boxShadow: "none" });
  });

  it("cssLigne : sans option ou lueur absente/none, identique clé pour clé", () => {
    for (const g of Object.values(GABARITS)) {
      const base = cssLigne(g, 70, C, "Manrope");
      expect(cssLigne(g, 70, C, "Manrope", {})).toEqual(base);
      expect(cssLigne(g, 70, C, "Manrope", { lueur: "none" })).toEqual(base);
      expect(Object.keys(cssLigne(g, 70, C, "Manrope", { lueur: "none" }))).toEqual(Object.keys(base));
    }
  });

  it("cssLigne : la lueur s'ajoute après l'ombre d'origine", () => {
    const lueur = lueurMotCle("orange", 0.5);
    for (const g of Object.values(GABARITS)) {
      const base = cssLigne(g, 70, C, "Manrope");
      const avec = cssLigne(g, 70, C, "Manrope", { lueur });
      expect(avec.textShadow).toBe(base.textShadow ? `${base.textShadow}, ${lueur}` : lueur);
    }
  });

  it("garde statique", () => {
    const src = readFileSync(SRC, "utf8");
    expect(src).not.toContain("@/");
    expect(src).not.toMatch(/\bfilter\s*:/);
    expect(src).not.toContain("blur(");
    expect(src).not.toContain("Math.random");
    expect(readFileSync("src/briques/sous-titres/style.ts", "utf8")).not.toContain("lueur-mot");
    const parcours = (d: string): string[] =>
      readdirSync(d).flatMap((f) => {
        const p = join(d, f);
        if (statSync(p).isDirectory()) return parcours(p);
        return /\.(ts|tsx)$/.test(f) ? [p] : [];
      });
    const importeurs = parcours("src").filter((p) => !p.endsWith("lueur-mot.ts") && /from\s+["'][^"']*lueur-mot["']/.test(readFileSync(p, "utf8")));
    expect(importeurs).toEqual([]);
  });
});
