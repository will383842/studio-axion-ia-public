import { describe, expect, it } from "vitest";
import { alpha, CHARTE_CARROUSEL, CHARTE_CONTINU, contrasteWcag, degrade, DEGRADES_CONTINU } from "../../src/briques/visuels/charte-carrousel";

describe("continu P1 : charte du carrousel continu", () => {
  it("contrastes de lecture", () => {
    const c = CHARTE_CONTINU;
    expect(contrasteWcag(c.encre, c.creme)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteWcag(c.grisTexte, c.creme)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteWcag(c.sableSombre, c.encre)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteWcag(c.creme, c.encreDouce)).toBeGreaterThanOrEqual(4.5);
  });
  it("reprend les jetons de la charte existante", () => {
    expect(CHARTE_CONTINU.creme).toBe(CHARTE_CARROUSEL.couleurs.creme);
    expect(CHARTE_CONTINU.orange).toBe(CHARTE_CARROUSEL.couleurs.orange);
  });
  it("alpha et degrade", () => {
    expect(alpha("#000000", 0.1)).toBe("color-mix(in srgb, #000000 10%, transparent)");
    expect(degrade(145, ["#111111", "#222222 60%"])).toBe("linear-gradient(145deg, #111111, #222222 60%)");
    expect(Object.keys(DEGRADES_CONTINU)).toEqual(expect.arrayContaining(["tuile", "carte", "bouton", "barre"]));
  });
});
