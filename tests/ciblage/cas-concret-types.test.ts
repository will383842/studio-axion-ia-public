/** Lot E · types d'automatisation du catalogue du cas concret et champs facultatifs du schéma. */
import { describe, expect, it } from "vitest";
import { TYPES_AUTOMATISATION } from "@/domaine/ciblage/types";
import { CATALOGUE_TS } from "@/formats/cas-concret/catalogue/base";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { schemaCas } from "@/formats/cas-concret/cas";
import { TYPE_PAR_CAS, typeAutomatisationDuCas } from "@/formats/cas-concret/types-catalogue";

const TYPES = new Set<string>(TYPES_AUTOMATISATION.map((t) => t.id));

describe("types-catalogue", () => {
  it("chaque fiche du catalogue d'origine a un type valide, et la table n'a pas d'intrus", () => {
    for (const c of CATALOGUE_TS) expect(TYPES.has(TYPE_PAR_CAS[c.id] ?? ""), c.id).toBe(true);
    expect(Object.keys(TYPE_PAR_CAS).sort()).toEqual(CATALOGUE_TS.map((c) => c.id).sort());
  });
  it("typeAutomatisationDuCas lit la table, sinon le champ du cas, sinon déduit du texte", () => {
    const base = CATALOGUE_TS[0];
    expect(typeAutomatisationDuCas(base)).toBe(TYPE_PAR_CAS[base.id]);
    expect(typeAutomatisationDuCas({ ...base, id: "x-inconnu", typeAutomatisation: "devis-factures" })).toBe("devis-factures");
    for (const c of CATALOGUE) {
      const t = typeAutomatisationDuCas(c);
      expect(t === null || TYPES.has(t), c.id).toBe(true);
    }
  });
  it("le schéma accepte ciblage et type facultatifs, refuse un type inconnu, et les fiches existantes restent valides", () => {
    const cas = CATALOGUE_TS[0];
    expect(schemaCas.safeParse(cas).success).toBe(true);
    const avec = { ...cas, ciblage: { niveau: "metier", libelle: "recruteur", origine: "saisie" }, typeAutomatisation: "recrutement" };
    expect(schemaCas.safeParse(avec).success).toBe(true);
    expect(schemaCas.safeParse({ ...avec, typeAutomatisation: "inconnu" }).success).toBe(false);
    expect(schemaCas.safeParse({ ...avec, ciblage: { niveau: "metier", libelle: "x".repeat(81), origine: "saisie" } }).success).toBe(false);
  });
});
