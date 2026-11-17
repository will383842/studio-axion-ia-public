/** C2-U20a (AM-09) : géométrie pure de l'escalier de lignes. Éteint, inutilisé, aucune voix. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ESCALIER, ESCALIER_ACTIF, geometrieEscalier } from "@/briques/sous-titres/escalier";

const L = 1080;
const H = 1920;
const zone = { xPx: 54, yPx: 200, largeurPx: 972, hauteurPx: 1200 };
const g = (lignes: string[], z = zone, taille = 60) => geometrieEscalier(lignes, L, H, z, taille);

const sources = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (n === "node_modules") return [];
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe("C2-U20a : valeurs figées", () => {
  it("éteint par défaut", () => {
    expect(ESCALIER_ACTIF).toBe(false);
    expect(ESCALIER).toEqual({ decalageParLigne: 0.12, tailleMax: 1.4, interligne: 0.85, lignesMin: 2, lignesMax: 6 });
  });
});

describe("C2-U20a : géométrie", () => {
  it("décale de 0,12 × largeur par ligne et grossit de ×1 à ×1,4", () => {
    const r = g(["Un", "Deux", "Trois"])!;
    expect(r).not.toBeNull();
    expect(r.lignes).toHaveLength(3);
    expect(r.lignes.map((l) => l.texte)).toEqual(["Un", "Deux", "Trois"]);
    expect(r.lignes[0].echelle).toBe(1);
    expect(r.lignes[2].echelle).toBeCloseTo(1.4, 10);
    expect(r.lignes[1].echelle).toBeCloseTo(1.2, 10);
    expect(r.lignes[1].xPx - r.lignes[0].xPx).toBeCloseTo(0.12 * L, 6);
    expect(r.lignes[2].xPx - r.lignes[1].xPx).toBeCloseTo(0.12 * L, 6);
  });

  it("interligne serré, lignes de haut en bas", () => {
    const r = g(["Un", "Deux", "Trois"])!;
    expect(r.lignes[1].yPx).toBeGreaterThan(r.lignes[0].yPx);
    expect(r.lignes[2].yPx).toBeGreaterThan(r.lignes[1].yPx);
    expect(r.lignes[1].yPx - r.lignes[0].yPx).toBeLessThanOrEqual(r.lignes[0].taillePx * 1.4 * 0.9 + 1e-6);
  });

  it("refus (null → gabarit groupe) : 1 ligne, 7 lignes, ligne vide", () => {
    expect(g(["Seule"])).toBeNull();
    expect(g(["a", "b", "c", "d", "e", "f", "g"])).toBeNull();
    expect(g(["a", "  ", "c"])).toBeNull();
    expect(g(["a", "b", "c", "d", "e", "f"])).not.toBeNull();
  });

  it("ne sort jamais de la zone sûre, sinon null", () => {
    for (const lignes of [["Un", "Deux"], ["Un", "Deux", "Trois", "Quatre"], ["Bonjour", "tout le monde", "et bienvenue", "ici"]]) {
      const r = g(lignes);
      if (!r) continue;
      for (const l of r.lignes) {
        expect(l.xPx).toBeGreaterThanOrEqual(zone.xPx - 1e-6);
        expect(l.xPx + l.largeurPx).toBeLessThanOrEqual(zone.xPx + zone.largeurPx + 1e-6);
        expect(l.yPx).toBeGreaterThanOrEqual(zone.yPx - 1e-6);
        expect(l.yPx + l.hauteurPx).toBeLessThanOrEqual(zone.yPx + zone.hauteurPx + 1e-6);
      }
    }
    expect(g(["Un", "Deux", "Trois"], { xPx: 0, yPx: 0, largeurPx: 100, hauteurPx: 100 })).toBeNull();
    expect(g(["Un", "Deux"], zone, 6000)).toBeNull();
  });

  it("déterministe, texte inchangé", () => {
    const a = ["Mots  inchangés", "À voir"];
    expect(g(a)).toEqual(g(a));
    expect(g(a)!.lignes.map((l) => l.texte)).toEqual(a);
  });
});

describe("C2-U20a : éteint = identique", () => {
  it("seul LigneEscalier.tsx importe escalier.ts, et rien n'importe LigneEscalier", () => {
    const tous = [...sources("src"), ...sources("studio-rendu/src"), ...sources("studio-rendu/compositions")];
    const hors = tous.filter(
      (f) => !f.endsWith("sous-titres/escalier.ts") && /(from|import)\s*\(?\s*["'][^"']*\/escalier["']/.test(readFileSync(f, "utf8")),
    );
    expect(hors.map((f) => f.replace(/\\/g, "/"))).toEqual(["studio-rendu/compositions/sous-titres/LigneEscalier.tsx"]);
    const importeurs = tous.filter(
      (f) => !f.endsWith("sous-titres/LigneEscalier.tsx") && /(from|import)\s*\(?\s*["'][^"']*LigneEscalier["']/.test(readFileSync(f, "utf8")),
    );
    expect(importeurs).toEqual([]);
  });
  it("escalier.ts : pur (aucun alias @/, ni React, ni Remotion, ni horloge)", () => {
    const s = readFileSync("src/briques/sous-titres/escalier.ts", "utf8");
    expect(s).not.toMatch(/from\s+["']@\//);
    expect(s).not.toMatch(/from\s+["'](react|remotion)/);
    expect(s).not.toMatch(/Date\.now|Math\.random/);
  });
});
