import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pastilleEtape, tronquerLibelle } from "../../src/briques/plan-scenes/tutoriel/pastille-etape";

const TOILES = {
  "4:5": { largeur: 1080, hauteur: 1350 },
  "9:16": { largeur: 1080, hauteur: 1920 },
  "1:1": { largeur: 1080, hauteur: 1080 },
};
const SOURCES = [
  "src/briques/plan-scenes/tutoriel/pastille-etape.ts",
  "studio-rendu/compositions/plan-scenes/PastilleEtape.tsx",
];

describe("pastilleEtape", () => {
  it("« Étape 1/1 »", () => {
    expect(pastilleEtape(1, 1, "", TOILES["9:16"])?.texte).toBe("Étape 1/1");
  });
  it("texte complet avec libellé", () => {
    expect(pastilleEtape(2, 5, "Ouvrir les réglages", TOILES["9:16"])?.texte).toBe("Étape 2/5 · Ouvrir les réglages");
  });
  it("N > M, N < 1, non entier, non fini → null", () => {
    expect(pastilleEtape(6, 5, "x", TOILES["9:16"])).toBeNull();
    expect(pastilleEtape(0, 5, "x", TOILES["9:16"])).toBeNull();
    expect(pastilleEtape(1.5, 5, "x", TOILES["9:16"])).toBeNull();
    expect(pastilleEtape(NaN, 5, "x", TOILES["9:16"])).toBeNull();
    expect(pastilleEtape(1, 0, "x", TOILES["9:16"])).toBeNull();
  });
  it("toile vide → null", () => {
    expect(pastilleEtape(1, 2, "x", { largeur: 0, hauteur: 100 })).toBeNull();
  });
  it("libellé long → tronqué avec « … »", () => {
    const p = pastilleEtape(1, 3, "Cliquer sur le bouton de configuration avancée des paramètres du compte", TOILES["9:16"]);
    expect(p?.texte).toMatch(/…$/);
    expect(p!.texte.length).toBeLessThanOrEqual(60);
  });
  it("tronquerLibelle : court inchangé, long coupé sans dépasser", () => {
    expect(tronquerLibelle("Court", 10)).toBe("Court");
    const t = tronquerLibelle("un libellé vraiment très long", 12);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(12);
    expect(tronquerLibelle("abcdef", 1)).toBe("…");
  });
  for (const [nom, toile] of Object.entries(TOILES)) {
    it(`rectangle dans la toile ${nom}`, () => {
      for (const lib of ["", "Court", "Un libellé extrêmement long ".repeat(10)]) {
        const p = pastilleEtape(3, 9, lib, toile)!;
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.largeur).toBeLessThanOrEqual(toile.largeur);
        expect(p.y + p.hauteur).toBeLessThanOrEqual(toile.hauteur);
        expect(p.largeur).toBeGreaterThan(0);
      }
    });
  }
  it("petite toile : toujours borné", () => {
    const p = pastilleEtape(1, 2, "Libellé", { largeur: 100, hauteur: 60 })!;
    expect(p.x + p.largeur).toBeLessThanOrEqual(100);
    expect(p.y + p.hauteur).toBeLessThanOrEqual(60);
  });
  it("couleurs = noms de jetons ; déterministe", () => {
    const a = pastilleEtape(2, 5, "Réglages", TOILES["1:1"]);
    expect(a?.couleurs).toEqual({ fond: "accent", texte: "fond" });
    expect(pastilleEtape(2, 5, "Réglages", TOILES["1:1"])).toEqual(a);
  });
});

describe("garde statique", () => {
  for (const f of SOURCES) {
    const src = readFileSync(f, "utf8");
    it(`${f} : pas de @/ ni d'hexadécimal`, () => {
      expect(src).not.toMatch(/from\s+["']@\//);
      expect(src).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    });
  }
  it("police Manrope", () => {
    const src = readFileSync(SOURCES[1], "utf8");
    expect(src).toMatch(/PILE_CSS|Manrope/);
    expect(src).toMatch(/chargerManrope/);
    expect(src).not.toMatch(/Montserrat/);
  });
});
