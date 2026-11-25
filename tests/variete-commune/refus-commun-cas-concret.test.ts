import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { versCommun } from "@/briques/variete-commune/vocabulaire";
import { tirer, type Tirage } from "@/moteurs/montage-cas-concret/variete";

vi.mock("server-only", () => ({}));
import { refusCommunCasConcret } from "@/services/variete-commune/refus-commun-cas-concret";
import type { GardeCommune } from "@/services/variete-commune/refus";

const LE = "2026-11-17T10:00:00.000Z";
const OUV = versCommun("cas-concret", "ouverture", "chiffre-choc");
const TIRAGES: Tirage[] = Array.from({ length: 200 }, (_, i) => tirer({ videoId: "v" + i, canaux: [], historique: [] }));
const T_CHIFFRE = TIRAGES.find((t) => t.ouverture === "chiffre-choc")!;
const T_AUTRE = TIRAGES.find((t) => t.ouverture !== "chiffre-choc")!;

const emp = (videoId: string): EmpreinteVideo => ({ version: "1", videoId, formatId: "cas-concret", le: LE, axes: {} });
const refuseChiffre: GardeCommune = (e) =>
  e.axes.ouverture?.includes(OUV) ? { ok: false, score: 0.9, voisine: "a", axesCommuns: ["ouverture"], phrase: "ouverture déjà vue" } : { ok: true, score: 0, axesCommuns: [], phrase: "" };

describe("refusCommunCasConcret (X2-11b-a)", () => {
  beforeEach(() => void vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it.each([["absent", undefined], ["false", false], ['"true"', "true"]])("éteint (%s) → undefined, rien d'appelé, une seule lecture", async (_n, v) => {
    const lire = vi.fn(async () => v);
    const lireVoisines = vi.fn(async () => [emp("a")]);
    const garde = vi.fn(refuseChiffre);
    expect(await refusCommunCasConcret({ videoId: "v", reseaux: ["linkedin"], lire, garde, lireVoisines, le: LE })).toBeUndefined();
    expect(lire).toHaveBeenCalledTimes(1);
    expect(lireVoisines).not.toHaveBeenCalled();
    expect(garde).not.toHaveBeenCalled();
  });

  it("allumé, une voisine : raison pour chiffre-choc, null pour une autre ouverture", async () => {
    const f = await refusCommunCasConcret({ videoId: "v", reseaux: ["linkedin"], lire: async () => true, garde: refuseChiffre, lireVoisines: async () => [emp("a")], le: LE });
    expect(f).toBeTypeOf("function");
    expect(f!(T_CHIFFRE)).toBe("ouverture déjà vue");
    expect(f!(T_AUTRE)).toBeNull();
  });

  it("allumé, voisines vides → null partout, garde jamais appelée", async () => {
    const garde = vi.fn(refuseChiffre);
    const f = await refusCommunCasConcret({ videoId: "v", reseaux: ["linkedin"], lire: async () => true, garde, lireVoisines: async () => [], le: LE });
    expect(f!(T_CHIFFRE)).toBeNull();
    expect(f!(T_AUTRE)).toBeNull();
    expect(garde).not.toHaveBeenCalled();
  });

  it("lireVoisines qui lève → null pour tout tirage", async () => {
    const f = await refusCommunCasConcret({ videoId: "v", reseaux: ["linkedin"], lire: async () => true, garde: refuseChiffre, lireVoisines: async () => { throw new Error("boum"); }, le: LE });
    expect(f!(T_CHIFFRE)).toBeNull();
  });

  it("garde qui lève → null (jamais bloquant)", async () => {
    const garde: GardeCommune = () => { throw new Error("x"); };
    const f = await refusCommunCasConcret({ videoId: "v", reseaux: ["linkedin"], lire: async () => true, garde, lireVoisines: async () => [emp("a")], le: LE });
    expect(f!(T_CHIFFRE)).toBeNull();
  });

  it("refusCommunPour qui lève malgré tout → undefined + un avertissement", async () => {
    const d = { videoId: "v", lire: async () => true, garde: refuseChiffre, le: LE } as unknown as Parameters<typeof refusCommunCasConcret>[0];
    Object.defineProperty(d, "reseaux", { enumerable: true, get() { throw new Error("panne"); } });
    expect(await refusCommunCasConcret(d)).toBeUndefined();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("garde statique : imports interdits absents, un seul importeur hors du dossier (X2-11b-c)", () => {
    const racine = resolve(__dirname, "../..");
    const src = readFileSync(join(racine, "src/services/variete-commune/refus-commun-cas-concret.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*(fabrication|publications|reglages|travaux|image-video)/);
    const parcourir = (d: string): string[] =>
      readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? parcourir(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });
    const importeurs = parcourir(join(racine, "src")).filter((p) => !p.includes("src/services/variete-commune/") && /refus-commun-cas-concret/.test(readFileSync(p, "utf8"))).map((p) => relative(racine, p).replace(/\\/g, "/"));
    expect(importeurs).toEqual(["src/services/cas-concret-variete.ts"]);
  });
});
