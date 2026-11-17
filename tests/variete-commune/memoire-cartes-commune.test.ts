import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EmpreinteVideo } from "@/briques/variete-commune/types";

vi.mock("server-only", () => ({}));
import { memoireCartesCommune } from "@/services/variete-commune/memoire-cartes-commune";

const emp = (videoId: string, le: string, objets: string[] = []): EmpreinteVideo => ({ version: "1", videoId, formatId: "f", le, axes: { objets } });
const lireAllume = (v: unknown) => async () => v;
const memoire = () => ({ dejaServis: ["a"], ouverturePrecedente: "question" });

describe("memoireCartesCommune (X2-13b-a)", () => {
  beforeEach(() => void vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it.each([["absent", undefined], ["false", false], ['"true"', "true"]])("réglage %s → même référence, voisines jamais lues", async (_n, v) => {
    const m = memoire();
    const lireVoisines = vi.fn(async () => [emp("x", "2026-11-01", ["autre:cartes:chiffre"])]);
    expect(await memoireCartesCommune({ memoire: m, reseaux: ["linkedin"], lire: lireAllume(v), lireVoisines })).toBe(m);
    expect(lireVoisines).not.toHaveBeenCalled();
  });

  it("éteint : une seule lecture (celle du réglage)", async () => {
    const lire = vi.fn(async () => false);
    await memoireCartesCommune({ memoire: memoire(), reseaux: ["linkedin"], lire });
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it("lecture du réglage en échec → même référence", async () => {
    const m = memoire();
    const lire = async () => { throw new Error("boum"); };
    expect(await memoireCartesCommune({ memoire: m, reseaux: ["linkedin"], lire })).toBe(m);
  });

  it("allumé et aucun réseau → même référence", async () => {
    const m = memoire();
    const lireVoisines = vi.fn(async () => []);
    expect(await memoireCartesCommune({ memoire: m, reseaux: [], lire: lireAllume(true), lireVoisines })).toBe(m);
    expect(lireVoisines).not.toHaveBeenCalled();
  });

  it("allumé : la carte d'une voisine avocat sur LinkedIn entre dans dejaServis", async () => {
    const lireVoisines = vi.fn(async () => [emp("v1", "2026-11-02", ["autre:cartes:chiffre"])]);
    const r = await memoireCartesCommune({ memoire: memoire(), reseaux: ["linkedin"], lire: lireAllume(true), lireVoisines });
    expect(r.dejaServis).toEqual(["a", "chiffre"]);
    expect(r.ouverturePrecedente).toBe("question");
  });

  it("2 réseaux : les deux lus, vidéo présente sur les deux comptée une fois, fenêtre et prêtes transmises", async () => {
    const par: Record<string, EmpreinteVideo[]> = {
      linkedin: [emp("v1", "2026-11-02", ["autre:cartes:chiffre"])],
      facebook: [emp("v1", "2026-11-02", ["autre:cartes:chiffre"]), emp("v2", "2026-11-01", ["autre:cartes:liste"])],
    };
    const lireVoisines = vi.fn(async (d: { reseau: string }) => par[d.reseau]);
    const r = await memoireCartesCommune({ memoire: memoire(), reseaux: ["linkedin", "facebook"], videoIdEnCours: "en-cours", lire: lireAllume(true), lireVoisines });
    expect(r.dejaServis).toEqual(["a", "chiffre", "liste"]);
    expect(lireVoisines).toHaveBeenCalledTimes(2);
    expect(lireVoisines).toHaveBeenCalledWith({ reseau: "linkedin", videoIdEnCours: "en-cours", fenetre: 10, pretesNonPubliees: true });
    expect(lireVoisines).toHaveBeenCalledWith({ reseau: "facebook", videoIdEnCours: "en-cours", fenetre: 10, pretesNonPubliees: true });
  });

  it("lireVoisines qui lève → mémoire d'entrée rendue, avertissement [studio]", async () => {
    const m = memoire();
    const lireVoisines = vi.fn(async () => { throw new Error("illisible"); });
    expect(await memoireCartesCommune({ memoire: m, reseaux: ["linkedin"], lire: lireAllume(true), lireVoisines })).toBe(m);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("[studio]"), "illisible");
  });

  it("l'entrée n'est jamais modifiée", async () => {
    const m = memoire();
    const copie = structuredClone(m);
    const lireVoisines = async () => [emp("v1", "2026-11-02", ["autre:cartes:chiffre"])];
    await memoireCartesCommune({ memoire: m, reseaux: ["linkedin"], lire: lireAllume(true), lireVoisines });
    expect(m).toEqual(copie);
  });
});
