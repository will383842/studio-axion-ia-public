/**
 * N-09 — Bruit maison à graine fixe et fumée. Éteint : aucun fichier existant n'importe `bruit` ou `fumee`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bruitFractal, bruitValeur2D, grilleBruit } from "../../../src/briques/motion/habillage-commun/bruit";
import { FUMEE, FUMEE_OPACITE_MAX, Fumee, nappesFumee } from "../../../src/briques/motion/habillage-commun/fumee";

const RACINE = join(__dirname, "..", "..", "..");

describe("bruit maison", () => {
  it("même graine → même grille, strictement", () => {
    const a = grilleBruit(24, 16, 42, 4);
    const b = grilleBruit(24, 16, 42, 4);
    expect(a.length).toBe(24 * 16);
    expect(Array.from(a)).toEqual(Array.from(b));
  });
  it("graines différentes → grilles différentes", () => {
    expect(Array.from(grilleBruit(24, 16, 1, 4))).not.toEqual(Array.from(grilleBruit(24, 16, 2, 4)));
  });
  it("valeurs dans [0, 1] (valeur et fractal, y compris coordonnées négatives ou extrêmes)", () => {
    for (let i = -50; i < 50; i++) {
      for (const [x, y] of [[i * 0.37, i * 0.91], [i * 1e4, -i * 1e5], [NaN, Infinity]] as const) {
        const v = bruitValeur2D(x, y, i);
        const f = bruitFractal(x, y, i, 9);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(1);
      }
    }
    for (const v of grilleBruit(32, 32, 7, 3)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it("lissé : deux points voisins sont proches", () => {
    expect(Math.abs(bruitValeur2D(3.001, 5, 9) - bruitValeur2D(3, 5, 9))).toBeLessThan(0.01);
  });
  it("octaves bornées à 4", () => {
    expect(bruitFractal(1.3, 2.7, 5, 99)).toBe(bruitFractal(1.3, 2.7, 5, 4));
  });
});

describe("fumée", () => {
  const rendu = (image: number, graine: number, extra = {}) =>
    renderToStaticMarkup(createElement(Fumee, { image, fps: 25, largeur: 1080, hauteur: 1920, fond: "noir", graine, ...extra }));
  it("même graine et même image → même balisage", () => {
    expect(rendu(10, 3)).toBe(rendu(10, 3));
  });
  it("graine ou image différente → balisage différent", () => {
    expect(rendu(10, 3)).not.toBe(rendu(10, 4));
    expect(rendu(10, 3)).not.toBe(rendu(200, 3));
  });
  it("2 à 3 nappes, opacité ≤ 0,12 même si on demande plus", () => {
    const n = nappesFumee(5, 25, 1).length;
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(3);
    expect(FUMEE_OPACITE_MAX).toBeLessThanOrEqual(0.12);
    for (const m of rendu(5, 1, { opacite: 50 }).matchAll(/opacity:([0-9.]+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(0.12);
  });
  it("zone du visage : le calque est découpé, sans zone il ne l'est pas", () => {
    expect(rendu(5, 1, { zoneVisage: { x0: 22, x1: 78, y0: 14, y1: 56 } })).toContain("evenodd");
    expect(rendu(5, 1)).not.toContain("clip-path");
  });
  it("couleurs de la charte seulement", () => {
    expect(rendu(5, 1)).toContain("rgba(250, 249, 245");
    expect(rendu(5, 1)).not.toContain("178, 63, 22");
  });
  it("drapeaux exportés", () => {
    expect(FUMEE).toEqual({ attendMesure: true, incompatibleGrainFfmpeg: true });
  });
});

describe("garde éteint = identique", () => {
  const sources = (dossier: string, sortie: string[]) => {
    if (!existsSync(dossier)) return;
    for (const nom of readdirSync(dossier)) {
      if (nom === "node_modules") continue;
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) sources(chemin, sortie);
      else if (/\.(ts|tsx)$/.test(nom)) sortie.push(chemin);
    }
  };
  it("aucun fichier existant n'importe bruit ou fumee ; ni Math.random ni Date dans les nouveaux", () => {
    const tous: string[] = [];
    for (const d of ["src", "studio-rendu/compositions", "studio-rendu/src", "tests"]) sources(join(RACINE, d), tous);
    const propres = ["src/briques/motion/habillage-commun/bruit.ts", "src/briques/motion/habillage-commun/fumee.tsx", "tests/briques/motion/bruit.test.ts"];
    for (const f of tous) {
      const rel = relative(RACINE, f).split(sep).join("/");
      if (propres.includes(rel)) continue;
      expect(readFileSync(f, "utf8"), rel).not.toMatch(/from\s+["'][^"']*habillage-commun\/(bruit|fumee)["']/);
      if (rel.startsWith("src/briques/motion/habillage-commun/")) expect(readFileSync(f, "utf8"), rel).not.toMatch(/from\s+["']\.\/(bruit|fumee)["']/);
    }
    for (const rel of propres.slice(0, 2)) {
      const code = readFileSync(join(RACINE, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(code).not.toMatch(/Math\.random|Date\.|new Date|from\s+["']@\//);
    }
  });
});
