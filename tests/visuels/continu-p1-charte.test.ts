import { describe, expect, it } from "vitest";
import { CHARTE_CARROUSEL, contrasteWcag } from "../../src/briques/visuels/charte-carrousel";

// V7-02 : les jetons « continu » hors palette et les dégradés sont retirés (la charte 2026 n'a ni dégradé ni teinte hors palette).
describe("continu P1 : charte du carrousel continu", () => {
  it("contrastes de lecture", () => {
    const c = CHARTE_CARROUSEL.couleurs;
    expect(contrasteWcag(c.encre, c.creme)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteWcag(c.orangeFonce, c.creme)).toBeGreaterThanOrEqual(4.5);
    expect(contrasteWcag(c.creme, c.encre)).toBeGreaterThanOrEqual(4.5);
  });
});
