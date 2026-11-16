/** C8-A04 : géométrie de la carte d'avis client (pure, sans rendu). */
import { describe, expect, it } from "vitest";
import { CADRES_AVIS, etoilesPleines, geometrieAvis, type RatioAvis } from "../../studio-rendu/compositions/avis-client/geometrie-avis";

const RATIOS: RatioAvis[] = ["9:16", "16:9", "1:1"];

describe("étoiles pleines", () => {
  it("note 3 donne 3 étoiles", () => expect(etoilesPleines(3)).toBe(3));
  it("arrondit la note réelle sans jamais la gonfler", () => {
    expect(etoilesPleines(4.4)).toBe(4);
    expect(etoilesPleines(4.6)).toBe(5);
    expect(etoilesPleines(1)).toBe(1);
    expect(etoilesPleines(5)).toBe(5);
  });
  it("refuse note 0, 6, négative, NaN ou infinie (aucune étoile)", () => {
    for (const n of [0, 6, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.4, 5.6]) expect(etoilesPleines(n)).toBeNull();
  });
});

describe("boîte de la carte", () => {
  it.each(RATIOS)("tient dans le cadre pour %s, marges positives", (ratio) => {
    const cadre = CADRES_AVIS[ratio];
    const g = geometrieAvis(ratio, 3);
    expect(g).not.toBeNull();
    if (!g) return;
    expect(g.boite.x).toBeGreaterThanOrEqual(0);
    expect(g.boite.y).toBeGreaterThanOrEqual(0);
    expect(g.boite.x + g.boite.largeur).toBeLessThanOrEqual(cadre.largeur);
    expect(g.boite.y + g.boite.hauteur).toBeLessThanOrEqual(cadre.hauteur);
    expect(g.marge).toBeGreaterThan(0);
    expect(g.etoilesPleines).toBe(3);
  });
  it("refuse une note invalide", () => {
    expect(geometrieAvis("9:16", 0)).toBeNull();
    expect(geometrieAvis("16:9", 6)).toBeNull();
  });
  it("ne dépend pas d'un tri par note : même note, même boîte", () => {
    expect(geometrieAvis("1:1", 2)?.boite).toEqual(geometrieAvis("1:1", 5)?.boite);
  });
});
