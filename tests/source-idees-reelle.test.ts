/**
 * Adaptateur SourceIdees réel (fiche L6-03) — tout en doublure locale, aucun appel réel (ni réseau ni Usine).
 * Test autonome : il n'importe rien de tests/helpers/.
 */
import { describe, expect, it, vi } from "vitest";
import { sourceIdeesReelle } from "@/services/source-idees-reelle";
import type { CombinaisonUsine } from "@/services/source-idees";

function faux(n: number, depart = 0): CombinaisonUsine[] {
  return Array.from({ length: n }, (_, i) => ({
    signature: `essai-${depart + i}`,
    parts: { metier: String(i) },
    textes: { metier: "artisan fictif", douleur: `douleur fictive ${depart + i}` },
  }));
}

describe("sourceIdeesReelle", () => {
  it("inactif : simulee:true et la porte n'est jamais appelée", async () => {
    const porte = vi.fn(async (n: number) => faux(n));
    const source = sourceIdeesReelle({ actif: false, porte });
    expect(source.simulee).toBe(true);
    const r = await source.tirer(30);
    expect(r).toHaveLength(30);
    expect(porte).not.toHaveBeenCalled();
  });

  it("actif sans porte : reste simulée (rien d'appelé)", async () => {
    const source = sourceIdeesReelle({ actif: true });
    expect(source.simulee).toBe(true);
  });

  it("actif : simulee:false et 30 combinaisons demandées et rendues", async () => {
    const porte = vi.fn(async (n: number) => faux(n));
    const source = sourceIdeesReelle({ actif: true, porte });
    expect(source.simulee).toBe(false);
    const r = await source.tirer(30);
    expect(porte).toHaveBeenCalledTimes(1);
    expect(porte).toHaveBeenCalledWith(30);
    expect(r).toHaveLength(30);
    expect(new Set(r.map((c) => c.signature)).size).toBe(30);
  });

  it("écarte les doublons et les entrées invalides, ne dépasse pas n", async () => {
    const mauvaises = [
      { signature: "", parts: {}, textes: { a: "x" } },
      { signature: "sans-textes", parts: {} },
      null,
      ...faux(3),
      ...faux(3),
    ] as unknown as CombinaisonUsine[];
    const source = sourceIdeesReelle({ actif: true, porte: async () => mauvaises });
    expect(await source.tirer(2)).toHaveLength(2);
    expect(await source.tirer(30)).toHaveLength(3);
  });

  it("n <= 0 : rien, sans appeler la porte", async () => {
    const porte = vi.fn(async () => faux(5));
    const source = sourceIdeesReelle({ actif: true, porte });
    expect(await source.tirer(0)).toEqual([]);
    expect(porte).not.toHaveBeenCalled();
  });

  it("la porte en échec : liste vide, jamais d'exception ni de fausse idée", async () => {
    const source = sourceIdeesReelle({ actif: true, porte: async () => { throw new Error("hors service fictif"); } });
    expect(await source.tirer(30)).toEqual([]);
  });

  it("correction après relecture : parts et textes mal formés sont écartés", async () => {
    const bons = faux(1, 100);
    const mauvais: unknown[] = [
      { signature: "m1", parts: [], textes: { metier: "x" } },
      { signature: "m2", parts: { metier: 42 }, textes: { metier: "x" } },
      { signature: "m3", parts: { metier: "a" }, textes: { metier: "x", douleur: {} } },
      { signature: "m4", parts: { metier: "a" }, textes: { metier: "x", taille: 3 } },
      { signature: "m5", parts: { metier: "a" }, textes: ["x"] },
    ];
    const source = sourceIdeesReelle({ actif: true, porte: async () => [...mauvais, ...bons, { signature: "ok-null", parts: { metier: null }, textes: { metier: "x" } }] });
    const r = await source.tirer(30);
    expect(r.map((c) => c.signature)).toEqual(["essai-100", "ok-null"]);
  });

  it("correction après relecture : doublon jugé après trim", async () => {
    const un = { parts: {}, textes: { metier: "x" } };
    const source = sourceIdeesReelle({ actif: true, porte: async () => [{ ...un, signature: "a" }, { ...un, signature: "a " }] });
    expect(await source.tirer(5)).toHaveLength(1);
  });

  it("correction après relecture : tirer(2.5) demande 2 à la porte", async () => {
    const porte = vi.fn(async (n: number) => faux(n));
    const source = sourceIdeesReelle({ actif: true, porte });
    await source.tirer(2.5);
    expect(porte).toHaveBeenCalledWith(2);
    expect(await source.tirer(0.5)).toEqual([]);
  });
});
