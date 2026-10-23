import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COULEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import {
  COURBES_GESTES,
  ENTOURER,
  NOMS_GESTES,
  STYLO_PAR_DEFAUT,
  cheminBarrer,
  cheminCocher,
  cheminEcrire,
  cheminPointer,
  cheminSouligner,
  identifiantStylo,
  listerStylos,
  pointEntourer,
  stylo,
  trace,
  type Cible,
} from "../../../src/briques/stylo";

const cible: Cible = { x: 100, y: 200, largeur: 400, hauteur: 60 };

describe("registre des stylos", () => {
  it("le stylo demandé existe", () => {
    expect(STYLO_PAR_DEFAUT).toBe("crayon/1");
    expect(listerStylos()).toContain("crayon/1");
    const s = stylo("crayon/1");
    expect(identifiantStylo(s)).toBe("crayon/1");
    expect(s.licence).toBe("stylo-crayon-1");
  });

  it("un stylo inconnu est refusé", () => {
    expect(() => stylo("main-crayon/1")).toThrow(/inconnu/);
    expect(() => stylo("toString")).toThrow(/inconnu/);
  });

  it("la pointe est dans l'image", () => {
    for (const id of listerStylos()) {
      const s = stylo(id);
      expect(s.pointe.x).toBeGreaterThanOrEqual(0);
      expect(s.pointe.x).toBeLessThanOrEqual(1);
      expect(s.pointe.y).toBeGreaterThanOrEqual(0);
      expect(s.pointe.y).toBeLessThanOrEqual(1);
    }
  });

  it("expose les six gestes", () => {
    expect([...NOMS_GESTES]).toEqual(["ecrire", "souligner", "entourer", "barrer", "cocher", "pointer"]);
    for (const n of NOMS_GESTES) expect(typeof stylo("crayon/1").gestes[n]).toBe("function");
  });

  it("le crayon est vectoriel, aux couleurs de l'habillage, sans main ni visage", () => {
    const { svg } = stylo("crayon/1");
    expect(svg.startsWith("<svg")).toBe(true);
    const couleurs = (svg.match(/#[0-9a-fA-F]{6}/g) ?? []).map((c) => c.toLowerCase());
    const permises = Object.values(COULEURS_VIDEO).map((c) => c.toLowerCase());
    expect(couleurs.length).toBeGreaterThan(0);
    for (const c of couleurs) expect(permises).toContain(c);
    expect(svg).not.toMatch(/<image|<circle|<ellipse|<text/);
  });

  it("le fichier public est identique au dessin du registre", () => {
    const fichier = readFileSync(new URL("../../../public/stylo/crayon/crayon-1.svg", import.meta.url), "utf8");
    expect(fichier.trim()).toBe(stylo("crayon/1").svg);
    expect(stylo("crayon/1").image).toBe("stylo/crayon/crayon-1.svg");
  });

  it("n'utilise pas d'alias « @/ » (lu par studio-rendu)", () => {
    for (const f of ["types.ts", "courbes.ts", "index.ts", "registre/index.ts", "registre/crayon-1.ts"]) {
      expect(readFileSync(new URL(`../../../src/briques/stylo/${f}`, import.meta.url), "utf8")).not.toMatch(/from\s+["']@\//);
    }
  });
});

describe("courbes des gestes", () => {
  const attendu = {
    ecrire: [cheminEcrire(cible)[0], cheminEcrire(cible)[1]],
    souligner: [cheminSouligner(cible)[0], cheminSouligner(cible)[1]],
    barrer: [cheminBarrer(cible)[0], cheminBarrer(cible)[1]],
    cocher: [cheminCocher(cible)[0], cheminCocher(cible)[2]],
    pointer: [cheminPointer(cible)[0], cheminPointer(cible)[1]],
    entourer: [pointEntourer(cible, 0), pointEntourer(cible, 1)],
  } as const;

  it("points de départ et d'arrivée écrits en dur (le plan)", () => {
    expect(COURBES_GESTES.ecrire(0, cible)).toEqual({ x: 100, y: 248 });
    expect(COURBES_GESTES.ecrire(1, cible)).toEqual({ x: 500, y: 248 });
    expect(COURBES_GESTES.souligner(0, cible).x).toBe(100);
    expect(COURBES_GESTES.pointer(1, cible)).toEqual({ x: 300, y: 230 });
    // Entourer : départ au sommet de l'ellipse, centrée sur la cible.
    expect(COURBES_GESTES.entourer(0, cible).x).toBeCloseTo(300, 9);
    expect(COURBES_GESTES.entourer(0, cible).y).toBeLessThan(200);
    expect(ENTOURER.balayage).toBeGreaterThan(2 * Math.PI);
  });

  for (const nom of NOMS_GESTES) {
    it(`${nom} : début et fin exacts`, () => {
      const [debut, fin] = attendu[nom];
      expect(COURBES_GESTES[nom](0, cible)).toEqual(debut);
      expect(COURBES_GESTES[nom](1, cible)).toEqual(fin);
    });

    it(`${nom} : bornée hors de [0, 1]`, () => {
      expect(COURBES_GESTES[nom](-3, cible)).toEqual(COURBES_GESTES[nom](0, cible));
      expect(COURBES_GESTES[nom](7, cible)).toEqual(COURBES_GESTES[nom](1, cible));
      expect(COURBES_GESTES[nom](Number.NaN, cible)).toEqual(COURBES_GESTES[nom](0, cible));
    });

    it(`${nom} : déterministe (mêmes entrées, mêmes sorties, dans l'ordre ou non)`, () => {
      const us = Array.from({ length: 101 }, (_, i) => i / 100);
      const a = us.map((u) => COURBES_GESTES[nom](u, cible));
      const b = [...us].reverse().map((u) => COURBES_GESTES[nom](u, cible)).reverse();
      expect(b).toEqual(a);
      for (const p of a) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    });
  }

  it("le trait suit la courbe : dernier point = position de la pointe", () => {
    for (const nom of NOMS_GESTES) {
      const t = trace(COURBES_GESTES[nom], cible, 0.6);
      expect(t[0]).toEqual(COURBES_GESTES[nom](0, cible));
      expect(t[t.length - 1]).toEqual(COURBES_GESTES[nom](0.6, cible));
      expect(trace(COURBES_GESTES[nom], cible, 0)).toHaveLength(1);
    }
  });

  it("n'utilise ni hasard ni horloge", () => {
    const src = readFileSync(new URL("../../../src/briques/stylo/courbes.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/Math\.random|Date\.now|performance\.now|new Date/);
  });
});
