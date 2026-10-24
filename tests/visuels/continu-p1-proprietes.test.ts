import { describe, expect, it } from "vitest";
import { validerProprietesToile } from "../../src/domaine/visuels/continu/proprietes-toile";
import { VERSION_TOILE_SOCLE } from "../../src/domaine/visuels/continu/version";
import { GABARITS } from "../../src/briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../src/briques/visuels/continu/registre-parcours";
import { RACCORDS } from "../../src/briques/visuels/continu/registre-raccords";

const ex = (type: string) => GABARITS.find((g) => g.type === type)!.exemple;
const toile = () => ({ version: "toile/1", format: "4:5", pages: [ex("X00"), ex("X01"), ex("X02")], raccords: [{ type: "R02", couture: 1, y: 600 }] });
const versions = () => ({
  socle: VERSION_TOILE_SOCLE,
  gabarits: Object.fromEntries(GABARITS.map((g) => [g.type, g.version])),
  parcours: Object.fromEntries(PARCOURS.map((p) => [p.id, p.version])),
  raccords: Object.fromEntries(RACCORDS.map((r) => [r.type, r.version])),
});

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
  it("refuse des gabarits vides ou absents : « Version de toile absente : gabarit X00 »", () => {
    expect(() => validerProprietesToile({ toile: toile(), versions: { ...versions(), gabarits: {} } })).toThrow(/^Version de toile absente : gabarit X00/);
    const { gabarits: _g, ...sans } = versions();
    expect(() => validerProprietesToile({ toile: toile(), versions: sans })).toThrow(/^Version de toile/);
  });
  it("refuse des gabarits qui ne sont pas un objet simple", () => {
    expect(() => validerProprietesToile({ toile: toile(), versions: { ...versions(), gabarits: [] } })).toThrow(/^Version de toile/);
    expect(() => validerProprietesToile({ toile: toile(), versions: { ...versions(), gabarits: null } })).toThrow(/^Version de toile/);
  });
  it("exige la version de chaque raccord utilisé", () => {
    const v = versions();
    v.raccords = {};
    expect(() => validerProprietesToile({ toile: toile(), versions: v })).toThrow(/^Version de toile absente : raccord R02/);
    const faux = versions();
    faux.raccords.R02 = 99;
    expect(() => validerProprietesToile({ toile: toile(), versions: faux })).toThrow(/^Version de toile/);
  });
  it("exige la version de chaque parcours utilisé", () => {
    const px = { ...toile(), raccords: [], pages: [ex("X00"), ex("PX1"), ex("PX2"), ex("PX3"), ex("X02")] };
    const v = versions();
    v.parcours = {};
    expect(() => validerProprietesToile({ toile: px, versions: v })).toThrow(/^Version de toile absente : parcours PX/);
    const faux = versions();
    faux.parcours.PX = 99;
    expect(() => validerProprietesToile({ toile: px, versions: faux })).toThrow(/^Version de toile/);
    expect(validerProprietesToile({ toile: px, versions: versions() }).toile.pages).toHaveLength(5);
  });
  it("refuse une clé inconnue", () => {
    expect(() => validerProprietesToile({ toile: toile(), versions: versions(), autre: 1 })).toThrow();
  });
});
