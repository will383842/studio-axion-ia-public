/** C11-T7 : mode carte (un groupe de sous-titres devient une carte plein cadre). Pièce neuve, éteinte. Aucune voix, aucun réseau. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("remotion", () => ({
  useCurrentFrame: () => 25,
  useVideoConfig: () => ({ width: 1080, height: 1920, fps: 25 }),
  delayRender: () => 1,
  continueRender: () => undefined,
}));

import { PAIRES_TEXTE } from "@/briques/charte/axion-2026";
import { largeurLigne } from "@/briques/sous-titres/mesure";
import { geometrieCarteGroupe, MODE_CARTE_ACTIF, POLICE_CARTE, type ParametresCarte } from "@/briques/sous-titres/mode-carte";

const mots = (s: string) => s.split(" ").map((mot, i) => ({ mot, debutSec: 10 + i * 0.3, finSec: 10.3 + i * 0.3 }));
const base: ParametresCarte = { mots: mots("Le plus dur est de commencer demain matin"), debutSec: 10, finSec: 13, fond: "ivoire" };
const FONDS = ["ivoire", "noir", "terracotta"] as const;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    if (n === "node_modules" || n.startsWith(".")) return [];
    const p = join(dossier, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("mode carte", () => {
  it("éteint par défaut", () => expect(MODE_CARTE_ACTIF).toBe(false));

  it("hors de [debutSec, finSec] : null ; bornes exactes incluses", () => {
    expect(geometrieCarteGroupe(base, 1080, 1920, 9.999)).toBeNull();
    expect(geometrieCarteGroupe(base, 1080, 1920, 13.001)).toBeNull();
    expect(geometrieCarteGroupe(base, 1080, 1920, 10)).not.toBeNull();
    expect(geometrieCarteGroupe(base, 1080, 1920, 13)).not.toBeNull();
    expect(geometrieCarteGroupe(base, 1080, 1920, 11.5)).not.toBeNull();
  });

  it("groupe vide ou durée nulle : null", () => {
    expect(geometrieCarteGroupe({ ...base, mots: [] }, 1080, 1920, 11)).toBeNull();
    expect(geometrieCarteGroupe({ ...base, finSec: 9 }, 1080, 1920, 9.5)).toBeNull();
  });

  it("cadre plein ; 2 à 4 lignes (si assez de mots) dans le cadre", () => {
    for (const [l, h] of [[1080, 1920], [1920, 1080], [1080, 1080]]) {
      for (const n of [1, 2, 3, 5, 8, 14]) {
        const g = geometrieCarteGroupe({ ...base, mots: mots(Array.from({ length: n }, () => "exemple").join(" ")) }, l, h, 11.5)!;
        expect(g.cadre).toEqual({ x: 0, y: 0, largeur: l, hauteur: h });
        expect(g.lignes.length).toBeLessThanOrEqual(4);
        expect(g.lignes.length).toBe(Math.min(n, Math.max(2, g.lignes.length)));
        if (n >= 2) expect(g.lignes.length).toBeGreaterThanOrEqual(2);
        for (const lg of g.lignes) {
          expect(largeurLigne(lg.split(" "), POLICE_CARTE, g.taillePolice)).toBeLessThanOrEqual(l * 0.9);
        }
        expect(g.lignes.length * g.taillePolice * g.interligne).toBeLessThanOrEqual(h);
        expect(g.lignes.join(" ")).toBe(Array.from({ length: n }, () => "exemple").join(" "));
      }
    }
  });

  it("mot long : taille réduite sans débordement", () => {
    const court = geometrieCarteGroupe(base, 1080, 1920, 11.5)!;
    const long = geometrieCarteGroupe({ ...base, mots: mots("Anticonstitutionnellement et Intergouvernementalisation") }, 1080, 1920, 11.5)!;
    expect(long.taillePolice).toBeLessThan(court.taillePolice);
    for (const lg of long.lignes) expect(largeurLigne(lg.split(" "), POLICE_CARTE, long.taillePolice)).toBeLessThanOrEqual(1080 * 0.9);
  });

  it("taille bornée en haut", () => {
    const g = geometrieCarteGroupe({ ...base, mots: mots("Oui non") }, 1080, 1920, 11.5)!;
    expect(g.taillePolice).toBeLessThanOrEqual(1080 * 0.14);
  });

  it("couleurs : une paire [texte, fond] de la charte", () => {
    for (const fond of FONDS) {
      const g = geometrieCarteGroupe({ ...base, fond }, 1080, 1920, 11.5)!;
      expect(PAIRES_TEXTE.some(([t, f]) => t === g.couleurs.texte && f === g.couleurs.fond), fond).toBe(true);
    }
  });

  it("même minutage : entrée croissante, plein au milieu, sortie finissant à finSec exactement", () => {
    const a = geometrieCarteGroupe(base, 1080, 1920, 10)!;
    const b = geometrieCarteGroupe(base, 1080, 1920, 10.2)!;
    const m = geometrieCarteGroupe(base, 1080, 1920, 11.5)!;
    const f = geometrieCarteGroupe(base, 1080, 1920, 13)!;
    expect(a.opacite).toBe(0);
    expect(b.opacite).toBeGreaterThan(a.opacite);
    expect(m.opacite).toBe(1);
    expect(f.opacite).toBe(0);
    // Court : entrée et sortie tiennent dans la durée, jamais d'opacité > 1 ni < 0.
    for (let t = 10; t <= 10.5; t += 0.05) {
      const g = geometrieCarteGroupe({ ...base, finSec: 10.5 }, 1080, 1920, t)!;
      expect(g.opacite).toBeGreaterThanOrEqual(0);
      expect(g.opacite).toBeLessThanOrEqual(1);
    }
  });

  it("garde : aucun fichier existant n'importe mode-carte ni CarteGroupe (éteint = identique)", () => {
    const neufs = ["mode-carte.ts", "CarteGroupe.tsx", "mode-carte.test.ts"];
    for (const racine of ["src", "studio-rendu/src", "studio-rendu/compositions"]) {
      for (const f of fichiers(racine)) {
        if (neufs.some((n) => f.endsWith(n))) continue;
        expect(readFileSync(f, "utf8"), f).not.toMatch(/(?:from|import)\s*\(?\s*["'][^"']*(?:mode-carte|CarteGroupe)["']/);
      }
    }
  });

  it("garde : pas d'@/ dans mode-carte.ts, pas de v4, police Manrope", () => {
    const src = readFileSync("src/briques/sous-titres/mode-carte.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/v4|Montserrat/i);
    expect(POLICE_CARTE).toMatch(/^Manrope /);
  });

  it("rien de dessiné hors plage ; texte dessiné dans la plage", async () => {
    const chemin = "../../../studio-rendu/compositions/sous-titres/CarteGroupe";
    const { CarteGroupe } = (await import(/* @vite-ignore */ chemin)) as {
      CarteGroupe: (p: ParametresCarte) => ReturnType<typeof createElement> | null;
    };
    // Image 25 à 25 i/s = 1 s.
    expect(renderToStaticMarkup(createElement(CarteGroupe, { ...base, debutSec: 5, finSec: 8 }))).toBe("");
    expect(renderToStaticMarkup(createElement(CarteGroupe, { ...base, debutSec: 0, finSec: 3 }))).toContain("commencer");
  });
});
