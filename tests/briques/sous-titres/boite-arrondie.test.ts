import { describe, expect, it } from "vitest";
import { cheminBoiteArrondie } from "../../../src/briques/sous-titres/boite-arrondie";

const ligne = (x: number, y: number, largeur: number, hauteur = 100) => ({ x, y, largeur, hauteur });
const nombres = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe("cheminBoiteArrondie", () => {
  it("renvoie un chemin fermé", () => {
    const d = cheminBoiteArrondie([ligne(0, 0, 300)], { rayon: 20, marge: 10 });
    expect(d.startsWith("M")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
    expect((d.match(/Z/g) ?? []).length).toBe(1);
  });

  it("1 ligne : rectangle arrondi (4 arcs, rayon demandé)", () => {
    const d = cheminBoiteArrondie([ligne(100, 50, 300, 100)], { rayon: 20, marge: 10 });
    expect((d.match(/A/g) ?? []).length).toBe(4);
    expect(d).toContain("A20 20 0 0 1");
    // boîte : x 90..410, y 40..160
    const n = nombres(d);
    for (const v of [90, 410, 40, 160]) expect(n).toContain(v);
  });

  it("rayon limité à la demi-hauteur de ligne", () => {
    const d = cheminBoiteArrondie([ligne(0, 0, 300, 40)], { rayon: 500, marge: 0 });
    const rayons = [...d.matchAll(/A(\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));
    expect(rayons.length).toBeGreaterThan(0);
    for (const r of rayons) expect(r).toBeLessThanOrEqual(20);
  });

  it("rayon limité à la moitié de l'écart entre deux largeurs voisines", () => {
    // 300 / 340 : écart de bord 20 de chaque côté -> rayon <= 10 aux jonctions
    const d = cheminBoiteArrondie([ligne(20, 0, 300), ligne(0, 100, 340)], { rayon: 40, marge: 0 });
    const rayons = [...d.matchAll(/A(\d+(?:\.\d+)?) /g)].map((m) => Number(m[1]));
    expect(Math.min(...rayons)).toBeLessThanOrEqual(10);
  });

  it("3 lignes 300/500/200 centrées : le contour suit les 3 largeurs", () => {
    const d = cheminBoiteArrondie(
      [ligne(100, 0, 300), ligne(0, 100, 500), ligne(150, 200, 200)],
      { rayon: 10, marge: 0 },
    );
    const n = nombres(d);
    for (const x of [100, 400, 0, 500, 150, 350]) expect(n).toContain(x);
    expect((d.match(/A/g) ?? []).length).toBe(12);
    expect(d.trim().endsWith("Z")).toBe(true);
  });

  it("déterministe : même entrée, même chemin", () => {
    const e = [ligne(100, 0, 300), ligne(0, 100, 500)];
    expect(cheminBoiteArrondie(e, { rayon: 12.345, marge: 7 })).toBe(
      cheminBoiteArrondie(e, { rayon: 12.345, marge: 7 }),
    );
  });

  it("arrondis sur 2 décimales", () => {
    const d = cheminBoiteArrondie([ligne(0.123456, 0, 300.98765)], { rayon: 7.777777, marge: 1.11111 });
    for (const m of d.match(/\d+\.\d+/g) ?? []) expect(m.split(".")[1].length).toBeLessThanOrEqual(2);
  });

  it("entrée vide ou invalide : chaîne vide, sans exception", () => {
    const o = { rayon: 10, marge: 5 };
    expect(cheminBoiteArrondie([], o)).toBe("");
    expect(cheminBoiteArrondie([ligne(0, 0, 0)], o)).toBe("");
    expect(cheminBoiteArrondie([ligne(0, 0, -5)], o)).toBe("");
    expect(cheminBoiteArrondie([ligne(0, 0, NaN)], o)).toBe("");
    expect(cheminBoiteArrondie([ligne(0, 0, 100, 0)], o)).toBe("");
    expect(cheminBoiteArrondie([ligne(NaN, 0, 100)], o)).toBe("");
    expect(cheminBoiteArrondie([ligne(0, 0, 100)], { rayon: NaN, marge: 5 })).toBe("");
  });
});
