/**
 * X1-09 — trait au feutre : partie pure (points d'un entourage / d'un soulignement) + composant chargé par chemin calculé (PIEGE-REMOTION-TSC.md).
 * perfect-freehand n'est pas installé à la racine : le pur ne l'importe pas, le composant l'appelle (faux ici).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EPAISSEUR_FEUTRE_PX, epaisseurFeutre, pointsVisibles, traitFeutre } from "../../src/briques/motion/petits-objets/trait-feutre";
import { ZONE_VISAGE_OBJETS } from "../../src/briques/motion/petits-objets/zones";
import type { ZoneObjet } from "../../src/briques/motion/petits-objets/contrat";

const ZONE: ZoneObjet = { x: 10, y: 72, largeur: 50, hauteur: 12 };
const RACINE = join(__dirname, "..", "..");

describe("X1-09 trait au feutre (pur)", () => {
  it("entourage : contour fermé (dernier point = premier)", () => {
    const t = traitFeutre({ genre: "entourage", graine: 7, zone: ZONE });
    expect(t).not.toBeNull();
    expect(t!.ferme).toBe(true);
    expect(t!.points.length).toBeGreaterThan(8);
    expect(t!.points[t!.points.length - 1]).toEqual(t!.points[0]);
  });
  it("soulignement : trait ouvert", () => {
    const t = traitFeutre({ genre: "soulignement", graine: 7, zone: ZONE });
    expect(t!.ferme).toBe(false);
    expect(t!.points[t!.points.length - 1]).not.toEqual(t!.points[0]);
  });
  it("épaisseur dans [2, 10] px à 1080, pour toute entrée", () => {
    expect(EPAISSEUR_FEUTRE_PX).toEqual({ min: 2, max: 10 });
    for (const h of [0, 1, 12, 100, 1080, 99999, NaN, -5, Infinity]) {
      const e = epaisseurFeutre(h);
      expect(e).toBeGreaterThanOrEqual(2);
      expect(e).toBeLessThanOrEqual(10);
    }
    const t = traitFeutre({ genre: "entourage", graine: 1, zone: ZONE })!;
    expect(t.epaisseur).toBeGreaterThanOrEqual(2);
    expect(t.epaisseur).toBeLessThanOrEqual(10);
  });
  it("tracé progressif : t de 0 à 1 monotone, 0 = rien, 1 = tout", () => {
    const t = traitFeutre({ genre: "entourage", graine: 3, zone: ZONE })!;
    expect(pointsVisibles(t.points, 0)).toHaveLength(0);
    expect(pointsVisibles(t.points, 1)).toEqual(t.points);
    let prec = 0;
    for (let i = 0; i <= 100; i++) {
      const n = pointsVisibles(t.points, i / 100).length;
      expect(n).toBeGreaterThanOrEqual(prec);
      prec = n;
    }
    expect(pointsVisibles(t.points, -3)).toHaveLength(0);
    expect(pointsVisibles(t.points, 9)).toHaveLength(t.points.length);
    expect(pointsVisibles(t.points, NaN)).toHaveLength(0);
  });
  it("même graine = même chemin ; autre graine = autre chemin", () => {
    const a = traitFeutre({ genre: "entourage", graine: 42, zone: ZONE });
    expect(traitFeutre({ genre: "entourage", graine: 42, zone: ZONE })).toEqual(a);
    expect(traitFeutre({ genre: "entourage", graine: 43, zone: ZONE })).not.toEqual(a);
  });
  it("jamais devant le visage ni hors zone valide : refus (null)", () => {
    expect(traitFeutre({ genre: "entourage", graine: 1, zone: ZONE, visage: ZONE })).toBeNull();
    expect(traitFeutre({ genre: "entourage", graine: 1, zone: { ...ZONE, x: 30, y: 20 }, visage: ZONE_VISAGE_OBJETS })).toBeNull();
    expect(traitFeutre({ genre: "soulignement", graine: 1, zone: { x: 90, y: 90, largeur: 50, hauteur: 5 } })).toBeNull();
  });
  it("tous les points restent dans la toile 0..100 %", () => {
    for (const genre of ["entourage", "soulignement"] as const)
      for (const [x, y] of traitFeutre({ genre, graine: 9, zone: ZONE })!.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
  });
  it("garde : ni hexadécimal, ni Math.random, ni @/ dans les deux fichiers", () => {
    for (const f of ["src/briques/motion/petits-objets/trait-feutre.ts", "studio-rendu/compositions/petits-objets/TraitFeutre.tsx"]) {
      const s = readFileSync(join(RACINE, f), "utf8");
      expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(s).not.toMatch(/Math\.random|from\s+["']@\//);
    }
  });
});

describe("X1-09 composant (chemin calculé)", () => {
  it("TraitFeutre appelle getStroke et rend un tracé ; rien devant le visage", async () => {
    const { vi } = await import("vitest");
    vi.doMock("perfect-freehand", () => ({ getStroke: (pts: number[][]) => pts.map(([x, y]) => [x + 0.5, y]) }));
    vi.doMock("remotion", () => ({ AbsoluteFill: (p: { children?: unknown }) => p.children ?? null }));
    const chemin = ["..", "..", "studio-rendu", "compositions", "petits-objets", "TraitFeutre"].join("/");
    type Module = { TraitFeutre: (p: Record<string, unknown>) => unknown };
    const { TraitFeutre } = (await import(/* @vite-ignore */ chemin)) as Module;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const ok = renderToStaticMarkup(createElement(TraitFeutre as never, { genre: "entourage", graine: 5, zone: ZONE, progres: 1, ton: "accent", fond: "sombre" }));
    expect(ok).toContain("<path");
    const vide = renderToStaticMarkup(createElement(TraitFeutre as never, { genre: "entourage", graine: 5, zone: ZONE, visage: ZONE, progres: 1, ton: "accent", fond: "sombre" }));
    expect(vide).not.toContain("<path");
  });
});
