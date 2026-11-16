import { describe, expect, it } from "vitest";
import { AXES_COMMUNS, type AxeCommun, type EmpreinteVideo } from "@/briques/variete-commune/types";
import { NEUTRES, POIDS_COMMUNS, SEUIL_COMMUN, ressemblance } from "@/briques/variete-commune/ressemblance";

function emp(axes: EmpreinteVideo["axes"]): EmpreinteVideo {
  return { version: "empreinte/1", videoId: "v", formatId: "f", le: "2026-11-16T00:00:00.000Z", axes };
}
function tous(f: (axe: AxeCommun) => string[]): EmpreinteVideo["axes"] {
  const o: EmpreinteVideo["axes"] = {};
  for (const a of AXES_COMMUNS) o[a] = f(a);
  return o;
}

describe("ressemblance pondérée (X2-03)", () => {
  it("poids et seuil repris de la ressemblance IV", () => {
    expect(POIDS_COMMUNS.ouverture).toBe(3);
    for (const a of ["palette", "habillage", "sousTitres", "recit"] as const) expect(POIDS_COMMUNS[a]).toBe(2);
    for (const a of ["transitions", "objets", "camera"] as const) expect(POIDS_COMMUNS[a]).toBe(1.5);
    for (const a of ["typo", "fin", "sons", "dosage"] as const) expect(POIDS_COMMUNS[a]).toBe(1);
    expect(SEUIL_COMMUN).toBe(0.5);
    expect(NEUTRES).toEqual([]);
  });
  it("identiques → 1, tous les axes communs", () => {
    const r = ressemblance(emp(tous((a) => [a + "-x"])), emp(tous((a) => [a + "-x"])));
    expect(r.score).toBe(1);
    expect([...r.axesCommuns].sort()).toEqual([...AXES_COMMUNS].sort());
  });
  it("disjointes → 0, aucun axe commun", () => {
    const r = ressemblance(emp(tous(() => ["a"])), emp(tous(() => ["b"])));
    expect(r.score).toBe(0);
    expect(r.axesCommuns).toEqual([]);
  });
  it("symétrique", () => {
    const a = emp(tous((x) => (x === "fin" ? ["1", "2"] : ["p"])));
    const b = emp(tous((x) => (x === "fin" ? ["2", "3"] : x === "camera" ? ["q"] : ["p"])));
    const ab = ressemblance(a, b);
    const ba = ressemblance(b, a);
    expect(ab.score).toBe(ba.score);
    expect(ab.axesCommuns).toEqual(ba.axesCommuns);
  });
  it("Jaccard et pondération", () => {
    const a = emp({ ouverture: ["x"], fin: ["1", "2"], typo: ["t"], dosage: ["d"] });
    const b = emp({ ouverture: ["y"], fin: ["2", "3"], typo: ["t"], dosage: ["d"] });
    // (3*0 + 1*(1/3) + 1 + 1) / 6
    expect(ressemblance(a, b).score).toBeCloseTo((1 / 3 + 2) / 6, 10);
  });
  it("axe absent d'un côté non compté", () => {
    const a = emp({ ouverture: ["x"], fin: ["f"], typo: ["t"], dosage: ["d"], camera: ["c"] });
    const b = emp({ ouverture: ["x"], fin: ["f"], typo: ["t"], dosage: ["d"] });
    const r = ressemblance(a, b);
    expect(r.score).toBe(1);
    expect(r.axesCommuns).not.toContain("camera");
    const c = emp({ ouverture: ["x"], fin: ["f"], typo: ["t"], dosage: ["d"], camera: ["c"] });
    const d = emp({ ouverture: ["x"], fin: ["f"], typo: ["t"], dosage: ["d"], camera: ["z"] });
    expect(ressemblance(c, d).score).toBeCloseTo(6 / 7.5, 10);
  });
  it("moins de 4 axes comptés → null", () => {
    const a = emp({ ouverture: ["x"], fin: ["f"], typo: ["t"] });
    expect(ressemblance(a, a).score).toBeNull();
    expect(ressemblance(a, a).axesCommuns).toEqual(expect.any(Array));
    expect(ressemblance(emp({}), emp({})).score).toBeNull();
  });
  it("4 axes comptés → nombre", () => {
    const a = emp({ ouverture: ["x"], fin: ["f"], typo: ["t"], dosage: ["d"] });
    expect(ressemblance(a, a).score).toBe(1);
  });
  it("neutres partagés non comptés (liste injectée)", () => {
    const a = emp({ ouverture: ["x"], fin: ["N"], typo: ["t"], dosage: ["d"], camera: ["c"] });
    const r = ressemblance(a, a, ["N"]);
    expect(r.axesCommuns).not.toContain("fin");
    expect(r.score).toBe(1);
    const b = emp({ ouverture: ["x"], fin: ["N"], typo: ["t"] });
    expect(ressemblance(b, b, ["N"]).score).toBeNull(); // 2 axes seulement
  });
  it("ordre des valeurs sans effet", () => {
    const a = emp(tous(() => ["1", "2", "3"]));
    const b = emp(tous(() => ["3", "1", "9"]));
    const b2 = emp(tous(() => ["9", "3", "1"]));
    expect(ressemblance(a, b)).toEqual(ressemblance(a, b2));
  });
  it("entrées gelées non modifiées", () => {
    const g = (e: EmpreinteVideo) => {
      for (const v of Object.values(e.axes)) Object.freeze(v);
      Object.freeze(e.axes);
      return Object.freeze(e);
    };
    const a = g(emp(tous(() => ["1", "2"])));
    const b = g(emp(tous(() => ["2", "3"])));
    const avant = JSON.stringify([a, b]);
    expect(() => ressemblance(a, b, Object.freeze(["x"]))).not.toThrow();
    expect(JSON.stringify([a, b])).toBe(avant);
  });
});
