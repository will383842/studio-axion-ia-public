import { readFileSync } from "node:fs";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AXES_COMMUNS, type EmpreinteVideo, type ResultatGarde } from "@/briques/variete-commune/types";

vi.mock("server-only", () => ({}));
import { refusCommunPour, type GardeCommune } from "@/services/variete-commune/refus";

const emp = (videoId: string, valeur: string): EmpreinteVideo => ({
  version: "empreinte/1",
  videoId,
  formatId: "f",
  le: "2026-11-10T08:00:00.000Z",
  axes: Object.fromEntries(AXES_COMMUNS.map((a) => [a, [valeur]])),
});
const lireAllume = (v: unknown) => async () => v;

describe("refusCommunPour : garde par défaut verifier (X2-10b)", () => {
  beforeEach(() => void vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it.each([["absent", undefined], ["false", false], ['"true"', "true"]])("éteint (%s), sans garde → undefined, aucune lecture des voisines", async (_n, v) => {
    const lireVoisines = vi.fn(async () => [emp("a", "x")]);
    expect(await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(v), lireVoisines })).toBeUndefined();
    expect(lireVoisines).not.toHaveBeenCalled();
  });

  it("allumé, sans garde, voisine identique → refus avec phrase", async () => {
    const lireVoisines = vi.fn(async () => [emp("a", "x")]);
    const f = await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(true), lireVoisines });
    const r = f!(emp("v", "x"));
    expect(r.ok).toBe(false);
    expect(r.phrase.length).toBeGreaterThan(0);
  });

  it("allumé, sans garde, voisines différentes → accepté", async () => {
    const lireVoisines = vi.fn(async () => [emp("a", "y"), emp("b", "z")]);
    const f = await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(true), lireVoisines });
    expect(f!(emp("v", "x")).ok).toBe(true);
  });

  it("garde fournie → c'est elle qui est appelée, pas verifier", async () => {
    const rendu: ResultatGarde = { ok: false, score: 0.99, voisine: "a", axesCommuns: [], phrase: "espion" };
    const garde = vi.fn<GardeCommune>(() => rendu);
    const lireVoisines = vi.fn(async () => [emp("a", "y")]);
    const f = await refusCommunPour({ videoId: "v", reseaux: ["r1"], lire: lireAllume(true), garde, lireVoisines });
    expect(f!(emp("v", "x"))).toEqual(rendu);
    expect(garde).toHaveBeenCalledTimes(1);
  });

  it("garde statique : refus.ts n'importe ni publications, ni image-video, ni fabrication, ni reglages, ni travaux", () => {
    const src = readFileSync("src/services/variete-commune/refus.ts", "utf8");
    const imports = [...src.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)].map((m) => m[1]);
    expect(imports).toContain("@/briques/variete-commune/garde");
    for (const i of imports) expect(i).not.toMatch(/publications|image-video|fabrication|reglages|travaux/);
  });
});
