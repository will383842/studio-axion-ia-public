/**
 * T-COURBES-MOTION-v20g — tests directs de `dureeRessort`, `lineaire`, `deplacementObturateur`, `flouDeplacement`.
 * Aucun code du Studio touché.
 */
import { describe, expect, it } from "vitest";
import { deplacementObturateur, dureeRessort, flouDeplacement, lineaire, ressort } from "../../../src/briques/motion/courbes";
import { DUREES } from "../../../src/briques/motion/jetons";

describe("lineaire", () => {
  it("renvoie 0 avant le début, 1 après la fin, et la fraction entre les deux", () => {
    expect(lineaire(0.5, 1, 2)).toBe(0);
    expect(lineaire(1, 1, 2)).toBe(0);
    expect(lineaire(2, 1, 2)).toBe(0.5);
    expect(lineaire(3, 1, 2)).toBe(1);
    expect(lineaire(10, 1, 2)).toBe(1);
  });
  it("durée nulle ou négative : saut net à `debut`", () => {
    expect(lineaire(0.99, 1, 0)).toBe(0);
    expect(lineaire(1, 1, 0)).toBe(1);
    expect(lineaire(5, 1, -3)).toBe(1);
    expect(lineaire(0, 1, -3)).toBe(0);
  });
});

describe("deplacementObturateur", () => {
  it("fonction linéaire de pente 100 px/s : déplacement = 100 × obturateur", () => {
    expect(deplacementObturateur((t) => 100 * t, 1)).toBeCloseTo(100 * DUREES.obturateur, 10);
    expect(deplacementObturateur((t) => 100 * t, 1)).toBeCloseTo(2, 10);
  });
  it("grandeur immobile : 0 ; recul : négatif ; appelle f en t et t − obturateur", () => {
    expect(deplacementObturateur(() => 42, 3)).toBe(0);
    expect(deplacementObturateur((t) => -50 * t, 2)).toBeCloseTo(-1, 10);
    const vus: number[] = [];
    deplacementObturateur((t) => (vus.push(t), t), 1);
    expect(vus).toEqual([1, 1 - 1 / 50]);
  });
});

describe("flouDeplacement", () => {
  it("écart-type = moitié du déplacement (valeur absolue)", () => {
    expect(flouDeplacement(10)).toBe(5);
    expect(flouDeplacement(-10)).toBe(5);
  });
  it("sous 0,35 px de flou : 0 ; pile à la limite : conservé", () => {
    expect(flouDeplacement(0)).toBe(0);
    expect(flouDeplacement(0.6)).toBe(0);
    expect(flouDeplacement(0.7)).toBe(0.35);
  });
  it("plafonné à 28 par défaut, ou au plafond donné", () => {
    expect(flouDeplacement(56)).toBe(28);
    expect(flouDeplacement(1000)).toBe(28);
    expect(flouDeplacement(1000, 10)).toBe(10);
    expect(flouDeplacement(8, 10)).toBe(4);
  });
});

describe("dureeRessort", () => {
  it("valeurs exactes par ressort", () => {
    expect(dureeRessort("chute")).toBe(VALEURS.chute);
    expect(dureeRessort()).toBe(dureeRessort("chute"));
    expect(dureeRessort("souple")).toBe(VALEURS.souple);
    expect(dureeRessort("ferme")).toBe(VALEURS.ferme);
  });
  it("le ressort reste à moins de 0,2 % de sa cible après cette durée", () => {
    for (const nom of ["chute", "souple", "ferme"] as const) {
      const d = dureeRessort(nom);
      expect(d).toBeGreaterThan(0.05);
      expect(d).toBeLessThan(4);
      for (let u = d; u < d + 0.6; u += 0.02) expect(Math.abs(1 - ressort(u, nom))).toBeLessThanOrEqual(0.002);
    }
  });
});

const VALEURS = { chute: 0.59, souple: 0.78, ferme: 0.52 };
