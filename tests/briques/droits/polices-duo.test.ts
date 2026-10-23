import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DROITS, droitValide, trouverDroit } from "../../../src/briques/droits";

describe("polices de charte-duo/1", () => {
  it.each(["police-anton", "police-inter"])("%s : entrée valide, SIL OFL 1.1, de type police", (id) => {
    const d = trouverDroit(id);
    expect(d?.type).toBe("police");
    expect(d?.licence).toBe("SIL OFL 1.1");
    expect(d?.auteur.trim()).not.toBe("");
    expect(d?.preuve.trim()).not.toBe("");
    expect(d?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(droitValide(id, "2026-10-12")).toBe(true);
  });

  it("les fichiers cités comme copie de la licence existent", () => {
    const anton = trouverDroit("police-anton")!;
    expect(anton.preuve).toContain("studio-rendu/compositions/commune/polices/OFL-Anton.txt");
    expect(existsSync(new URL("../../../studio-rendu/compositions/commune/polices/OFL-Anton.txt", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../../../studio-rendu/compositions/commune/polices/Anton-Regular.ttf", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../../../studio-rendu/compositions/commune/polices/Inter-Bold.ttf", import.meta.url))).toBe(true);
  });

  it("les identifiants restent uniques", () => {
    const ids = DROITS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("le rendu expose chargerPoliceAnton, sans chargement au niveau du module", () => {
    const src = readFileSync(new URL("../../../studio-rendu/compositions/commune/polices.ts", import.meta.url), "utf8");
    expect(src).toContain('export const FAMILLE_ANTON = "Axion Anton"');
    expect(src).toMatch(/export function chargerPoliceAnton\(\): void/);
    expect(src.match(/new FontFace\(/g)).toHaveLength(5);
  });
});
