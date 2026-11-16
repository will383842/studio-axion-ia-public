/** C10-07 : contour sombre sous un sous-titre posé sur fond clair. Règle pure, non branchée. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRASTE_MIN, SEUIL_FOND_CLAIR, contourPourFond } from "../../../src/briques/sous-titres/fond-clair";
import { PALETTE } from "../../../src/briques/charte/axion-2026";
import { rapportContraste } from "../../../src/briques/habillage/contraste";

describe("contourPourFond", () => {
  it("fond ivoire : contour noir", () => {
    const r = contourPourFond(PALETTE.ivoire, PALETTE.noir);
    expect(r.contour).toBe(PALETTE.noir);
    expect(r.reserve).toBe("aucune");
  });
  it("fond noir : aucun contour", () => {
    const r = contourPourFond(PALETTE.noir, PALETTE.ivoire);
    expect(r.contour).toBeNull();
    expect(r.reserve).toBe("aucune");
  });
  it("couleur claire hors charte : contour noir et contraste exact", () => {
    const r = contourPourFond("#CCDDEE", PALETTE.noir);
    expect(r.contour).toBe(PALETTE.noir);
    expect(r.contraste).toBe(rapportContraste(PALETTE.noir, "#CCDDEE"));
  });
  it("texte ivoire sur fond ivoire : réserve", () => {
    const r = contourPourFond(PALETTE.ivoire, PALETTE.ivoire);
    expect(r.contour).toBe(PALETTE.noir);
    expect(r.contraste).toBeCloseTo(1, 5);
    expect(r.reserve).toBe("contraste-faible");
  });
  it("constantes écrites", () => {
    expect(CONTRASTE_MIN).toBe(4.5);
    expect(SEUIL_FOND_CLAIR).toBeGreaterThan(0);
    expect(SEUIL_FOND_CLAIR).toBeLessThan(1);
  });
  it("entrée illisible : jamais d'exception", () => {
    expect(contourPourFond("rouge", PALETTE.noir)).toEqual({ contour: null, contraste: 0, reserve: "contraste-faible" });
    expect(contourPourFond(PALETTE.ivoire, "")).toEqual({ contour: null, contraste: 0, reserve: "contraste-faible" });
  });
});

describe("garde statique", () => {
  const src = readFileSync("src/briques/sous-titres/fond-clair.ts", "utf8");
  it("aucun import @/, zod ni v4", () => {
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
    for (const l of imports) {
      expect(l).not.toMatch(/@\//);
      expect(l).not.toMatch(/zod/);
      expect(l).not.toMatch(/v4/i);
    }
  });
  it("aucun fichier existant ne l'importe", () => {
    const vus: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules" || n === ".next" || n.startsWith(".git")) continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n) && !p.endsWith("fond-clair.ts") && !p.endsWith("fond-clair.test.ts")) {
          if (/from\s+["'][^"']*fond-clair["']|import\(["'][^"']*fond-clair["']\)/.test(readFileSync(p, "utf8"))) vus.push(p);
        }
      }
    };
    parcourir("src");
    expect(vus).toEqual([]);
  });
});
