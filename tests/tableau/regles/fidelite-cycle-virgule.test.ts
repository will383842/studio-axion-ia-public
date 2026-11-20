import { describe, expect, it } from "vitest";
// Le PREMIER import est volontairement `controles-gabarit` : il doit se charger seul (boucle d'import cassée).
import { REMPLISSAGE_MIN_GABARIT } from "@/moteurs/montage-tableau/controles-gabarit";
import { cleMot as cleMotCle } from "@/moteurs/montage-tableau/cle-mot";
import { cleMot as cleMotFiche } from "@/moteurs/montage-tableau/fiche";
import { valeurNombre } from "@/moteurs/montage-tableau/fidelite-texte";

describe("FIX-FIDELITE-CYCLE-v20f", () => {
  it("a) controles-gabarit se charge en premier sans plantage", () => {
    expect(REMPLISSAGE_MIN_GABARIT).toBe(0.75);
  });
  it("b) les nombres à virgule ou à point sont lus entiers", () => {
    expect(valeurNombre("3,5")).toBe(3.5);
    expect(valeurNombre("3.5")).toBe(3.5);
  });
  it("c) le reste est inchangé", () => {
    expect(valeurNombre("10")).toBe(10);
    expect(valeurNombre("dix")).toBe(10);
    expect(valeurNombre("bonjour")).toBeUndefined();
  });
  it("d) cleMot : même fonction depuis fiche et cle-mot, même sortie", () => {
    expect(cleMotFiche).toBe(cleMotCle);
    expect(["Éléphant", "D'abord", "Où", "ÇA", "naïve"].map(cleMotCle)).toEqual(["elephant", "dabord", "ou", "ca", "naive"]);
  });
});
