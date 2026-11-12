import { describe, expect, it, vi } from "vitest";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { controlerToile } from "../../src/domaine/controles-visuel/porte-continu";
import type { ContextePorte } from "../../src/domaine/visuels/contrats";

// Le registre de production n'a pas encore de plaquette sombre (lots P3) : deux contenus d'essai le deviennent ici.
vi.mock("../../src/briques/visuels/continu/familles/essai", async (importOriginal) => {
  const { ESSAI } = await importOriginal<typeof import("../../src/briques/visuels/continu/familles/essai")>();
  return { ESSAI: ESSAI.map((g) => (g.type === "X05" || g.type === "X06" ? { ...g, sombre: true } : g)) };
});

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: false };
const exemple = (type: string): Record<string, unknown> & { type: string } => ({ ...GABARITS.find((x) => x.type === type)!.exemple, type });
const toile = (...pages: Record<string, unknown>[]) => ({ version: "toile/1", format: "4:5", pages, raccords: [] as unknown[] });
const schemas = (spec: unknown) => controlerToile(spec, ctx).rapport.controles.filter((c) => c.code === "SCHEMA");

describe("continu P4 : porte de la toile, schéma page par page", () => {
  it("page 1 qui n'est pas une couverture : rouge SCHEMA, page 1", () => {
    const r = controlerToile(toile(exemple("X01"), exemple("X03"), exemple("X02")), ctx).rapport;
    expect(r.verdict).toBe("rouge");
    expect(schemas(toile(exemple("X01"), exemple("X03"), exemple("X02"))).map((c) => c.page)).toEqual([1]);
  });
  it("dernière page qui n'est pas un appel : rouge SCHEMA, page 4", () => {
    expect(schemas(toile(exemple("X00"), exemple("X01"), exemple("X02"), exemple("X03"))).map((c) => c.page)).toEqual([4]);
  });
  it("deux pages sombres : rouge SCHEMA sur la seconde (page 4)", () => {
    const s = schemas(toile(exemple("X00"), exemple("X05"), exemple("X01"), exemple("X06"), exemple("X02")));
    expect(s.map((c) => c.page)).toEqual([4]);
    expect(s[0].phrase).toMatch(/sombre/);
  });
  it("rubrique de 29 caractères : rouge SCHEMA, page 2", () => {
    const rubrique = "a".repeat(29);
    expect(rubrique).toHaveLength(29);
    const s = schemas(toile(exemple("X00"), { ...exemple("X01"), rubrique }, exemple("X02")));
    expect(s.map((c) => c.page)).toEqual([2]);
    expect(schemas(toile(exemple("X00"), { ...exemple("X01"), rubrique: "a".repeat(28) }, exemple("X02")))).toEqual([]);
  });
});
