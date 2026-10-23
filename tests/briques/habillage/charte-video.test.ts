import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BANDE_SOUS_TITRES_HAUTEUR,
  CONTRASTE_MARQUE_MIN,
  CONTRASTE_TEXTE_MIN,
  COULEURS_VIDEO,
  COUPLES_MARQUES,
  COUPLES_TEXTE,
  EPAISSEURS_VIDEO,
  POLICES_VIDEO,
  ROLES_TEXTE,
  TAILLE_PLANCHER_VIDEO,
  TAILLES_VIDEO,
  VERSION_CHARTE_VIDEO,
  tailleVideoPx,
} from "../../../src/briques/habillage/charte-video";
import { rapportContraste, versRvb } from "../../../src/briques/habillage/contraste";
import { POLICE_MOTION, VERSION_CHARTE_MOTION } from "../../../src/briques/motion/jetons";

describe("charte-video/1", () => {
  it("est versionnée et reprend les valeurs décidées par Will", () => {
    expect(VERSION_CHARTE_VIDEO).toBe("charte-video/1");
    expect(COULEURS_VIDEO).toEqual({ page: "#E9DCC8", ecriture: "#110A05", soulignement: "#B44F29", sable: "#BFA88B" });
  });

  it("est figée (objets gelés)", () => {
    for (const o of [COULEURS_VIDEO, POLICES_VIDEO, TAILLES_VIDEO, EPAISSEURS_VIDEO, ROLES_TEXTE, COUPLES_TEXTE, COUPLES_MARQUES]) {
      expect(Object.isFrozen(o)).toBe(true);
    }
  });

  it("les jetons de face caméra ne changent pas", () => {
    expect(VERSION_CHARTE_MOTION).toBe("motion-1");
  });

  it("ne dépend d'aucun alias « @/ » ni d'aucun module (lisible par studio-rendu)", () => {
    for (const f of ["charte-video.ts", "contraste.ts"]) {
      const src = readFileSync(new URL(`../../../src/briques/habillage/${f}`, import.meta.url), "utf8");
      expect(src).not.toMatch(/from\s+["']@\//);
      expect(src).not.toMatch(/^import\s/m);
    }
  });

  it("la fonction de contraste est exacte", () => {
    expect(rapportContraste("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(rapportContraste("#FFF", "#fff")).toBeCloseTo(1, 5);
    expect(rapportContraste("#E9DCC8", "#110A05")).toBeCloseTo(rapportContraste("#110A05", "#E9DCC8"), 10);
    expect(versRvb("#abc")).toEqual([170, 187, 204]);
    expect(() => versRvb("orange")).toThrow();
  });

  it("tout couple texte/fond atteint 7:1", () => {
    expect(COUPLES_TEXTE.length).toBeGreaterThan(0);
    for (const { texte, fond } of COUPLES_TEXTE) {
      expect(rapportContraste(COULEURS_VIDEO[texte], COULEURS_VIDEO[fond])).toBeGreaterThanOrEqual(CONTRASTE_TEXTE_MIN);
    }
  });

  it("toute marque atteint 3:1 sur la page", () => {
    expect(COUPLES_MARQUES.length).toBeGreaterThan(0);
    for (const { marque, fond } of COUPLES_MARQUES) {
      expect(rapportContraste(COULEURS_VIDEO[marque], COULEURS_VIDEO[fond])).toBeGreaterThanOrEqual(CONTRASTE_MARQUE_MIN);
    }
  });

  it("l'orange n'est jamais une couleur de texte", () => {
    const orange = COULEURS_VIDEO.soulignement.toLowerCase();
    expect(ROLES_TEXTE).not.toContain("soulignement");
    for (const role of ROLES_TEXTE) expect(COULEURS_VIDEO[role].toLowerCase()).not.toBe(orange);
    for (const { texte } of COUPLES_TEXTE) {
      expect(texte).not.toBe("soulignement");
      expect(COULEURS_VIDEO[texte].toLowerCase()).not.toBe(orange);
    }
  });

  it("l'orange comme texte échouerait au contraste 7:1 (le garde-fou est utile)", () => {
    expect(rapportContraste(COULEURS_VIDEO.soulignement, COULEURS_VIDEO.page)).toBeLessThan(CONTRASTE_TEXTE_MIN);
  });

  it("taille minimale du texte : 3 % de la hauteur, jamais en dessous", () => {
    expect(TAILLE_PLANCHER_VIDEO).toBe(0.03);
    for (const v of Object.values(TAILLES_VIDEO)) expect(v).toBeGreaterThanOrEqual(TAILLE_PLANCHER_VIDEO);
    expect(tailleVideoPx("legende", 1920)).toBeGreaterThanOrEqual(Math.round(0.03 * 1920));
    expect(BANDE_SOUS_TITRES_HAUTEUR).toBeGreaterThan(0);
    expect(BANDE_SOUS_TITRES_HAUTEUR).toBeLessThan(0.3);
  });

  it("les polices sont celles du dépôt (Montserrat ExtraBold pour les titres)", () => {
    expect(POLICES_VIDEO.titre.voulue).toBe("Montserrat ExtraBold");
    expect(POLICES_VIDEO.titre.presente).toBe(true);
    expect(POLICES_VIDEO.titre.famille).toBe("Axion Montserrat ExtraBold");
    expect(POLICES_VIDEO.titre.famille).not.toBe(POLICE_MOTION);
    expect(POLICES_VIDEO.texte.famille).toBe("Axion Inter Bold");
    const polices = readFileSync(new URL("../../../studio-rendu/compositions/commune/polices.ts", import.meta.url), "utf8");
    expect(polices).toContain(`"${POLICES_VIDEO.texte.famille}"`);
    expect(polices).toContain(`"${POLICES_VIDEO.titre.famille}"`);
    expect(polices).toContain("Montserrat-ExtraBold.ttf");
  });
});
