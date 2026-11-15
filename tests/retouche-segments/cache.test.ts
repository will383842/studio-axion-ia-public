import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { etatCacheScenes, type PortsCacheScenes } from "@/services/retouche-segments/cache";

const versions = [
  { id: "v1", projetMontage: { retoucheChat: { rendu: { fichierCle: "rendus/a.mp4" } } } },
  { id: "v2", projetMontage: { retoucheChat: { rendu: { fichierCle: "rendus/b.mp4", scenes: { s1: { fichierCle: "rendus/c.mp4" } } } } } },
  { id: "v3" },
];
const objets = [
  { cle: "rendus/a.mp4", octets: 100 },
  { cle: "rendus/b.mp4", octets: 200 },
  { cle: "rendus/c.mp4", octets: 300 },
  { cle: "rendus/x.mp4", octets: 400 },
  { cle: "rendus/y.mp4", octets: 500 },
];
const ports: PortsCacheScenes = { lireVersions: async () => versions, listerObjets: async () => objets };

describe("etatCacheScenes", () => {
  it("totaux exacts, liberables = somme des non référencés", async () => {
    const e = await etatCacheScenes("vid", ports, "rendus/");
    expect(e && "octetsTotal" in e).toBe(true);
    if (!e || !("octetsTotal" in e)) return;
    expect(e.octetsTotal).toBe(1500);
    expect(e.objets.filter((o) => !o.referencee).map((o) => o.cle)).toEqual(["rendus/x.mp4", "rendus/y.mp4"]);
    expect(e.octetsLiberables).toBe(900);
  });
  it("clé d'une ancienne version : référencée", async () => {
    const e = await etatCacheScenes("vid", ports, "rendus/");
    if (!e || !("objets" in e)) throw new Error("null");
    const a = e.objets.find((o) => o.cle === "rendus/a.mp4")!;
    expect(a.referencee).toBe(true);
    expect(a.versions).toEqual(["v1"]);
  });
  it("port en panne : null + raison, sans exception", async () => {
    const r = await etatCacheScenes("vid", { ...ports, listerObjets: async () => { throw new Error("R2 down"); } }, "rendus/");
    expect(r).toEqual({ etat: null, raison: expect.stringContaining("R2 down") });
    const r2 = await etatCacheScenes("vid", { ...ports, lireVersions: async () => { throw new Error("base"); } }, "p/");
    expect(r2.etat).toBeNull();
  });
  it("garde statique : lecture seule", () => {
    const src = readFileSync("src/services/retouche-segments/cache.ts", "utf8");
    expect(src).not.toMatch(/supprimer|delete|effacer/i);
    expect(src).not.toMatch(/fournisseurs\/stockage/);
  });
});
