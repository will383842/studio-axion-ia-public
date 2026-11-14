/** LIA-A · réglage « plusieurs mots » : éteint par défaut, fermé en cas d'erreur, lecteurs en liste fermée. */
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
  it.each([true])("valeur vraie %s => allumé", async (v) => {
    await Com.ecrireParametre(M.PARAM_MOTS_MULTIPLES, v);
    expect(await M.motsMultiplesActifs()).toBe(true);
  });
  it.each([
    false,
    1,
    "oui",
    0,
    "non",
    "true",
    "1",
    "OUI",
    "",
    2,
    null,
    {},
    [],
    [true],
  ])("valeur %j => éteint", async (v) => {
    await Com.ecrireParametre(M.PARAM_MOTS_MULTIPLES, v);
    expect(await M.motsMultiplesActifs()).toBe(false);
  });
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

describe("garde : liste fermée des lecteurs du réglage", () => {
  const MODULE = "src/services/parcours-mots-multiples.ts";
  const LECTEURS_PERMIS = [
    MODULE,
    "src/services/parcours-conversation.ts",
    "src/services/parcours-dossier.ts",
    "src/services/parcours-mot.ts",
    "src/services/branchements-zernio.ts",
    // R5 : lecture seule, pour dire à l'écran /mots si le réglage est allumé (ne l'écrit ni ne l'ouvre).
    "src/services/mots-cibles-vue.ts",
  ];
  const parcourir = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory()
        ? parcourir(p)
        : /\.(ts|tsx)$/.test(n)
          ? [p.replace(/\\/g, "/")]
          : [];
    });
  const fichiers = parcourir("src");
  const cite = (f: string, motif: RegExp) =>
    motif.test(readFileSync(f, "utf8"));

  it("la clé littérale n'apparaît que dans le module", () => {
    const fautifs = fichiers.filter(
      (f) => f !== MODULE && cite(f, /parcours\.mots_multiples/),
    );
    expect(fautifs).toEqual([]);
  });
  it("seuls les lecteurs permis citent le module, la fonction ou la constante", () => {
    const fautifs = fichiers.filter(
      (f) =>
        !LECTEURS_PERMIS.includes(f) &&
        cite(
          f,
          /parcours-mots-multiples|motsMultiplesActifs|PARAM_MOTS_MULTIPLES/,
        ),
    );
    expect(fautifs).toEqual([]);
  });
  it("aucun lecteur permis ne cite la constante : passage par motsMultiplesActifs", () => {
    const fautifs = LECTEURS_PERMIS.filter(
      (f) =>
        f !== MODULE && fichiers.includes(f) && cite(f, /PARAM_MOTS_MULTIPLES/),
    );
    expect(fautifs).toEqual([]);
  });
});
