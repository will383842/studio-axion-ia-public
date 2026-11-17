/**
 * C8-Z05a : règle de comptage pure des zooms par minute (outil local, aucune donnée réelle).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ligneRapport, zoomsAvocat, zoomsClassique, zoomsFenetres } from "../../outils/zoom-gratuit/compter";
import { appliquerZooms, cadrePour, type PlanCamera } from "@/briques/realisation";

const RACINE = resolve(__dirname, "../..");
const plan = (debutSec: number, finSec: number, taille: number, ouverture: string) => ({ debutSec, finSec, taille, ouverture });

describe("zoomsClassique", () => {
  const plans = [plan(0, 10, 100, "debut"), plan(10, 20, 115, "coupe"), plan(20, 30, 100, "coupe"), plan(30, 40, 130, "punch-in"), plan(40, 60, 100, "coupe")];

  it("compte punch-in et resserrements, à la main", () => {
    const c = zoomsClassique(plans, 60);
    expect(c.detail).toEqual({ punchIn: 1, resserrements: 1 });
    expect(c.total).toBe(2);
    expect(c.parMinute).toBe(2);
    expect(zoomsClassique(plans, 30).parMinute).toBe(4);
  });

  it("le premier plan ne compte jamais", () => {
    expect(zoomsClassique([plan(0, 5, 130, "punch-in")], 60).total).toBe(0);
  });

  it("avec le vrai code : appliquerZooms pose un punch-in", () => {
    const source = { largeur: 1920, hauteur: 1080 };
    const base: PlanCamera[] = [0, 10, 20].map((d, i) => ({
      debutSec: d,
      finSec: d + 10,
      priseDebutSec: d,
      priseFinSec: d + 10,
      taille: 100,
      cadre: cadrePour(100, { yeuxX: 0.5, yeuxY: 0.34 }, source, 9 / 16).cadre,
      ouverture: i === 0 ? "debut" : "coupe",
      yeuxHauteur: 0.34,
    }));
    expect(zoomsClassique(base, 30).detail.punchIn).toBe(0);
    const apres = appliquerZooms(base, [{ debutSec: 10, finSec: 13 }], source);
    expect(zoomsClassique(apres, 30).detail.punchIn).toBeGreaterThanOrEqual(1);
  });
});

describe("zoomsAvocat", () => {
  it("lents et resserrements", () => {
    const c = zoomsAvocat([{ debutSec: 0, finSec: 5, zoom: 1 }, { debutSec: 5, finSec: 10, zoom: 1, zoomFin: 1.06 }, { debutSec: 10, finSec: 15, zoom: 1.2 }, { debutSec: 15, finSec: 20, zoom: 1 }], 60);
    expect(c.detail.lents).toBe(1);
    expect(c.detail.resserrements).toBe(1);
    expect(c.total).toBe(2);
  });
  it("zoomFin égal à zoom n'est pas un zoom lent", () => {
    expect(zoomsAvocat([{ debutSec: 0, finSec: 5, zoom: 1, zoomFin: 1 }], 60).detail.lents).toBe(0);
  });
});

describe("zoomsFenetres", () => {
  it("fenêtre glissante de 60 s", () => {
    const c = zoomsFenetres([1, 20, 40, 70].map((d) => ({ debutSec: d, finSec: d + 2 })), 120);
    expect(c.maxSur60s).toBe(3);
    expect(c.total).toBe(4);
    expect(c.detail.fenetres).toBe(4);
  });
});

describe("bords", () => {
  it("vide, durée nulle, négative ou NaN : zéros, aucune exception", () => {
    for (const d of [60, 0, -5, Number.NaN]) {
      for (const c of [zoomsClassique([], d), zoomsAvocat([], d), zoomsFenetres([], d)]) {
        expect(c.total).toBe(0);
        expect(c.parMinute).toBe(0);
        expect(c.maxSur60s).toBe(0);
      }
    }
    expect(zoomsFenetres([{ debutSec: 1, finSec: 2 }], 0).parMinute).toBe(0);
    expect(zoomsFenetres([{ debutSec: 1, finSec: 2 }], Number.NaN).parMinute).toBe(0);
  });
  it("entrées gelées non modifiées", () => {
    const f = Object.freeze([Object.freeze({ debutSec: 1, finSec: 2 }), Object.freeze({ debutSec: 3, finSec: 4 })]);
    const a = Object.freeze([Object.freeze({ debutSec: 0, finSec: 1, zoom: 1, zoomFin: 1.1 })]);
    const k = Object.freeze([Object.freeze(plan(0, 1, 100, "debut")), Object.freeze(plan(1, 2, 130, "punch-in"))]);
    expect(() => { zoomsFenetres(f, 60); zoomsAvocat(a, 60); zoomsClassique(k, 60); }).not.toThrow();
  });
});

describe("ligneRapport", () => {
  it("virgule décimale à la française", () => {
    const c = zoomsFenetres([1, 25, 50, 75, 100].map((d) => ({ debutSec: d, finSec: d + 2 })), 120);
    expect(ligneRapport("gratuit", c)).toBe("gratuit : 5 zoom(s), 2,5 par minute, au plus 3 sur 60 s");
  });
});

describe("garde", () => {
  const parcourir = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((n) => {
      if (n === "node_modules" || n === ".next") return [];
      const p = join(dossier, n);
      return statSync(p).isDirectory() ? parcourir(p) : /\.(ts|tsx|mts)$/.test(n) ? [p] : [];
    });
  it("ni src/ ni studio-rendu/ n'importent l'outil", () => {
    for (const d of ["src", "studio-rendu"]) {
      for (const f of parcourir(join(RACINE, d))) expect(readFileSync(f, "utf8").includes("zoom-gratuit/compter"), f).toBe(false);
    }
  });
  it("le fichier neuf ne contient aucun import", () => {
    const code = readFileSync(join(RACINE, "outils/zoom-gratuit/compter.ts"), "utf8");
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/\bimport\(/);
  });
});
