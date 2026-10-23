/** K5 : « Proposez-moi un cas restant » (pur) et filtres de l'écran de choix. */
import { describe, expect, it } from "vitest";
import { correspondAuxFiltres, filtrerCas, groupesDepuisCas, piocherCas, type CasPiochable } from "@/components/formats/cas-concret/entree/piocher";
import { LIBELLES_SECTEURS, libelleSecteur, TAILLES_FILTRE } from "@/components/formats/cas-concret/stock/filtres-stock";
import { TAILLES_STOCK } from "@/formats/cas-concret/stock-metiers/schema";

const cas = (id: string, o: { fiche?: string; secteur?: string; taille?: string; traite?: boolean; valide?: boolean; offre?: CasPiochable["offre"] }): CasPiochable => ({
  id,
  offre: o.offre ?? "integration",
  valide: o.valide ?? true,
  stock: { traite: o.traite ?? false, ...(o.fiche ? { fiche: o.fiche } : {}), ...(o.secteur ? { secteur: o.secteur } : {}), ...(o.taille ? { taille: o.taille } : {}) },
});

describe("piocherCas", () => {
  const valides = [
    cas("c10", { fiche: "IN-10", secteur: "IN", taille: "PME" }),
    cas("c02", { fiche: "IN-02", secteur: "IN", taille: "TPE" }),
    cas("c01", { fiche: "IN-01", secteur: "IN", taille: "PME", traite: true }),
    cas("b01", { fiche: "BT-01", secteur: "BT", taille: "PME", offre: "audit" }),
  ];

  it("prend le premier cas validé non traité, dans l'ordre des numéros de fiche (IN-02 avant IN-10)", () => {
    expect(piocherCas(valides, [], {})?.cas.id).toBe("b01");
    expect(piocherCas(valides, [], { secteur: "IN" })).toEqual({ cas: valides[1], essai: false });
  });

  it("est déterministe : même entrée, même sortie, sans aucun hasard", () => {
    const a = piocherCas(valides, [], { secteur: "IN" });
    for (let i = 0; i < 5; i++) expect(piocherCas([...valides].reverse(), [], { secteur: "IN" })).toEqual(a);
  });

  it("respecte les filtres combinés et ignore le filtre d'état", () => {
    expect(piocherCas(valides, [], { secteur: "IN", taille: "PME" })?.cas.id).toBe("c10");
    expect(piocherCas(valides, [], { offre: "audit" })?.cas.id).toBe("b01");
    expect(piocherCas(valides, [], { secteur: "IN", etat: "traite" })?.cas.id).toBe("c02");
  });

  it("à défaut de cas validé restant, propose le premier cas à valider, en essai", () => {
    const aValider = [cas("v2", { fiche: "IN-05", secteur: "IN", valide: false }), cas("v1", { fiche: "IN-04", secteur: "IN", valide: false })];
    expect(piocherCas([valides[2]!], aValider, { secteur: "IN" })).toEqual({ cas: aValider[1], essai: true });
  });

  it("ne propose jamais un cas déjà traité ; rien de restant : null", () => {
    expect(piocherCas([valides[2]!], [cas("t", { fiche: "IN-09", secteur: "IN", valide: false, traite: true })], {})).toBeNull();
    expect(piocherCas(valides, [], { secteur: "ZZ" })).toBeNull();
    expect(piocherCas([], [], {})).toBeNull();
  });

  it("un cas traité (allé au bout ou en cours) n'est jamais proposé, même seul restant du filtre", () => {
    const traites = [cas("t1", { fiche: "IN-01", secteur: "IN", traite: true }), cas("t2", { fiche: "IN-02", secteur: "IN", traite: true })];
    expect(piocherCas(traites, traites, { secteur: "IN" })).toBeNull();
    expect(piocherCas([...traites, cas("libre", { fiche: "IN-09", secteur: "IN" })], [], { secteur: "IN" })?.cas.id).toBe("libre");
  });

  it("met après les fiches les cas sans fiche (catalogue d'avant), dans leur ordre", () => {
    const vieux = [cas("v-a", {}), cas("v-b", {})];
    expect(piocherCas([...vieux, valides[0]!], [], {})?.cas.id).toBe("c10");
    expect(piocherCas(vieux, [], {})?.cas.id).toBe("v-a");
  });
});

describe("filtres de l'écran de choix", () => {
  it("un cas sans rangement ne passe aucun filtre de secteur ou de taille", () => {
    const vieux = cas("v", {});
    expect(correspondAuxFiltres(vieux, { secteur: "IN" })).toBe(false);
    expect(correspondAuxFiltres(vieux, { taille: "PME" })).toBe(false);
    expect(correspondAuxFiltres(vieux, {})).toBe(true);
  });
  it("l'état suit le traitement et la validation", () => {
    const l = [cas("a", { traite: true }), cas("b", { valide: false }), cas("c", {})];
    expect(filtrerCas(l, { etat: "restant" }).map((c) => c.id)).toEqual(["b", "c"]);
    expect(filtrerCas(l, { etat: "traite" }).map((c) => c.id)).toEqual(["a"]);
    expect(filtrerCas(l, { etat: "a-valider" }).map((c) => c.id)).toEqual(["b"]);
    expect(filtrerCas(l, { etat: "valide" }).map((c) => c.id)).toEqual(["a", "c"]);
  });
  it("les groupes ne proposent que ce qui existe", () => {
    const g = groupesDepuisCas([cas("a", { secteur: "IN", taille: "PME" })]);
    expect(g.find((x) => x.cle === "secteur")?.options.map((o) => o.valeur)).toEqual(["IN"]);
    expect(g.find((x) => x.cle === "taille")?.options.map((o) => o.valeur)).toEqual(["PME"]);
  });
  it("l'écran de choix n'a pas de groupe d'offre (les pastilles d'offre font foi)", () => {
    const g = groupesDepuisCas([cas("a", { secteur: "IN", taille: "PME", offre: "audit" })]);
    expect(g.map((x) => x.cle)).toEqual(["secteur", "taille", "etat"]);
  });
  it("la pastille d'offre se passe au tirage : « audit » propose un cas audit", () => {
    const l = [cas("i1", { fiche: "IN-01", secteur: "IN" }), cas("a1", { fiche: "IN-02", secteur: "IN", offre: "audit" })];
    expect(piocherCas(l, [], { offre: "audit" })?.cas.id).toBe("a1");
    expect(piocherCas(l, [], {})?.cas.id).toBe("i1");
  });
  it("les secteurs ont un libellé lisible (le code reste la valeur), trié sur le libellé", () => {
    for (const code of ["IN", "LT", "NB", "BT", "AS", "DG"]) {
      expect(LIBELLES_SECTEURS[code], code).toBeTruthy();
    }
    expect(libelleSecteur("ZZ")).toBe("ZZ");
    const g = groupesDepuisCas([cas("a", { secteur: "IN" }), cas("b", { secteur: "BT" })]);
    expect(g.find((x) => x.cle === "secteur")?.options).toEqual([{ valeur: "BT", libelle: "Bâtiment" }, { valeur: "IN", libelle: "Industrie" }]);
  });
  it("les tailles du filtre restent celles du rangement", () => {
    expect([...TAILLES_FILTRE]).toEqual([...TAILLES_STOCK]);
  });
});
