/**
 * C11-H5 — Courbes d'accélération de la caméra virtuelle (pures, non branchées, effet CAM-02).
 * Éteint = identique : aucun fichier existant n'importe `courbes-camera`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { profilCamera, trajetSurCourbe, zoomCamera, type NomProfilCamera } from "../../../src/briques/motion/camera-couverture/courbes-camera";

const RACINE = join(__dirname, "..", "..", "..");
const NOMS: NomProfilCamera[] = ["accostage", "travelling", "poussee-lente"];

describe("profilCamera", () => {
  for (const nom of NOMS) {
    it(`${nom} : 0 au début, 1 à la fin, monotone sur 100 pas, dans [0, 1]`, () => {
      expect(profilCamera(nom, 0)).toBe(0);
      expect(profilCamera(nom, 1)).toBe(1);
      let prec = 0;
      for (let i = 0; i <= 100; i++) {
        const v = profilCamera(nom, i / 100);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(prec - 1e-9);
        prec = v;
      }
    });
    it(`${nom} : borne t hors [0, 1] et ignore NaN`, () => {
      expect(profilCamera(nom, -3)).toBe(0);
      expect(profilCamera(nom, 7)).toBe(1);
      expect(profilCamera(nom, Number.NaN)).toBe(0);
    });
  }
  it("les trois profils sont distincts", () => {
    const v = NOMS.map((n) => profilCamera(n, 0.3));
    expect(new Set(v.map((x) => x.toFixed(4))).size).toBe(3);
  });
});

describe("trajetSurCourbe", () => {
  const p3 = [{ x: 0, y: 0 }, { x: 50, y: 20 }, { x: 100, y: 0 }];
  const p4 = [{ x: 10, y: 10 }, { x: 30, y: 60 }, { x: 70, y: 60 }, { x: 90, y: 10 }];
  it("passe par ses extrémités (3 et 4 points)", () => {
    expect(trajetSurCourbe(p3, 0)).toEqual({ x: 0, y: 0 });
    expect(trajetSurCourbe(p3, 1)).toEqual({ x: 100, y: 0 });
    expect(trajetSurCourbe(p4, 0)).toEqual({ x: 10, y: 10 });
    expect(trajetSurCourbe(p4, 1)).toEqual({ x: 90, y: 10 });
  });
  it("milieu de la courbe à 3 points = (50, 10)", () => {
    const m = trajetSurCourbe(p3, 0.5);
    expect(m.x).toBeCloseTo(50, 6);
    expect(m.y).toBeCloseTo(10, 6);
  });
  it("refuse un nombre de points autre que 3 ou 4", () => {
    expect(() => trajetSurCourbe([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0.5)).toThrow();
    expect(() => trajetSurCourbe(Array(5).fill({ x: 0, y: 0 }), 0.5)).toThrow();
  });
});

describe("zoomCamera", () => {
  it("part de `debut`, arrive à `fin`", () => {
    expect(zoomCamera(1, 1.3, 0, "accostage")).toBe(1);
    expect(zoomCamera(1, 1.3, 1, "accostage")).toBeCloseTo(1.3, 9);
  });
  it("reste borné dans [1, 1,6], même hors bornes demandées", () => {
    for (const nom of NOMS) {
      for (let i = 0; i <= 20; i++) {
        const e = zoomCamera(0.5, 3, i / 20, nom);
        expect(e).toBeGreaterThanOrEqual(1);
        expect(e).toBeLessThanOrEqual(1.6);
      }
    }
  });
});

describe("éteint = identique", () => {
  it("aucun autre fichier n'importe courbes-camera ; aucun littéral de courbe dans le fichier", () => {
    const sources: string[] = [];
    const marche = (d: string) => {
      for (const n of readdirSync(d)) {
        if (n === "node_modules" || n === ".next") continue;
        const c = join(d, n);
        if (statSync(c).isDirectory()) marche(c);
        else if (/\.(ts|tsx)$/.test(n)) sources.push(c);
      }
    };
    for (const d of ["src", "studio-rendu/src", "studio-rendu/compositions"]) if (existsSync(join(RACINE, d))) marche(join(RACINE, d));
    const importeurs = sources
      .map((f) => relative(RACINE, f).split(sep).join("/"))
      .filter((f) => !f.endsWith("camera-couverture/courbes-camera.ts"))
      .filter((f) => readFileSync(join(RACINE, f), "utf8").includes("courbes-camera"));
    // Décision du pilote (T-EXT-44) : `motion-film.ts` est le seul importateur permis ; tout autre reste refusé.
    expect(importeurs.filter((f) => f !== "src/briques/plan-scenes/tutoriel/motion-film.ts")).toEqual([]);
    expect(importeurs).toEqual(["src/briques/plan-scenes/tutoriel/motion-film.ts"]);
    const code = readFileSync(join(RACINE, "src/briques/motion/camera-couverture/courbes-camera.ts"), "utf8");
    expect(code).not.toMatch(/cubic-bezier\(|Easing\.bezier\(|\b(damping|stiffness|mass)\s*:\s*[0-9.]/);
    expect(code).not.toMatch(/from\s+["']@\//);
  });
});
