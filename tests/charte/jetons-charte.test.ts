import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COULEURS_CHARTE, COURBES, DUREES, FPS, PALETTE, PILE_CSS, SUR_CLAIR, SUR_SOMBRE, avecOpacite, images } from "../../src/briques/charte/axion-2026";
import { planifierCarteFin } from "../../src/briques/charte/carte-fin";
import { COULEURS, FPS_MOTION, POLICE_MOTION, RESSORTS } from "../../src/briques/motion/jetons";
import { METRIQUES } from "../../src/briques/sous-titres/metriques";
import { GABARITS } from "../../src/briques/sous-titres/style";
import { FAMILLES_POLICES_TABLEAU } from "../../studio-rendu/compositions/commune/polices-tableau";

describe("jetons de la charte Axion 2026 (lot B)", () => {
  it("25 images par seconde, partout dans les jetons", () => {
    expect(FPS).toBe(25);
    expect(FPS_MOTION).toBe(25);
    expect(images(DUREES.normale)).toBe(9);
  });
  it("courbes douces : aucun point de contrôle ne sort de [0 ; 1] (pas de rebond)", () => {
    for (const c of Object.values(COURBES)) for (const y of [c[1], c[3]]) expect(y >= 0 && y <= 1).toBe(true);
  });
  it("ressorts du motion : amortissement critique ou plus (pas de dépassement)", () => {
    for (const r of Object.values(RESSORTS)) expect(r.amortissement).toBeGreaterThanOrEqual(2 * Math.sqrt(r.raideur * r.masse) * 0.99);
  });
  it("les jetons du motion ne prennent que des couleurs de la charte, en Manrope", () => {
    for (const c of Object.values(COULEURS)) expect(COULEURS_CHARTE).toContain(c.toUpperCase());
    expect(POLICE_MOTION).toBe("Axion Manrope");
    expect(PILE_CSS).toContain("Manrope");
    expect(Object.values(FAMILLES_POLICES_TABLEAU)).toEqual(["Axion Manrope", "Axion Manrope", "Axion Manrope"]);
  });
  it("sous-titres : tous les gabarits en Manrope, avec leurs métriques et leur fichier", () => {
    for (const g of Object.values(GABARITS)) {
      expect(g.police.startsWith("Manrope")).toBe(true);
      expect(METRIQUES[g.police].largeurs.length).toBeGreaterThan(100);
    }
    for (const f of ["Manrope-Medium.ttf", "Manrope-ExtraBold.ttf", "Manrope-Variable.ttf", "OFL-Manrope.txt"]) expect(existsSync(`src/briques/sous-titres/polices/${f}`)).toBe(true);
    for (const f of ["Manrope-Variable.ttf", "OFL-Manrope.txt"]) expect(existsSync(`studio-rendu/compositions/commune/polices/${f}`)).toBe(true);
  });
  it("opacité : rgba depuis un hex de la charte", () => {
    expect(avecOpacite(PALETTE.noir, 0.5)).toBe("rgba(20, 20, 19, 0.500)");
  });
  it("carte de fin : page ivoire, UN bloc noir arrondi dans l'image, logo dedans, 25 i/s", () => {
    const p = planifierCarteFin(1080, 1920);
    expect(p.fondPage).toBe(SUR_CLAIR.fond);
    expect(p.carte.fond).toBe(SUR_SOMBRE.fond);
    expect(p.carte.rayon).toBeGreaterThan(0);
    expect(p.carte.x).toBeGreaterThan(0);
    expect(p.carte.x + p.carte.largeur).toBeLessThan(1080);
    expect(p.carte.y).toBeGreaterThan(0);
    expect(p.carte.y + p.carte.hauteur).toBeLessThan(1920);
    expect(p.logo.x).toBeGreaterThanOrEqual(p.carte.x);
    expect(p.logo.x + p.logo.largeur).toBeLessThanOrEqual(p.carte.x + p.carte.largeur);
    expect(p.fps).toBe(25);
    expect(existsSync("studio-rendu/compositions/commune/fin/logo-axion-fond-sombre.png")).toBe(true);
  });
});
