import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONTRASTE_AFFICHE_MIN,
  CONTRASTE_TEXTE_DUO_MIN,
  COULEURS_DUO,
  COUPLES_AFFICHE_DUO,
  COUPLES_TEXTE_DUO,
  FONDS,
  POLICES_DUO,
  TAILLE_PLANCHER_DUO,
  TAILLES_DUO,
  VERSION_CHARTE_DUO,
} from "../../../src/briques/habillage/charte-duo";
import { COULEURS_VIDEO, VERSION_CHARTE_VIDEO } from "../../../src/briques/habillage/charte-video";
import { rapportContraste } from "../../../src/briques/habillage/contraste";
import { trouverDroit } from "../../../src/briques/droits";

describe("charte-duo/1", () => {
  it("est versionnée et reprend les valeurs exactes de la vidéo 1", () => {
    expect(VERSION_CHARTE_DUO).toBe("charte-duo/1");
    expect(COULEURS_DUO).toEqual({
      nuit: "#110A05",
      nuitHaut: "#2A150B",
      nuitLueur: "#7A3418",
      ivoire: "#F4EFE7",
      ivoireHaut: "#FBF8F3",
      encre: "#15100C",
      orange: "#C2532A",
      orangeVif: "#F0703C",
      gris: "#8A7C6E",
      grisClair: "#C9B8A6",
      vert: "#22A55B",
      blanc: "#FFFFFF",
    });
    expect(TAILLES_DUO).toEqual({ geant: 0.375, affiche: 0.12, titre: 0.099, ligne: 0.022, etiquette: 0.0146, marque: 0.0188 });
    expect(TAILLE_PLANCHER_DUO).toBe(0.03);
  });

  it("est figée (objets gelés, à tous les niveaux)", () => {
    for (const o of [COULEURS_DUO, FONDS, FONDS.sombre, FONDS.ivoire, POLICES_DUO, POLICES_DUO.affiche, POLICES_DUO.texte, TAILLES_DUO, COUPLES_TEXTE_DUO, COUPLES_AFFICHE_DUO]) {
      expect(Object.isFrozen(o)).toBe(true);
    }
    for (const c of [...COUPLES_TEXTE_DUO, ...COUPLES_AFFICHE_DUO]) expect(Object.isFrozen(c)).toBe(true);
  });

  it("les deux fonds ne désignent que des couleurs de la charte", () => {
    const valeurs = Object.values(COULEURS_DUO);
    for (const fond of [FONDS.sombre, FONDS.ivoire]) {
      for (const k of ["fond", "texte", "accent", "secondaire"] as const) expect(valeurs).toContain(fond[k]);
    }
    expect(FONDS.sombre.fond).toBe(COULEURS_DUO.nuit);
    expect(FONDS.sombre.accent).toBe(COULEURS_DUO.orangeVif);
    expect(FONDS.ivoire.fond).toBe(COULEURS_DUO.ivoire);
    expect(FONDS.ivoire.accent).toBe(COULEURS_DUO.orange);
  });

  it("chaque couple (texte, fond) atteint son seuil", () => {
    expect(CONTRASTE_TEXTE_DUO_MIN).toBe(7);
    expect(CONTRASTE_AFFICHE_MIN).toBe(3);
    expect(COUPLES_TEXTE_DUO.length).toBeGreaterThan(0);
    expect(COUPLES_AFFICHE_DUO.length).toBeGreaterThan(0);
    for (const { texte, fond } of COUPLES_TEXTE_DUO) {
      expect(rapportContraste(COULEURS_DUO[texte], COULEURS_DUO[fond]), `${texte}/${fond}`).toBeGreaterThanOrEqual(CONTRASTE_TEXTE_DUO_MIN);
    }
    for (const { texte, fond } of COUPLES_AFFICHE_DUO) {
      expect(rapportContraste(COULEURS_DUO[texte], COULEURS_DUO[fond]), `${texte}/${fond}`).toBeGreaterThanOrEqual(CONTRASTE_AFFICHE_MIN);
    }
  });

  it("un texte d'affiche à seuil réduit mesure au moins 5 % de la hauteur", () => {
    expect(TAILLES_DUO.geant).toBeGreaterThanOrEqual(0.05);
    expect(TAILLES_DUO.affiche).toBeGreaterThanOrEqual(0.05);
    expect(TAILLES_DUO.titre).toBeGreaterThanOrEqual(0.05);
  });

  it("le plancher de 3 % vaut pour tout texte porteur de sens sauf étiquette et marque", () => {
    for (const k of Object.keys(TAILLES_DUO) as (keyof typeof TAILLES_DUO)[]) {
      if (k === "etiquette" || k === "marque" || k === "ligne") continue;
      expect(TAILLES_DUO[k]).toBeGreaterThanOrEqual(TAILLE_PLANCHER_DUO);
    }
  });

  it("les polices sont celles de la vidéo 1 et ont une entrée de droits", () => {
    expect(POLICES_DUO.affiche.famille).toBe("Axion Anton");
    expect(POLICES_DUO.texte.famille).toBe("Axion Inter Bold");
    expect(trouverDroit(POLICES_DUO.affiche.droit)?.type).toBe("police");
    expect(trouverDroit(POLICES_DUO.texte.droit)?.type).toBe("police");
  });

  it("charte-video/1 garde ses valeurs d'aujourd'hui", () => {
    expect(VERSION_CHARTE_VIDEO).toBe("charte-video/1");
    expect(COULEURS_VIDEO).toEqual({ page: "#E9DCC8", ecriture: "#110A05", soulignement: "#B44F29", sable: "#BFA88B" });
  });

  it("ne dépend d'aucun alias « @/ » ni d'aucun module (lisible par studio-rendu)", () => {
    const src = readFileSync(new URL("../../../src/briques/habillage/charte-duo.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/^import\s/m);
  });
});
