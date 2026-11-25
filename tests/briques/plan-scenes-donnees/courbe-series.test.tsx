import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { CHARTE_AXION } from "@/briques/jetons-motion";
import { TOILES } from "@/briques/plan-scenes/toiles";
import { CourbeSeries } from "@/briques/plan-scenes-donnees/CourbeSeries";
import { DEBUT_TRACE, DUREE_TRACE, MARGES, geometrie, valider, type ParametresCourbeSeries } from "@/briques/plan-scenes-donnees/courbe-series";

const ok: ParametresCourbeSeries = {
  titre: "Visites par semaine",
  abscisses: ["S1", "S2", "S3", "S4"],
  series: [
    { nom: "Site", valeurs: [10, 20, 40, 80] },
    { nom: "Blog", valeurs: [0, 5, 15, 30] },
  ],
  enAvant: 0,
};
const serie = (n: number, pts: number) => Array.from({ length: n }, (_, i) => ({ nom: `s${i}`, valeurs: Array.from({ length: pts }, (_, j) => j + i) }));
const abs = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`);
const rendu = (image: number, p = ok) =>
  renderToStaticMarkup(createElement(CourbeSeries, { image, fps: 25, dureeImages: 200, fond: "ivoire", accent: "terracotta", parametres: p }));

describe("courbe à plusieurs séries : validation", () => {
  it("accepte une entrée correcte", () => {
    expect(valider(ok).ok).toBe(true);
  });
  it("refuse 1 série et 5 séries", () => {
    expect(valider({ ...ok, series: serie(1, 4), abscisses: abs(4) }).ok).toBe(false);
    expect(valider({ ...ok, series: serie(5, 4), abscisses: abs(4) }).ok).toBe(false);
  });
  it("accepte 4 séries", () => {
    expect(valider({ ...ok, series: serie(4, 4), abscisses: abs(4) }).ok).toBe(true);
  });
  it("refuse des longueurs différentes", () => {
    expect(valider({ ...ok, series: [ok.series[0]!, { nom: "x", valeurs: [1, 2, 3] }] }).ok).toBe(false);
  });
  it("refuse NaN et Infinity", () => {
    expect(valider({ ...ok, series: [ok.series[0]!, { nom: "x", valeurs: [1, NaN, 3, 4] }] }).ok).toBe(false);
    expect(valider({ ...ok, series: [ok.series[0]!, { nom: "x", valeurs: [1, Infinity, 3, 4] }] }).ok).toBe(false);
  });
  it("refuse 2 et 13 points, accepte 3 et 12", () => {
    expect(valider({ ...ok, abscisses: abs(2), series: serie(2, 2) }).ok).toBe(false);
    expect(valider({ ...ok, abscisses: abs(13), series: serie(2, 13) }).ok).toBe(false);
    expect(valider({ ...ok, abscisses: abs(3), series: serie(2, 3) }).ok).toBe(true);
    expect(valider({ ...ok, abscisses: abs(12), series: serie(2, 12) }).ok).toBe(true);
  });
  it("refuse un enAvant hors des séries et un titre vide", () => {
    expect(valider({ ...ok, enAvant: 2 }).ok).toBe(false);
    expect(valider({ ...ok, titre: "" }).ok).toBe(false);
  });
});

describe("courbe à plusieurs séries : géométrie", () => {
  const { largeur, hauteur } = TOILES.graphique;
  const g = geometrie(ok);
  it("les points restent dans la toile", () => {
    for (const s of g.series) for (const p of s.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(largeur);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(hauteur);
    }
  });
  it("le maximum de toutes les séries touche le haut de la zone", () => {
    const ys = g.series.flatMap((s) => s.points.map((p) => p.y));
    expect(Math.min(...ys)).toBe(g.haut);
    expect(g.haut).toBe(MARGES.haut);
  });
  it("0 est sur l'axe", () => {
    expect(g.series[1]!.points[0]!.y).toBe(g.axeY);
  });
});

describe("courbe à plusieurs séries : rendu", () => {
  it("image 0 : rien n'est tracé ; dernière image : tout est tracé", () => {
    const longueurs = (h: string) => [...h.matchAll(/stroke-dasharray="([\d.]+)"[^>]*stroke-dashoffset="([\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as const);
    const debut = longueurs(rendu(0));
    expect(debut.length).toBe(2);
    for (const [l, o] of debut) expect(o).toBe(l);
    const fin = longueurs(rendu(DEBUT_TRACE + DUREE_TRACE * 2 + 100));
    for (const [, o] of fin) expect(o).toBe(0);
  });
  it("même entrée = même balisage ; Manrope ; légende et valeurs reçues", () => {
    expect(rendu(60)).toBe(rendu(60));
    expect(rendu(60)).not.toBe(rendu(0));
    const h = rendu(400);
    expect(h).toContain("Manrope");
    expect(h).toContain("Site");
    expect(h).toContain("Blog");
    expect(h).toContain("80");
  });
  it("aucune couleur hors charte (hex)", () => {
    const hex = rendu(400).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    const permis = Object.values(CHARTE_AXION).map((c) => c.toLowerCase());
    for (const c of hex) expect(permis).toContain(c.toLowerCase());
  });
});

describe("courbe à plusieurs séries : garde statique (inscrite, gardée)", () => {
  it("catalogue.ts cite courbe-series (inscrite, porte fermée par PIECES_GARDEES)", () => {
    expect(readFileSync("src/briques/plan-scenes/catalogue.ts", "utf8")).toContain("courbe-series");
    expect(readFileSync("src/briques/plan-scenes/pieces-gardees.ts", "utf8")).toContain("courbe-series");
  });
  it("seuls catalogue.ts et briques/index.ts importent plan-scenes-donnees (liste fermée)", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n) && !p.startsWith(join("src", "briques", "plan-scenes-donnees"))) fichiers.push(p);
      }
    };
    parcourir("src");
    expect(fichiers.filter((f) => readFileSync(f, "utf8").includes("plan-scenes-donnees")).map((f) => f.split(sep).join("/")).sort()).toEqual(["src/briques/plan-scenes/briques/index.ts", "src/briques/plan-scenes/catalogue.ts"]);
  });
});
