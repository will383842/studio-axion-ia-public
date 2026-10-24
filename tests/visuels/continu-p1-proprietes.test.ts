import { describe, expect, it } from "vitest";
import { validerProprietesToile } from "../../src/domaine/visuels/continu/proprietes-toile";
import { VERSION_TOILE_SOCLE } from "../../src/domaine/visuels/continu/version";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";

const ex = (type: string) => GABARITS.find((g) => g.type === type)!.exemple;
const toile = () => ({ format: "4:5", pages: [ex("X00"), ex("X01"), ex("X02")], raccords: [] });
const versions = () => ({ socle: VERSION_TOILE_SOCLE, gabarits: Object.fromEntries(GABARITS.map((g) => [g.type, g.version])) });

describe("continu P1 : propriétés de la toile", () => {
  it("accepte des propriétés cohérentes", () => {
    const r = validerProprietesToile({ toile: toile(), versions: versions() });
    expect(r.toile.pages).toHaveLength(3);
    expect(r.versions.socle).toBe(VERSION_TOILE_SOCLE);
  });
  it("refuse un socle différent", () => {
    expect(() => validerProprietesToile({ toile: toile(), versions: { ...versions(), socle: "toile-continue/99" } })).toThrow(/^Version de toile/);
  });
  it("refuse une version de gabarit différente", () => {
    const v = versions();
    v.gabarits.X00 = 99;
    expect(() => validerProprietesToile({ toile: toile(), versions: v })).toThrow(/^Version de toile/);
  });
  it("refuse une clé inconnue", () => {
    expect(() => validerProprietesToile({ toile: toile(), versions: versions(), autre: 1 })).toThrow();
  });
});
