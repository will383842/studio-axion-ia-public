import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AXES_COMMUNS, type AxeCommun, type EmpreinteVideo, type Voisine } from "@/briques/variete-commune/types";
import { SEUIL_COMMUN } from "@/briques/variete-commune/ressemblance";
import { verifier } from "@/briques/variete-commune/garde";

function emp(axes: EmpreinteVideo["axes"], imposes?: AxeCommun[]): EmpreinteVideo {
  return { version: "empreinte/1", videoId: "v", formatId: "f", le: "2026-11-10T08:00:00.000Z", axes, ...(imposes ? { imposes } : {}) };
}
const tous = (f: (a: AxeCommun) => string[]): EmpreinteVideo["axes"] => Object.fromEntries(AXES_COMMUNS.map((a) => [a, f(a)]));
const voisine = (e: EmpreinteVideo, rang = 0, reseau = "Instagram"): Voisine => ({ empreinte: e, reseau, rang });

describe("garde (X2-04)", () => {
  it("déterministe : 10 appels égaux", () => {
    const c = emp(tous(() => ["a"]));
    const v = [voisine(emp(tous(() => ["a"])))];
    const premier = verifier(c, v);
    for (let i = 0; i < 10; i++) expect(verifier(c, v)).toEqual(premier);
  });
  it("refus si score ≥ seuil, phrase en français simple", () => {
    const r = verifier(emp(tous(() => ["a"])), [voisine(emp(tous(() => ["a"])))]);
    expect(r.ok).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(SEUIL_COMMUN);
    expect(r.phrase).toContain("ressemble trop");
    expect(r.phrase).toContain("10/11/2026");
    expect(r.phrase).toContain("Instagram");
    expect(r.phrase).not.toMatch(/\b(score|axe|sha|id)\b/i);
  });
  it("accepté si assez différente", () => {
    const r = verifier(emp(tous(() => ["a"])), [voisine(emp(tous(() => ["b"])))]);
    expect(r.ok).toBe(true);
    expect(r.score).toBe(0);
  });
  it("même ouverture qu'une des 3 dernières : refus même si score bas", () => {
    const a = tous((x) => [x === "ouverture" ? "zoom" : "a"]);
    const b = tous((x) => [x === "ouverture" ? "zoom" : "b"]);
    const r = verifier(emp(a), [voisine(emp(b), 2)]);
    expect(r.score!).toBeLessThan(SEUIL_COMMUN);
    expect(r.ok).toBe(false);
    expect(r.phrase).toContain("ouverture");
    // 4e voisine (rang 3) : plus concernée
    expect(verifier(emp(a), [voisine(emp(b), 3)]).ok).toBe(true);
    // option élargie
    expect(verifier(emp(a), [voisine(emp(b), 3)], { ouverturesRecentes: 4 }).ok).toBe(false);
  });
  it("axe imposé jamais cause de refus", () => {
    const a = emp(tous((x) => [x === "ouverture" || x === "palette" ? "p" : x + "1"]), ["ouverture", "palette"]);
    const b = emp(tous((x) => [x === "ouverture" || x === "palette" ? "p" : x + "2"]));
    const r = verifier(a, [voisine(b)]);
    expect(r.ok).toBe(true);
    expect(r.axesCommuns).not.toContain("ouverture");
    expect(r.axesCommuns).not.toContain("palette");
  });
  it("seuls des axes imposés se ressemblent : ok avec « (votre choix) »", () => {
    const tout = tous(() => ["p"]);
    const r = verifier(emp(tout, [...AXES_COMMUNS]), [voisine(emp(tout))]);
    expect(r.ok).toBe(true);
    expect(r.phrase).toContain("(votre choix)");
  });
  it("score null → ok", () => {
    const r = verifier(emp({ ouverture: ["a"] }), [voisine(emp({ ouverture: ["b"] }))]);
    expect(r.score).toBeNull();
    expect(r.ok).toBe(true);
  });
  it("aucune voisine → ok", () => {
    expect(verifier(emp(tous(() => ["a"])), []).ok).toBe(true);
  });
  it("ne modifie pas ses entrées", () => {
    const c = emp(tous(() => ["a"]), ["fin"]);
    const v = [voisine(emp(tous(() => ["a"])))];
    const copie = JSON.stringify([c, v]);
    verifier(c, v);
    expect(JSON.stringify([c, v])).toBe(copie);
  });
  it("garde statique : ni Math.random ni Date", () => {
    for (const f of ["garde", "tirage"]) {
      const src = readFileSync(`src/briques/variete-commune/${f}.ts`, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(src).not.toMatch(/Math\.random/);
      expect(src).not.toMatch(/\bDate\b/);
    }
  });
});
