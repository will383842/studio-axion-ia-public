import { describe, expect, it } from "vitest";
import { ciblageSaisieValide, typeAutomatisationValide } from "./saisie";
import { LONGUEUR_MAX_LIBELLE } from "./types";

describe("ciblageSaisieValide", () => {
  it("accepte un niveau connu et un libellé valide, rogné, avec l'origine « saisie »", () => {
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "  Plombier  " })).toEqual({ niveau: "metier", libelle: "Plombier", origine: "saisie" });
    expect(ciblageSaisieValide({ niveau: "secteur", libelle: "Bâtiment" })?.niveau).toBe("secteur");
    expect(ciblageSaisieValide({ niveau: "taille", libelle: "TPE" })?.niveau).toBe("taille");
  });

  it("impose l'origine « saisie » même si l'entrée en annonce une autre", () => {
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "Plombier", origine: "auto" })?.origine).toBe("saisie");
  });

  it("renvoie undefined pour un niveau inconnu ou absent", () => {
    expect(ciblageSaisieValide({ niveau: "inconnu", libelle: "Plombier" })).toBeUndefined();
    expect(ciblageSaisieValide({ libelle: "Plombier" })).toBeUndefined();
  });

  it("renvoie undefined pour un libellé invalide : vide, espaces, trop long, multi-lignes, non texte", () => {
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "" })).toBeUndefined();
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "   " })).toBeUndefined();
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "x".repeat(LONGUEUR_MAX_LIBELLE + 1) })).toBeUndefined();
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "ligne 1\nligne 2" })).toBeUndefined();
    expect(ciblageSaisieValide({ niveau: "metier", libelle: 12 })).toBeUndefined();
    expect(ciblageSaisieValide({ niveau: "metier" })).toBeUndefined();
  });

  it("accepte un libellé de la longueur maximale", () => {
    expect(ciblageSaisieValide({ niveau: "metier", libelle: "x".repeat(LONGUEUR_MAX_LIBELLE) })?.libelle).toHaveLength(LONGUEUR_MAX_LIBELLE);
  });

  it("renvoie undefined pour null, undefined ou un non-objet", () => {
    expect(ciblageSaisieValide(null)).toBeUndefined();
    expect(ciblageSaisieValide(undefined)).toBeUndefined();
    expect(ciblageSaisieValide("metier")).toBeUndefined();
  });
});

describe("typeAutomatisationValide", () => {
  it("renvoie l'identifiant d'un type connu", () => {
    expect(typeAutomatisationValide("devis-factures")).toBe("devis-factures");
    expect(typeAutomatisationValide("recrutement")).toBe("recrutement");
  });

  it("renvoie undefined pour un type inconnu ou un non-texte", () => {
    expect(typeAutomatisationValide("n-importe-quoi")).toBeUndefined();
    expect(typeAutomatisationValide("")).toBeUndefined();
    expect(typeAutomatisationValide(null)).toBeUndefined();
    expect(typeAutomatisationValide(undefined)).toBeUndefined();
    expect(typeAutomatisationValide(3)).toBeUndefined();
  });
});
