import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { blocHistoriqueV4 } from "@/moteurs/montage-facecam-animee/realisateur/consignes";

vi.mock("server-only", () => ({}));
import { ouverturesVoisinesCommunes } from "@/services/variete-commune/ouvertures-voisines-communes";

const emp = (videoId: string, le: string, ouverture: string[]): EmpreinteVideo => ({ version: "1", videoId, formatId: "f", le, axes: { ouverture } });
const lireAllume = (v: unknown) => async () => v;

describe("ouverturesVoisinesCommunes (X2-14b-b-a)", () => {
  beforeEach(() => void vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it.each([["absent", undefined], ["false", false], ['"true"', "true"]])("réglage %s → undefined, voisines jamais lues", async (_n, v) => {
    const lireVoisines = vi.fn(async () => [emp("x", "2026-11-01", ["question"])]);
    expect(await ouverturesVoisinesCommunes({ reseaux: ["linkedin"], lire: lireAllume(v), lireVoisines })).toBeUndefined();
    expect(lireVoisines).not.toHaveBeenCalled();
  });

  it("éteint : une seule lecture (celle du réglage)", async () => {
    const lire = vi.fn(async () => false);
    await ouverturesVoisinesCommunes({ reseaux: ["linkedin"], lire });
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it("allumé et aucun réseau → undefined, voisines non lues", async () => {
    const lireVoisines = vi.fn(async () => []);
    expect(await ouverturesVoisinesCommunes({ reseaux: [], lire: lireAllume(true), lireVoisines })).toBeUndefined();
    expect(lireVoisines).not.toHaveBeenCalled();
  });

  it("2 réseaux, vidéo commune comptée une fois, 3 ouvertures au plus, les plus récentes d'abord, sans neutres ni autre:*", async () => {
    const commune = emp("v1", "2026-11-05", ["question"]);
    const par: Record<string, EmpreinteVideo[]> = {
      linkedin: [emp("v0", "2026-11-01", ["horloge"]), commune, emp("v2", "2026-11-03", ["autre:truc"])],
      instagram: [{ ...commune, le: "2026-11-04" }, emp("v3", "2026-11-02", ["affiche"]), emp("v4", "2026-11-06", ["chiffre-geant"]), emp("v5", "2026-11-07", ["inconnu"])],
    };
    const lireVoisines = vi.fn(async (d: { reseau: string }) => par[d.reseau] ?? []);
    const r = await ouverturesVoisinesCommunes({ reseaux: ["linkedin", "instagram"], videoIdEnCours: "en-cours", lire: lireAllume(true), lireVoisines });
    expect(lireVoisines).toHaveBeenCalledTimes(2);
    expect(lireVoisines).toHaveBeenCalledWith({ reseau: "linkedin", videoIdEnCours: "en-cours", fenetre: 10, pretesNonPubliees: true });
    // tri : v5 (inconnu, sans mot) > v4 > v1 > v2 (autre:) > v3 ; max 3 voisines → v5, v4, v1
    expect(r).toEqual(["un chiffre géant", "une question"]);
    const r6 = await ouverturesVoisinesCommunes({ reseaux: ["linkedin", "instagram"], lire: lireAllume(true), lireVoisines, max: 6 });
    expect(r6).toEqual(["un chiffre géant", "une question", "une affiche", "une horloge"]);
    expect(r6?.filter((m) => m === "une question")).toHaveLength(1);
  });

  it("lecture des voisines en échec → undefined", async () => {
    const lireVoisines = vi.fn(async () => { throw new Error("boum"); });
    expect(await ouverturesVoisinesCommunes({ reseaux: ["linkedin"], lire: lireAllume(true), lireVoisines })).toBeUndefined();
  });

  it("bout à bout : allumé → « ouvrez autrement » une fois ; undefined → identique à master", async () => {
    const lireVoisines = vi.fn(async () => [emp("v1", "2026-11-02", ["question"])]);
    const o = await ouverturesVoisinesCommunes({ reseaux: ["linkedin"], lire: lireAllume(true), lireVoisines });
    const texte = blocHistoriqueV4([], [], o);
    expect(texte.split("ouvrez autrement")).toHaveLength(2);
    expect(blocHistoriqueV4([], [], undefined)).toBe(blocHistoriqueV4([], []));
    expect(blocHistoriqueV4([], [], undefined)).toBe("");
  });

  it("garde statique : aucun import interdit", () => {
    const src = readFileSync(join(resolve(__dirname, "..", ".."), "src/services/variete-commune/ouvertures-voisines-communes.ts"), "utf8");
    for (const interdit of ["@/services/facecam-animee", "motion-v4", "fabrication", "publications", "reglages", "travaux"]) {
      const imports = src.match(/from\s+["'][^"']+["']/g) ?? [];
      expect(imports.filter((i) => i.includes(interdit))).toEqual([]);
    }
  });
});
