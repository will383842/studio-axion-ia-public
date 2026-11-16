import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deciderBoucle, type SceneBoucle } from "../../../src/briques/fins/boucle";

const motion = (debutMs: number, finMs: number, fond = "creme", etat = "e0"): SceneBoucle => ({ type: "motion", debutMs, finMs, fond, etatEntree: etat });

describe("fin en boucle (X1-11)", () => {
  it("refuse une face caméra dans la dernière seconde", () => {
    const d = deciderBoucle([motion(0, 5000), { ...motion(5000, 9000), type: "face-camera" }]);
    expect(d.boucle).toBe(false);
    expect(d).toMatchObject({ boucle: false, raison: "visage-fin" });
  });
  it("refuse une face caméra dans la première seconde", () => {
    const d = deciderBoucle([{ ...motion(0, 4000), type: "face-camera" }, motion(4000, 9000)]);
    expect(d).toMatchObject({ boucle: false, raison: "visage-debut" });
  });
  it("accepte motion / tableau / image-vidéo de même fond et rend le raccord", () => {
    for (const t of ["motion", "tableau", "image-video"] as const) {
      const sc = [{ ...motion(0, 4000, "creme", "entree-A"), type: t }, motion(4000, 9000, "creme", "x")];
      const d = deciderBoucle(sc);
      expect(d.boucle).toBe(true);
      if (d.boucle) expect(d.raccord).toEqual({ etatFinal: "entree-A", sceneFinale: 1, sceneInitiale: 0 });
    }
  });
  it("refuse un fond différent", () => {
    expect(deciderBoucle([motion(0, 4000, "creme"), motion(4000, 9000, "nuit")])).toMatchObject({ boucle: false, raison: "fond-different" });
  });
  it("refuse sans scène ou durée < 2 s", () => {
    expect(deciderBoucle([])).toMatchObject({ boucle: false, raison: "vide" });
    expect(deciderBoucle([motion(0, 1500)])).toMatchObject({ boucle: false, raison: "trop-court" });
  });
  it("même entrée = même décision, entrée non modifiée", () => {
    const sc = [motion(0, 4000), motion(4000, 9000)];
    const copie = JSON.stringify(sc);
    expect(deciderBoucle(sc)).toEqual(deciderBoucle(sc));
    expect(JSON.stringify(sc)).toBe(copie);
  });
  it("éteint = identique : aucune source n'importe fins/boucle ni deciderBoucle", () => {
    const lister = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (n === "node_modules" || n === "dist") return [];
        const c = join(d, n);
        return statSync(c).isDirectory() ? lister(c) : /\.(ts|tsx)$/.test(n) ? [c] : [];
      });
    const sources = [...lister("src"), ...lister("studio-rendu")].filter((f) => !f.replace(/\\/g, "/").endsWith("src/briques/fins/boucle.ts"));
    expect(sources.length).toBeGreaterThan(0);
    for (const f of sources) {
      const code = readFileSync(f, "utf8");
      expect(code, f).not.toMatch(/fins\/boucle|deciderBoucle/);
    }
    expect(readFileSync("src/briques/fins/index.ts", "utf8")).not.toMatch(/boucle/);
  });
});
