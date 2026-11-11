import { describe, expect, it } from "vitest";
import { publicDepuisCible } from "@/components/formats/tableau-anime/ciblage-saisie";

describe("tableau animé : écran, cible → champ public", () => {
  it("préremplit le champ public avec le libellé", () => {
    expect(publicDepuisCible("metier", "Plombiers")).toEqual({ public: "Plombiers", ciblage: { niveau: "metier", libelle: "Plombiers", origine: "saisie" } });
  });
  it("valeur vide : pas de ciblage et public inchangé", () => {
    expect(publicDepuisCible("secteur", "  ")).toEqual({ public: undefined, ciblage: undefined });
  });
  it("libellé trop long : pas de ciblage", () => {
    expect(publicDepuisCible("metier", "x".repeat(81)).ciblage).toBeUndefined();
  });
});
