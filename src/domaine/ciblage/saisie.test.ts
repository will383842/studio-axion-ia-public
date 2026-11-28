import { describe, it, expect } from "vitest";
import { ciblageSaisieValide, typeAutomatisationValide } from "./saisie";
import { TYPES_AUTOMATISATION } from "./types";

describe("ciblageSaisieValide", () => {
  it("refuse une entrée absente ou non objet", () => {
    expect(ciblageSaisieValide(undefined)).toBeUndefined();
    expect(ciblageSaisieValide(null)).toBeUndefined();
    expect(ciblageSaisieValide("plombier")).toBeUndefined();
  });

  it("refuse un niveau inconnu", () => {
    expect(ciblageSaisieValide({ niveau: "planete", libelle: "plombier" })).toBeUndefined();
  });

  it("refuse un libellé invalide (vide, trop long, plusieurs lignes)", () => {
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "   " })).toBeUndefined();
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "x".repeat(81) })).toBeUndefined();
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "plombier\nélectricien" })).toBeUndefined();
    expect(ciblageSaisieValide({ niveau: "metier", libelle: 42 })).toBeUndefined();
  });

  it("accepte un libellé valide, le rogne et marque l'origine « saisie »", () => {
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "  plombier  " })).toEqual({
      niveau: "metier",
      libelle: "plombier",
      origine: "saisie",
    });
    expect(ciblageSaisieValide({ niveau: "taille", libelle: "PME" })).toEqual({
      niveau: "taille",
      libelle: "PME",
      origine: "saisie",
    });
  });
});

describe("typeAutomatisationValide", () => {
  it("refuse un type inconnu", () => {
    expect(typeAutomatisationValide("type-inexistant")).toBeUndefined();
    expect(typeAutomatisationValide(undefined)).toBeUndefined();
    expect(typeAutomatisationValide(null)).toBeUndefined();
    expect(typeAutomatisationValide(123)).toBeUndefined();
  });

  it("accepte chaque identifiant de TYPES_AUTOMATISATION", () => {
    for (const { id } of TYPES_AUTOMATISATION) {
      expect(typeAutomatisationValide(id)).toBe(id);
    }
  });
});
