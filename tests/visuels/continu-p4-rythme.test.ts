import { describe, expect, it } from "vitest";
import type { DefinitionGabarit, FamilleContinu, RoleGabarit } from "../../src/briques/visuels/continu/registre-gabarits";
import { controlesStructureToile } from "../../src/domaine/controles-visuel/rythme-continu";

/** Gabarit fictif : le registre de production est rempli par les lots P3, la règle se teste sans lui. */
function g(type: string, famille: FamilleContinu, role: RoleGabarit = "contenu", options: Partial<DefinitionGabarit> = {}): DefinitionGabarit {
  return { type, famille, nom: type, role, sombre: false, orangeFort: false, version: 1, schema: undefined as never, exemple: {}, bordsLibres: { gauche: [], droite: [] }, actif: true, ...options };
}
const REGISTRE = [
  g("C01", "couverture", "couverture"),
  g("L01", "liste"),
  g("L02", "liste"),
  g("K01", "comparaison"),
  g("K02", "comparaison", "contenu", { sombre: true }),
  g("K03", "comparaison", "contenu", { orangeFort: true }),
  g("S01", "cas", "contenu", { cas: true }),
  g("S02", "cas", "contenu", { cas: true }),
  g("S03", "cas", "contenu", { cas: true }),
  g("D01", "donnees", "contenu", { exigeFait: true, actif: false }),
  g("D02", "donnees", "contenu", { exigeAccord: true, actif: false }),
  g("D03", "donnees", "contenu", { actif: false }),
  g("A01", "appel", "appel", { sombre: true }),
  g("A02", "appel", "relance", { orangeFort: true }),
  g("PA1", "parcours"),
  g("PA2", "parcours"),
  g("PA3", "parcours"),
];
const toile = (...types: string[]) => ({ pages: types.map((type) => ({ type })) });
const codes = (...types: string[]) => controlesStructureToile(toile(...types), REGISTRE).map((c) => `${c.code}:${c.niveau}`);

describe("continu P4 : structure de la toile (rythme-continu)", () => {
  it("une toile variée est verte", () => {
    expect(codes("C01", "L01", "K01", "S01", "A01")).toEqual([]);
  });
  it("deux pages « liste » à la suite : rouge, sur la seconde", () => {
    const r = controlesStructureToile(toile("C01", "L01", "L02", "A01"), REGISTRE);
    expect(r.map((c) => `${c.code}:${c.niveau}`)).toEqual(["FAMILLE_SUITE:rouge"]);
    expect(r[0].page).toBe(3);
  });
  it("les pages d'un parcours se suivent sans faute", () => {
    expect(codes("C01", "PA1", "PA2", "PA3", "K01", "A01")).toEqual([]);
  });
  it("D01 (exige un fait), D02 (exige un accord), un gabarit éteint : rouges", () => {
    expect(codes("C01", "D01", "L01", "A01")).toContain("GABARIT_FAIT:rouge");
    expect(codes("C01", "D02", "L01", "A01")).toContain("GABARIT_ACCORD:rouge");
    expect(codes("C01", "D03", "L01", "A01")).toContain("GABARIT_ETEINT:rouge");
  });
  it("plus de 2 pages de cas, plus d'une page orange fort, plus d'une page sombre : rouges", () => {
    expect(codes("C01", "S01", "L01", "S02", "K01", "S03", "A01")).toContain("CAS_MAX:rouge");
    expect(codes("C01", "S01", "L01", "S02", "A01")).not.toContain("CAS_MAX:rouge");
    expect(codes("C01", "K03", "L01", "A02")).toContain("ORANGE_FORT_MAX:rouge");
    expect(codes("C01", "K02", "L01", "A01")).toContain("SOMBRE_MAX:rouge");
  });
  it("moins de 3 familles pour 5 pages ou plus : orange", () => {
    expect(codes("C01", "L01", "C01", "L02", "C01")).toContain("VARIETE:orange");
    expect(codes("C01", "L01", "A01")).toEqual([]);
  });
  it("un type inconnu du registre est laissé au schéma", () => {
    expect(codes("C01", "ZZ9", "A01")).toEqual([]);
  });
});
