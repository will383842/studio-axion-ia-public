/**
 * FB-REEL-a : règle pure du Reel Facebook (9:16, durée dans REEL_FACEBOOK_DUREE_SEC). Aucun réseau, aucune clé.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { estReelFacebook, avertissementReelFacebook } from "@/domaine/reel-facebook";
import { REEL_FACEBOOK_DUREE_SEC } from "@/fournisseurs/publication/zernio-corps";

describe("estReelFacebook : limites de durée", () => {
  it.each([
    [2.9, false],
    [3, true],
    [60, true],
    [60.1, false],
  ])("9:16 de %s s : %s", (dureeSec, attendu) => {
    expect(estReelFacebook({ format: "9:16", dureeSec })).toBe(attendu);
  });
  it("durée absente : pas un Reel", () => {
    expect(estReelFacebook({ format: "9:16" })).toBe(false);
  });
});

describe("estReelFacebook : formats", () => {
  it.each([["4:5"], ["1:1"], ["16:9"]])("%s n'est pas un Reel", (format) => {
    expect(estReelFacebook({ format, dureeSec: 30 })).toBe(false);
  });
});

describe("avertissementReelFacebook", () => {
  it("aucun avertissement quand la vidéo part en Reel", () => {
    expect(avertissementReelFacebook({ format: "9:16", dureeSec: 3 })).toBeNull();
    expect(avertissementReelFacebook({ format: "9:16", dureeSec: 60 })).toBeNull();
  });
  it("format autre que 9:16 : avertissement en vouvoyant", () => {
    for (const format of ["4:5", "1:1"]) {
      const m = avertissementReelFacebook({ format, dureeSec: 30 });
      expect(m).toMatch(/9:16/);
      expect(m).toMatch(/vous|votre|vos/i);
    }
  });
  it("trop courte ou trop longue : avertissement avec les bornes importées", () => {
    const court = avertissementReelFacebook({ format: "9:16", dureeSec: 2.9 });
    const long = avertissementReelFacebook({ format: "9:16", dureeSec: 60.1 });
    expect(court).toContain(String(REEL_FACEBOOK_DUREE_SEC.min));
    expect(long).toContain(String(REEL_FACEBOOK_DUREE_SEC.max));
    expect(court).toMatch(/vous|votre|vos/i);
  });
  it("durée absente : avertissement", () => {
    expect(avertissementReelFacebook({ format: "9:16" })).not.toBeNull();
  });
});

describe("bornes importées, jamais recopiées", () => {
  it("le source n'a aucun littéral 3 ou 60 et importe la constante", () => {
    const src = readFileSync("src/domaine/reel-facebook.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/"[^"]*"|`[^`]*`|'[^']*'/g, '""');
    expect(src).toMatch(/REEL_FACEBOOK_DUREE_SEC/);
    expect(src).not.toMatch(/(?<![\w.])(3|60)(?![\w.])/);
  });
});
