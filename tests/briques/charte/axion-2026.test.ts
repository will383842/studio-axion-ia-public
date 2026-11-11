import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PALETTE,
  POLICE,
  PAIRES_TEXTE,
  autoriserTexte,
  choisirFond,
  contrasteWcag,
  type Fond,
} from "../../../src/briques/charte/axion-2026";

describe("charte Axion 2026 : palette", () => {
  it("contient exactement la palette définitive", () => {
    expect(PALETTE).toEqual({
      ivoire: "#FAF9F5",
      gris: "#E8E6DC",
      noir: "#141413",
      terracotta: "#B23F16",
      orange: "#D97757",
      grisSurNoir: "#B0AEA5",
      reussite: "#5E7050",
      blanc: "#FFFFFF",
      survol: "#8F3412",
      texteSecondaire: "#5E5D59",
      erreurFilet: "#B8341C",
    });
  });
  it("n'a ni bleu ni jaune (teintes 190-260° et 40-70° au-delà de 15 % de saturation HSV)", () => {
    for (const hex of Object.values(PALETTE)) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      const s = max === 0 ? 0 : d / max;
      let h = 0;
      if (d !== 0) {
        if (max === r) h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      if (s > 0.15) {
        expect(h >= 190 && h <= 260, hex).toBe(false);
        expect(h >= 40 && h <= 70, hex).toBe(false);
      }
    }
  });
  it("police : Manrope seule", () => {
    expect(POLICE).toBe("Manrope");
  });
});

describe("charte Axion 2026 : contraste", () => {
  it("toutes les paires de texte autorisées sont à 4,5 ou plus", () => {
    expect(PAIRES_TEXTE.length).toBeGreaterThan(0);
    for (const [texte, fond] of PAIRES_TEXTE) {
      expect(contrasteWcag(texte, fond), `${texte} sur ${fond}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("autoriserTexte accepte les paires de la charte", () => {
    expect(autoriserTexte(PALETTE.noir, PALETTE.ivoire)).toBe(true);
    expect(autoriserTexte(PALETTE.terracotta, PALETTE.ivoire)).toBe(true);
    expect(autoriserTexte(PALETTE.orange, PALETTE.noir)).toBe(true);
    expect(autoriserTexte(PALETTE.grisSurNoir, PALETTE.noir)).toBe(true);
    expect(autoriserTexte(PALETTE.ivoire, PALETTE.noir)).toBe(true);
  });
  it("autoriserTexte refuse orange sur clair, terracotta sur noir et gris #B0AEA5 sur clair", () => {
    expect(autoriserTexte(PALETTE.orange, PALETTE.ivoire)).toBe(false);
    expect(autoriserTexte(PALETTE.orange, PALETTE.gris)).toBe(false);
    expect(autoriserTexte(PALETTE.terracotta, PALETTE.noir)).toBe(false);
    expect(autoriserTexte(PALETTE.grisSurNoir, PALETTE.ivoire)).toBe(false);
    expect(autoriserTexte(PALETTE.grisSurNoir, PALETTE.gris)).toBe(false);
  });
  it("refuse une couleur hors palette", () => {
    expect(autoriserTexte("#123456", PALETTE.ivoire)).toBe(false);
  });
});

describe("choisirFond", () => {
  it("renvoie « clair » après un « sombre », même si « sombre » est voulu", () => {
    expect(choisirFond(3, "sombre", "sombre")).toBe("clair");
  });
  it("respecte le vœu sinon", () => {
    expect(choisirFond(0, null, "sombre")).toBe("sombre");
    expect(choisirFond(1, "clair", "sombre")).toBe("sombre");
    expect(choisirFond(1, "clair", "clair")).toBe("clair");
  });
  it("les 2^10 suites de vœux ne donnent jamais deux « sombre » de suite", () => {
    for (let masque = 0; masque < 1 << 10; masque++) {
      let precedent: Fond | null = null;
      for (let i = 0; i < 10; i++) {
        const voulu: Fond = masque & (1 << i) ? "sombre" : "clair";
        const f = choisirFond(i, precedent, voulu);
        expect(precedent === "sombre" && f === "sombre").toBe(false);
        precedent = f;
      }
    }
  });
});

describe("module pur", () => {
  it("n'a aucun import", () => {
    const src = readFileSync("src/briques/charte/axion-2026.ts", "utf8");
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/require\(/);
    expect(src).toContain("Manrope");
  });
});
