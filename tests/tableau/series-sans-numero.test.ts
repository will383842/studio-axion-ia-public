/** TB-17 · Séries sans numéro : `numeroter` facultatif ; absent ou `true` = comportement d'avant, `false` = nom seul. */
import { describe, expect, it } from "vitest";
import { enteteSerie, serieNumerotee } from "@/domaine/series";

const NOM = "L'IA qui fait gagner 1 h";

describe("Séries sans numéro (PUR)", () => {
  it("série sans réglage : libellé d'aujourd'hui", () => {
    expect(enteteSerie(NOM, 3)).toBe("L'IA qui fait gagner 1 h · ép. 3");
    expect(enteteSerie(NOM)).toBe(NOM);
    expect(serieNumerotee({})).toBe(true);
    expect(serieNumerotee(null)).toBe(true);
  });
  it("numeroter: true = comme sans réglage", () => {
    expect(enteteSerie(NOM, 3, true)).toBe(enteteSerie(NOM, 3));
    expect(serieNumerotee({ numeroter: true })).toBe(true);
  });
  it("numeroter: false = le nom seul, sans « ép. », sans numéro, sans « partie »", () => {
    const e = enteteSerie(NOM, 3, false);
    expect(e).toBe(NOM);
    expect(e).not.toMatch(/ép\.|partie|\d$/i);
    expect(enteteSerie(NOM, undefined, false)).toBe(NOM);
    expect(serieNumerotee({ numeroter: false })).toBe(false);
  });
});
