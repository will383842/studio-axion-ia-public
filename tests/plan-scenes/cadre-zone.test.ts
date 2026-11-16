import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cadreDansEcran, cadreDeZone, type CadreZone, type ZoneEcran } from "../../src/briques/plan-scenes/tutoriel/cadre-zone";
import type { SurlignageEcran } from "../../src/moteurs/montage-demo-facecam/pistes";

const TOILE = { largeur: 1080, hauteur: 1920 };

describe("cadreDeZone", () => {
  it("zone 10/10/50/20 sur 1080x1920 : rectangle attendu, marge comprise", () => {
    const c = cadreDeZone({ x: 10, y: 10, largeur: 50, hauteur: 20 }, TOILE);
    expect(c).toEqual({ x: 100, y: 184, largeur: 556, hauteur: 400, epaisseur: 4, couleur: "accent" });
  });
  it("marge et épaisseur réglables", () => {
    const c = cadreDeZone({ x: 10, y: 10, largeur: 50, hauteur: 20 }, TOILE, { marge: 0, epaisseur: 2 });
    expect(c).toMatchObject({ x: 108, y: 192, largeur: 540, hauteur: 384, epaisseur: 2 });
  });
  it("zone débordante : bornée à la toile", () => {
    const c = cadreDeZone({ x: 80, y: 90, largeur: 50, hauteur: 50 }, TOILE) as CadreZone;
    expect(c.x + c.largeur).toBeLessThanOrEqual(1080);
    expect(c.y + c.hauteur).toBeLessThanOrEqual(1920);
    expect(c.x).toBeGreaterThanOrEqual(0);
    const g = cadreDeZone({ x: -20, y: -20, largeur: 50, hauteur: 50 }, TOILE) as CadreZone;
    expect(g.x).toBe(0);
    expect(g.y).toBe(0);
  });
  it("zone vide ou hors cadre : null", () => {
    expect(cadreDeZone({ x: 10, y: 10, largeur: 0, hauteur: 20 }, TOILE)).toBeNull();
    expect(cadreDeZone({ x: 10, y: 10, largeur: 20, hauteur: -1 }, TOILE)).toBeNull();
    expect(cadreDeZone({ x: 120, y: 10, largeur: 20, hauteur: 20 }, TOILE)).toBeNull();
    expect(cadreDeZone({ x: -30, y: 10, largeur: 20, hauteur: 20 }, TOILE)).toBeNull();
    expect(cadreDeZone({ x: Number.NaN, y: 0, largeur: 10, hauteur: 10 }, TOILE)).toBeNull();
    expect(cadreDeZone({ x: 0, y: 0, largeur: 10, hauteur: 10 }, { largeur: 0, hauteur: 100 })).toBeNull();
  });
  it("sans option : jamais de couleur en dur, nom de jeton accent", () => {
    expect(cadreDeZone({ x: 0, y: 0, largeur: 100, hauteur: 100 }, TOILE)?.couleur).toBe("accent");
  });
});

describe("cadreDansEcran", () => {
  const ecran = { x: 0, y: 0, largeur: 1080, hauteur: 1350 }; // 4:5 en haut de la toile
  it("écran 4:5 en haut de toile : calcul relatif à l'écran", () => {
    const c = cadreDansEcran({ x: 10, y: 10, largeur: 50, hauteur: 20 }, ecran);
    expect(c).toEqual({ x: 100, y: 127, largeur: 556, hauteur: 286, epaisseur: 4, couleur: "accent" });
  });
  it("décalage de l'écran pris en compte", () => {
    const c = cadreDansEcran({ x: 0, y: 0, largeur: 50, hauteur: 50 }, { x: 200, y: 100, largeur: 400, hauteur: 300 }, { marge: 0 });
    expect(c).toMatchObject({ x: 200, y: 100, largeur: 200, hauteur: 150 });
  });
  it("jamais hors de rectEcran (donc jamais sur la colonne facecam)", () => {
    const re = { x: 0, y: 0, largeur: 1080, hauteur: 1350 };
    for (const z of [
      { x: 0, y: 0, largeur: 100, hauteur: 100 },
      { x: 90, y: 90, largeur: 50, hauteur: 50 },
      { x: -10, y: -10, largeur: 30, hauteur: 30 },
    ]) {
      const c = cadreDansEcran(z, re, { marge: 40 }) as CadreZone;
      expect(c.x).toBeGreaterThanOrEqual(re.x);
      expect(c.y).toBeGreaterThanOrEqual(re.y);
      expect(c.x + c.largeur).toBeLessThanOrEqual(re.x + re.largeur);
      expect(c.y + c.hauteur).toBeLessThanOrEqual(re.y + re.hauteur);
    }
  });
  it("écran vide : null", () => {
    expect(cadreDansEcran({ x: 0, y: 0, largeur: 10, hauteur: 10 }, { x: 0, y: 0, largeur: 0, hauteur: 10 })).toBeNull();
  });
});

describe("compatibilité de forme", () => {
  it("un SurlignageEcran est accepté tel quel", () => {
    const s: SurlignageEcran = { debutMs: 0, finMs: 1000, x: 10, y: 10, largeur: 50, hauteur: 20 };
    const z: ZoneEcran = s; // test de type : vérifié par tsc
    expect(cadreDeZone(s, TOILE, { marge: 0 })).toMatchObject({ x: 108, y: 192 });
    expect(z.x).toBe(10);
  });
});

describe("garde statique", () => {
  const src = readFileSync("src/briques/plan-scenes/tutoriel/cadre-zone.ts", "utf8");
  it("aucun import @/", () => expect(src).not.toMatch(/from\s+["']@\//));
  it("aucune couleur hexadécimale", () => expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/));
});
