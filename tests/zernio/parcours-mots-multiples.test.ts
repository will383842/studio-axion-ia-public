/** LIA-A · réglage « plusieurs mots » : éteint par défaut, fermé en cas d'erreur, lu par aucun code de production. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ exigerSession: vi.fn(async () => ({})) }));
const { reinitialiserDepots } = await import("@/donnees/memoire");
const Com = await import("@/services/_commun");
const M = await import("@/services/parcours-mots-multiples");

beforeEach(() => reinitialiserDepots());

describe("motsMultiplesActifs", () => {
  it("la clé est parcours.mots_multiples", () =>
    expect(M.PARAM_MOTS_MULTIPLES).toBe("parcours.mots_multiples"));
  it("éteint par défaut (rien d'enregistré)", async () =>
    expect(await M.motsMultiplesActifs()).toBe(false));
  it.each([true, 1, "oui"])("valeur vraie %s => allumé", async (v) => {
    await Com.ecrireParametre(M.PARAM_MOTS_MULTIPLES, v);
    expect(await M.motsMultiplesActifs()).toBe(true);
  });
  it.each([false, 0, "non", "true", "1", "OUI", "", 2, null, {}, [], [true]])(
    "valeur %j => éteint",
    async (v) => {
      await Com.ecrireParametre(M.PARAM_MOTS_MULTIPLES, v);
      expect(await M.motsMultiplesActifs()).toBe(false);
    },
  );
  it("lecture en erreur => éteint (fermé)", async () => {
    expect(
      await M.motsMultiplesActifs({
        lire: async () => {
          throw new Error("panne");
        },
      }),
    ).toBe(false);
  });
  it("lecture injectée vraie => allumé", async () =>
    expect(await M.motsMultiplesActifs({ lire: async () => true })).toBe(true));
});

describe("garde : aucun code de production ne lit le réglage", () => {
  const parcourir = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory()
        ? parcourir(p)
        : /\.(ts|tsx)$/.test(n)
          ? [p]
          : [];
    });
  const autres = parcourir("src").filter(
    (f) => !f.endsWith("parcours-mots-multiples.ts"),
  );
  it("ni la clé ni le module ne sont cités ailleurs dans src/", () => {
    const fautifs = autres.filter((f) =>
      /parcours\.mots_multiples|parcours-mots-multiples|motsMultiplesActifs/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(fautifs).toEqual([]);
  });
});
