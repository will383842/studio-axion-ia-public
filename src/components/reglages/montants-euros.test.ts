import { describe, expect, it } from "vitest";
import { champEuros, dollarsVersEuros, eurosVersDollars, lireSaisieEuros, TAUX_EUR_PAR_USD, tauxValide, texteEuros } from "./montants-euros";

describe("montants en euros (Réglages)", () => {
  it("le taux par défaut est celui du réglage existant", () => {
    expect(TAUX_EUR_PAR_USD).toBe(0.9);
    expect(tauxValide(undefined)).toBe(0.9);
    expect(tauxValide(0)).toBe(0.9);
    expect(tauxValide(Number.NaN)).toBe(0.9);
    expect(tauxValide(0.92)).toBe(0.92);
  });
  it("aller-retour dollars → euros → dollars au centime", () => {
    for (const taux of [0.9, 0.92, 0.8571]) {
      for (const d of [0.28, 1, 20, 200, 999.99]) {
        const e = dollarsVersEuros(d, taux);
        expect(Math.abs(eurosVersDollars(e, taux) - d)).toBeLessThan(0.0101);
      }
    }
    expect(eurosVersDollars(dollarsVersEuros(200, 0.9), 0.9)).toBe(200);
  });
  it("arrondit au centime", () => {
    expect(dollarsVersEuros(0.28, 0.9)).toBe(0.25);
    expect(eurosVersDollars(20, 0.92)).toBe(21.74);
  });
  it("lit la saisie française", () => {
    expect(lireSaisieEuros("20")).toBe(20);
    expect(lireSaisieEuros("20,5")).toBe(20.5);
    expect(lireSaisieEuros("1 200,50 €")).toBe(1200.5);
    expect(lireSaisieEuros("")).toBeNaN();
    expect(lireSaisieEuros("abc")).toBeNaN();
    expect(lireSaisieEuros("1,2,3")).toBeNaN();
  });
  it("formate en français", () => {
    expect(champEuros(180)).toBe("180");
    expect(champEuros(180.5)).toBe("180,5");
    expect(texteEuros(0.28, 0.9)).toMatch(/^0,25\s€$/);
  });
});
