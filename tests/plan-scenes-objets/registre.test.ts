import { describe, expect, it } from "vitest";
import { OBJETS_INSCRITS, REGISTRE_OBJETS, definitionObjet, idsObjets } from "../../src/briques/plan-scenes-objets/registre";

const entrees = Object.entries(REGISTRE_OBJETS);

describe("registre des petits objets (C9-27a)", () => {
  it("identifiants uniques", () => {
    const ids = OBJETS_INSCRITS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(REGISTRE_OBJETS).length).toBe(OBJETS_INSCRITS.length);
  });
  it("la clé est l'id de la définition", () => {
    for (const [cle, d] of entrees) expect(cle).toBe(d.id);
  });
  it("aucune capacité hors objet.*", () => {
    for (const [, d] of entrees) expect(d.capacite.startsWith("objet.")).toBe(true);
  });
  it("au moins une entrée par famille livrée sur master", () => {
    const familles = new Set(entrees.map(([, d]) => d.famille));
    for (const f of ["trait", "marque", "etiquette", "chiffre", "schema", "ecran"]) expect(familles.has(f as never)).toBe(true);
  });
  it("gelé", () => {
    expect(Object.isFrozen(REGISTRE_OBJETS)).toBe(true);
  });
  it("definitionObjet et idsObjets", () => {
    expect(definitionObjet("objet-coche")?.id).toBe("objet-coche");
    expect(definitionObjet("objet-inconnu")).toBeUndefined();
    expect(definitionObjet("constructor" as never)).toBeUndefined();
    const ids = idsObjets();
    expect(ids).toEqual([...ids].sort());
    expect(ids.length).toBe(entrees.length);
  });
});
