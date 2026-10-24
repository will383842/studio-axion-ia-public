import { describe, expect, it } from "vitest";
import { GABARITS, GABARITS_PRODUCTION } from "../../src/briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../src/briques/visuels/continu/registre-parcours";
import { RUBRIQUE_MAX } from "../../src/domaine/visuels/continu/geometrie";
import { RACCORDS } from "../../src/briques/visuels/continu/registre-raccords";

const FAMILLES = ["couverture", "liste", "comparaison", "cas", "donnees", "appel", "parcours", "essai"];

describe("continu P1 : registres", () => {
  it("chaque gabarit a un schéma strict dont l'exemple passe", () => {
    expect(GABARITS.length).toBeGreaterThan(0);
    for (const g of GABARITS) {
      expect(g.schema.safeParse(g.exemple).success, g.type).toBe(true);
      expect(g.schema.safeParse({ ...(g.exemple as object), inconnue: 1 }).success, g.type).toBe(false);
      expect((g.exemple as { type: string }).type).toBe(g.type);
    }
  });
  it("types uniques, familles connues", () => {
    const types = GABARITS.map((g) => g.type);
    expect(new Set(types).size).toBe(types.length);
    for (const g of GABARITS) expect(FAMILLES, g.type).toContain(g.famille);
  });
  it("X00 et PX sont exclus de la production", () => {
    const prod = GABARITS_PRODUCTION.map((g) => g.type);
    for (const t of ["X00", "PX1", "PX2", "PX3"]) expect(prod).not.toContain(t);
    expect(PARCOURS.find((p) => p.id === "PX")?.pagesTypes).toEqual(["PX1", "PX2", "PX3"]);
  });
  it("parcours.sombres est cohérent avec gabarit.sombre de chaque page", () => {
    for (const p of PARCOURS) {
      p.pagesTypes.forEach((t, j) => {
        const g = GABARITS.find((x) => x.type === t);
        expect(g, t).toBeDefined();
        expect(p.sombres.includes(j), `${p.id} page ${j + 1}`).toBe(g!.sombre);
      });
    }
  });
  it("la rubrique de chaque gabarit d'essai est bornée à RUBRIQUE_MAX", () => {
    for (const g of GABARITS.filter((x) => x.essai)) {
      const base = g.exemple as Record<string, unknown>;
      expect(g.schema.safeParse({ ...base, rubrique: "a".repeat(RUBRIQUE_MAX) }).success, g.type).toBe(true);
      expect(g.schema.safeParse({ ...base, rubrique: "a".repeat(RUBRIQUE_MAX + 1) }).success, g.type).toBe(false);
    }
    expect(RUBRIQUE_MAX).toBe(28);
  });
  it("trois raccords R01 à R03", () => {
    expect(RACCORDS.map((r) => r.type)).toEqual(["R01", "R02", "R03"]);
  });
});
