/** L5-07 · la sonde de publication ne s'ajoute plus au temps de la base dans /api/sante (parallèle, délai propre, sans effet sur ok). */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/donnees/memoire", async (orig) => {
  const m = await orig<typeof import("@/donnees/memoire")>();
  return { ...m, sonderBase: () => new Promise<"ok">((r) => setTimeout(() => r("ok"), 450)) };
});

const { etatSante, DELAI_SONDE_PUBLICATION_MS } = await import("@/services/sante");

describe("L5-07 · /api/sante : sonde de publication en parallèle", () => {
  it("base lente (450 ms) + sonde qui ne répond jamais : durée totale ≈ max, pas la somme ; ok et état de base inchangés", async () => {
    const debut = Date.now();
    const e = await etatSante(600, { sonde: () => new Promise(() => undefined) });
    const duree = Date.now() - debut;
    expect(e.ok).toBe(true);
    expect(e.base).toBe("ok");
    expect(e.publication).toBe("inconnu");
    // En série ce serait ≥ 600 + 450 ms ; en parallèle la sonde coupe à son propre délai pendant que la base répond.
    expect(duree).toBeLessThan(900);
    expect(DELAI_SONDE_PUBLICATION_MS).toBeLessThanOrEqual(1000);
  });
  it("sonde qui répond : le champ est rempli, sans effet sur ok", async () => {
    const e = await etatSante(600, { sonde: async () => ({ etat: "a-verifier" as const }) });
    expect(e.publication).toBe("a-verifier");
    expect(e.ok).toBe(true);
  });
  it("sonde qui échoue : « inconnu », ok inchangé", async () => {
    const e = await etatSante(600, { sonde: async () => { throw new Error("x"); } });
    expect(e.publication).toBe("inconnu");
    expect(e.ok).toBe(true);
  });
});
