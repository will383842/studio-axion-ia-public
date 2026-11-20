/**
 * T-OUTIL-TROIS-STYLES-v20f : tests directs de la géométrie de l'outil du tableau (`trois-styles/outil.ts`) dans les trois
 * styles, à deux échelles (k = 1 et k = 0,5) : dimensions, air sous la pointe, angle, point de repos.
 */
import { describe, expect, it } from "vitest";
import { airOutil, angleOutil, dimensionsOutil, reposOutil } from "../../src/briques/tableau-scene/trois-styles/outil";
import { STYLES_TABLEAU, type StyleTableau } from "../../src/briques/tableau-scene/trois-styles/styles";

const DIMS: Record<StyleTableau, { L: number; D: number }> = {
  "tableau-blanc": { L: 320, D: 42 },
  ardoise: { L: 160, D: 30 },
  paperboard: { L: 330, D: 50 },
};
const AIR_K1: Record<StyleTableau, number> = { "tableau-blanc": 58, ardoise: 52, paperboard: 62 };
const AIR_K05: Record<StyleTableau, number> = { "tableau-blanc": 29.5, ardoise: 26.5, paperboard: 31.5 };
const ECHELLES = [1, 0.5] as const;

describe("dimensionsOutil", () => {
  for (const style of STYLES_TABLEAU) {
    for (const k of ECHELLES) {
      it(`${style}, k=${k} : longueur et diamètre proportionnels à k`, () => {
        const d = dimensionsOutil(style, k);
        expect(d.L).toBeCloseTo(DIMS[style].L * k, 9);
        expect(d.D).toBeCloseTo(DIMS[style].D * k, 9);
      });
    }
  }
  it("l'ardoise a la craie la plus courte, le paperboard le marqueur le plus gros", () => {
    expect(dimensionsOutil("ardoise", 1).L).toBeLessThan(dimensionsOutil("tableau-blanc", 1).L);
    expect(dimensionsOutil("paperboard", 1).D).toBeGreaterThan(dimensionsOutil("tableau-blanc", 1).D);
  });
});

describe("airOutil", () => {
  for (const style of STYLES_TABLEAU) {
    it(`${style} : D/2 + 36·k + 1 aux deux échelles`, () => {
      expect(airOutil(style, 1)).toBeCloseTo(AIR_K1[style], 9);
      expect(airOutil(style, 0.5)).toBeCloseTo(AIR_K05[style], 9);
    });
    it(`${style} : l'air est plus grand que le demi-diamètre`, () => {
      expect(airOutil(style, 1)).toBeGreaterThan(dimensionsOutil(style, 1).D / 2);
    });
  }
});

describe("angleOutil", () => {
  const BAS = 1000;
  it("k=1 : 0,42 tant que la pointe est au-dessus de basContenu − 560", () => {
    expect(angleOutil(440, BAS, 1)).toBeCloseTo(0.42, 9);
    expect(angleOutil(0, BAS, 1)).toBeCloseTo(0.42, 9);
  });
  it("k=1 : milieu de la descente (y = 605) → 0,42 − 0,49 = −0,07", () => {
    expect(angleOutil(605, BAS, 1)).toBeCloseTo(-0.07, 9);
  });
  it("k=1 : borné à −0,56 quand y approche et dépasse basContenu", () => {
    expect(angleOutil(770, BAS, 1)).toBeCloseTo(-0.56, 9);
    expect(angleOutil(BAS, BAS, 1)).toBeCloseTo(-0.56, 9);
    expect(angleOutil(5000, BAS, 1)).toBeCloseTo(-0.56, 9);
  });
  it("k=0,5 : seuils à l'échelle (720 → 0,42 ; 802,5 → −0,07 ; 885 → −0,56)", () => {
    expect(angleOutil(720, BAS, 0.5)).toBeCloseTo(0.42, 9);
    expect(angleOutil(802.5, BAS, 0.5)).toBeCloseTo(-0.07, 9);
    expect(angleOutil(885, BAS, 0.5)).toBeCloseTo(-0.56, 9);
  });
  it("décroissant en y, toujours entre −0,56 et 0,42", () => {
    let prec = Infinity;
    for (let y = 0; y <= 1200; y += 50) {
      const a = angleOutil(y, BAS, 1);
      expect(a).toBeLessThanOrEqual(prec);
      expect(a).toBeGreaterThanOrEqual(-0.56 - 1e-9);
      expect(a).toBeLessThanOrEqual(0.42 + 1e-9);
      prec = a;
    }
  });
});

describe("reposOutil", () => {
  const geo = { contenu: { x: 100, y: 200, largeur: 800, hauteur: 1000 } };
  it("k=1 : à droite et en bas du contenu → [860, 1050]", () => {
    expect(reposOutil(geo, 1)).toEqual([860, 1050]);
  });
  it("k=0,5 : décalages divisés par deux → [880, 1125]", () => {
    expect(reposOutil(geo, 0.5)).toEqual([880, 1125]);
  });
  for (const k of ECHELLES) {
    it(`k=${k} : le repos est dans la zone du contenu`, () => {
      const [x, y] = reposOutil(geo, k);
      expect(x).toBeGreaterThan(geo.contenu.x);
      expect(x).toBeLessThan(geo.contenu.x + geo.contenu.largeur);
      expect(y).toBeGreaterThan(geo.contenu.y);
      expect(y).toBeLessThan(geo.contenu.y + geo.contenu.hauteur);
    });
  }
});
