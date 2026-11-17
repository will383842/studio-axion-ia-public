import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EmpreinteVideo, ResultatGarde, Voisine } from "@/briques/variete-commune/types";

vi.mock("server-only", () => ({}));
import { refusCommunPour, type GardeCommune } from "@/services/variete-commune/refus";

const emp = (videoId: string): EmpreinteVideo => ({ version: "1", videoId, formatId: "f", le: "2026-11-01T00:00:00Z", axes: {} });
const ok = (): ResultatGarde => ({ ok: true, score: 0.1, axesCommuns: [], phrase: "" });
const lireAllume = (v: unknown) => async () => v;

describe("refusCommunPour (X2-10a)", () => {
  beforeEach(() => void vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it.each([["absent", undefined], ["false", false], ['"true"', "true"]])("réglage %s → undefined, aucune lecture", async (_n, v) => {
    const lireVoisines = vi.fn(async () => [emp("a")]);
    const garde = vi.fn(ok);
    expect(await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(v), garde, lireVoisines })).toBeUndefined();
    expect(lireVoisines).not.toHaveBeenCalled();
    expect(garde).not.toHaveBeenCalled();
  });

  it("éteint : une seule lecture (celle du réglage)", async () => {
    const lire = vi.fn(async () => false);
    await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire, garde: ok });
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it("allumé : la garde refuse une voisine → refus rendu, seuil et rang transmis", async () => {
    const refus: ResultatGarde = { ok: false, score: 0.8, voisine: "a", axesCommuns: ["palette"], phrase: "trop proche" };
    const garde = vi.fn<GardeCommune>(() => refus);
    const lireVoisines = vi.fn(async () => [emp("a"), emp("b")]);
    const f = await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(true), garde, lireVoisines });
    expect(f).toBeTypeOf("function");
    expect(f!(emp("v"))).toEqual(refus);
    const [, voisines, o] = garde.mock.calls[0];
    expect(o.seuil).toBe(0.5);
    expect(voisines.map((x: Voisine) => [x.empreinte.videoId, x.reseau, x.rang])).toEqual([["a", "r1", 0], ["b", "r1", 1]]);
    expect(lireVoisines).toHaveBeenCalledWith({ reseau: "r1", videoIdEnCours: "v", fenetre: 10, pretesNonPubliees: true });
  });

  it("2 réseaux → le pire gagne (refus d'abord, puis score le plus haut)", async () => {
    const parReseau: Record<string, ResultatGarde> = {
      r1: { ok: true, score: 0.4, axesCommuns: [], phrase: "" },
      r2: { ok: false, score: 0.6, voisine: "x", axesCommuns: [], phrase: "refus r2" },
      r3: { ok: false, score: 0.9, voisine: "y", axesCommuns: [], phrase: "refus r3" },
    };
    const garde: GardeCommune = (_e, v) => parReseau[v[0].reseau];
    const lireVoisines = async (d: { reseau: string }) => [emp(d.reseau)];
    const f = await refusCommunPour({ videoId: "v", reseaux: ["r1", "r2"], lire: lireAllume(true), garde, lireVoisines });
    expect(f!(emp("v")).phrase).toBe("refus r2");
    const g = await refusCommunPour({ videoId: "v", reseaux: ["r1", "r2", "r3"], lire: lireAllume(true), garde, lireVoisines });
    expect(g!(emp("v")).phrase).toBe("refus r3");
    const h = await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(true), garde, lireVoisines });
    expect(h!(emp("v")).score).toBe(0.4);
  });

  it("voisines vides → toujours ok, garde non appelée", async () => {
    const garde = vi.fn<GardeCommune>(() => ({ ok: false, score: 1, axesCommuns: [], phrase: "non" }));
    const f = await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(true), garde, lireVoisines: async () => [] });
    expect(f!(emp("v")).ok).toBe(true);
    expect(garde).not.toHaveBeenCalled();
  });

  it("lecture en échec → accepte tout, avec un avertissement", async () => {
    const garde = vi.fn<GardeCommune>(() => ({ ok: false, score: 1, axesCommuns: [], phrase: "non" }));
    const f = await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(true), garde, lireVoisines: async () => { throw new Error("boum"); } });
    expect(f!(emp("v"))).toEqual({ ok: true, score: null, axesCommuns: [], phrase: "" });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(garde).not.toHaveBeenCalled();
  });

  it("voisines lues une seule fois pour 5 appels", async () => {
    const lireVoisines = vi.fn(async () => [emp("a")]);
    const f = await refusCommunPour({ videoId: "v", reseaux: ["r1", "r2"], lire: lireAllume(true), garde: ok, lireVoisines });
    for (let i = 0; i < 5; i++) f!(emp("v"));
    expect(lireVoisines).toHaveBeenCalledTimes(2);
  });
});
