import { describe, expect, it } from "vitest";
import { BANDE_COUTURE, COIN_RESERVE, HAUTEURS, LARGEUR_PAGE, MARGE_SURE, PAGES_DEFAUT_MAX, PAGES_MAX, PAGES_MIN, coutures, largeurToile, rectPage } from "../../src/domaine/visuels/continu/geometrie";

describe("continu P1 : géométrie de la toile", () => {
  it("largeur, coutures et hauteurs", () => {
    expect(LARGEUR_PAGE).toBe(1080);
    expect(largeurToile(4)).toBe(4320);
    expect(coutures(4)).toEqual([1080, 2160, 3240]);
    expect(HAUTEURS["4:5"]).toBe(1350);
    expect(HAUTEURS["3:4"]).toBe(1440);
  });
  it("constantes de sécurité et bornes", () => {
    expect([MARGE_SURE, COIN_RESERVE, BANDE_COUTURE]).toEqual([80, 200, 80]);
    expect([PAGES_MIN, PAGES_MAX, PAGES_DEFAUT_MAX]).toEqual([3, 10, 6]);
  });
  it("rectPage place la page i dans la toile", () => {
    expect(rectPage(2, "3:4")).toEqual({ x: 2160, y: 0, largeur: 1080, hauteur: 1440 });
    expect(rectPage(0, "4:5")).toEqual({ x: 0, y: 0, largeur: 1080, hauteur: 1350 });
  });
});
