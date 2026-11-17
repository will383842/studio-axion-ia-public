import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import type { EmpreinteVideo, ResultatGarde } from "@/briques/variete-commune/types";
import { STYLES_TABLEAU } from "@/briques/tableau-scene/trois-styles/styles";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import { tirerStyleTableau } from "@/moteurs/montage-tableau/tirage-style";

vi.mock("server-only", () => ({}));
import { stylesTableauAEviterCommun } from "@/services/variete-commune/styles-tableau-commun";
import type { GardeCommune } from "@/services/variete-commune/refus";

const LE = "2026-11-17T10:00:00.000Z";
const emp = (videoId: string): EmpreinteVideo => ({ version: "1", videoId, formatId: "tableau", le: LE, axes: {} });
const verdict = (ok: boolean): ResultatGarde => ({ ok, score: ok ? 0 : 1, axesCommuns: [], phrase: "" });
const base = (v: unknown, extra: Record<string, unknown> = {}) => ({
  videoId: "v1",
  reseaux: ["r1"],
  le: LE,
  lire: async () => v,
  garde: (() => verdict(true)) as GardeCommune,
  lireVoisines: async () => [emp("a")],
  ...extra,
});

describe("stylesTableauAEviterCommun (X2-12b-b-a)", () => {
  beforeEach(() => void vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it.each([["absent", undefined], ["false", false], ['"true"', "true"]])("éteint (%s) → undefined, rien d'appelé", async (_n, v) => {
    const lireVoisines = vi.fn(async () => [emp("a")]);
    const garde = vi.fn<GardeCommune>(() => verdict(false));
    expect(await stylesTableauAEviterCommun(base(v, { lireVoisines, garde }))).toBeUndefined();
    expect(lireVoisines).not.toHaveBeenCalled();
    expect(garde).not.toHaveBeenCalled();
  });

  it("éteint : une seule lecture", async () => {
    const lire = vi.fn(async () => false);
    await stylesTableauAEviterCommun(base(false, { lire }));
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it("allumé, une voisine, refus de l'habillage ardoise → [\"ardoise\"]", async () => {
    const ardoise = versCommun("tableau", "habillage", "ardoise");
    const garde: GardeCommune = (e) => verdict(!e.axes.habillage?.includes(ardoise));
    expect(await stylesTableauAEviterCommun(base(true, { garde }))).toEqual(["ardoise"]);
  });

  it("allumé, tout refusé → les 3 styles dans l'ordre ; le moteur rend quand même un style", async () => {
    const liste = await stylesTableauAEviterCommun(base(true, { garde: () => verdict(false) }));
    expect(liste).toEqual([...STYLES_TABLEAU]);
    expect(STYLES_TABLEAU).toContain(tirerStyleTableau("v1", [], liste));
  });

  it("allumé, voisines vides → []", async () => {
    expect(await stylesTableauAEviterCommun(base(true, { lireVoisines: async () => [], garde: () => verdict(false) }))).toEqual([]);
  });

  it("lireVoisines qui lève → []", async () => {
    const lireVoisines = async () => { throw new Error("boum"); };
    expect(await stylesTableauAEviterCommun(base(true, { lireVoisines, garde: () => verdict(false) }))).toEqual([]);
  });

  it("garde qui lève → aucun style évité", async () => {
    const garde: GardeCommune = () => { throw new Error("boum"); };
    expect(await stylesTableauAEviterCommun(base(true, { garde }))).toEqual([]);
  });

  it("refusCommunPour qui lève (lecture du réglage impossible) → jamais bloquant", async () => {
    const lire = async () => { throw new Error("base coupée"); };
    await expect(stylesTableauAEviterCommun(base(true, { lire }))).resolves.toBeUndefined();
  });

  it("garde statique : aucun import interdit", () => {
    const src = readFileSync("src/services/variete-commune/styles-tableau-commun.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*import\b/.test(l)).join("\n");
    for (const interdit of ["fabrication", "publications", "reglages", "travaux", "image-video", "tableau-creation", "plafond"]) {
      expect(imports).not.toContain(interdit);
    }
  });
});
