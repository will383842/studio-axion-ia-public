/** C11-E1 : géométrie de la carte vidéo arrondie (pure, sans React). */
import { describe, expect, it } from "vitest";
import { DUREE_ENTREE_CARTE, entreeCarte, geometrieCarteVideo, type RatioVideoCarte } from "../../../src/briques/motion/ecrans-couverture/carte-video";

type R = { x: number; y: number; w: number; h: number };
const L = 1080, H = 1920;
const dedans = (r: R) => r.x >= 0 && r.y >= 0 && r.x + r.w <= L && r.y + r.h <= H && r.w > 0 && r.h > 0;

describe("geometrieCarteVideo", () => {
  for (const ratio of ["9:16", "4:5", "1:1", "16:9"] as RatioVideoCarte[]) {
    it(`${ratio} : tout tient dans le cadre, carte sous le titre, sous-titres sous la carte`, () => {
      const g = geometrieCarteVideo({ largeur: L, hauteur: H, ratioVideo: ratio, titre: "Un titre fixe" });
      expect(g.titre).not.toBeNull();
      const t = g.titre as R;
      expect(dedans(t) && dedans(g.carte) && dedans(g.zoneSousTitres)).toBe(true);
      expect(g.carte.y).toBeGreaterThanOrEqual(t.y + t.h);
      expect(g.zoneSousTitres.y).toBeGreaterThanOrEqual(g.carte.y + g.carte.h);
      expect(g.titre!.x).toBeGreaterThanOrEqual(L * 0.06 - 1e-6);
      expect(g.titre!.y).toBeGreaterThanOrEqual(H * 0.06 - 1e-6);
      expect(g.carte.rayon).toBeGreaterThan(0);
      expect(g.carte.rayon).toBeCloseTo(g.carte.w * 0.06, 6);
    });
  }
  it("la carte est centrée et respecte le ratio", () => {
    const g = geometrieCarteVideo({ largeur: L, hauteur: H, ratioVideo: "4:5", titre: "T" });
    expect(g.carte.x + g.carte.w / 2).toBeCloseTo(L / 2, 6);
    expect(g.carte.w / g.carte.h).toBeCloseTo(4 / 5, 6);
  });
  it("sans titre : titre null et la carte remonte", () => {
    const a = geometrieCarteVideo({ largeur: L, hauteur: H, ratioVideo: "4:5", titre: "T" });
    const b = geometrieCarteVideo({ largeur: L, hauteur: H, ratioVideo: "4:5" });
    const c = geometrieCarteVideo({ largeur: L, hauteur: H, ratioVideo: "4:5", titre: "  " });
    expect(b.titre).toBeNull();
    expect(c.titre).toBeNull();
    expect(b.carte.y).toBeLessThan(a.carte.y);
    expect(dedans(b.carte) && dedans(b.zoneSousTitres)).toBe(true);
  });
  it("deux appels identiques donnent le même résultat", () => {
    const p = { largeur: L, hauteur: H, ratioVideo: "9:16" as const, titre: "T" };
    expect(geometrieCarteVideo(p)).toEqual(geometrieCarteVideo(p));
  });
});

describe("entreeCarte", () => {
  it("0 avant le début, 1 après la durée, monotone, sans rebond", () => {
    expect(entreeCarte(0.5, 1)).toEqual({ echelle: expect.any(Number), opacite: 0 });
    expect(entreeCarte(0.5, 1).opacite).toBe(0);
    const fin = entreeCarte(1 + DUREE_ENTREE_CARTE + 0.01, 1);
    expect(fin.opacite).toBe(1);
    expect(fin.echelle).toBe(1);
    let prec = entreeCarte(1, 1);
    for (let t = 1; t <= 1 + DUREE_ENTREE_CARTE + 0.1; t += 0.02) {
      const e = entreeCarte(t, 1);
      expect(e.opacite).toBeGreaterThanOrEqual(prec.opacite - 1e-9);
      expect(e.echelle).toBeGreaterThanOrEqual(prec.echelle - 1e-9);
      expect(e.echelle).toBeLessThanOrEqual(1 + 1e-9);
      prec = e;
    }
  });
});
