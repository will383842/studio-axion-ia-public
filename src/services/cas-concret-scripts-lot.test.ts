import { describe, expect, it, vi } from "vitest";

vi.mock("./_commun", () => ({ lireParametre: vi.fn(async () => ({})) }));
vi.mock("./cas-concret-scripts", () => ({ CLE_SCRIPTS_VALIDES: "casConcret.scriptsValides" }));

import { lireParametre } from "./_commun";
import { CAS_PAR_PAGE, preparerPageCas, scriptsValidesDe } from "./cas-concret-scripts-lot";

const cas = (n: number, prefixe = "c") => Array.from({ length: n }, (_, i) => ({ cas: { id: `${prefixe}${i}` } }));

describe("la page en lot (K3)", () => {
  it("120 cas : UNE seule lecture du réglage des scripts", async () => {
    const lire = vi.fn(async () => ({}));
    const r = await scriptsValidesDe(cas(120).map((c) => c.cas.id), lire);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(Object.keys(r)).toHaveLength(120);
    expect(Object.values(r).every((v) => v === null)).toBe(true);
  });

  it("par défaut, il lit le réglage par sa constante exportée, une fois", async () => {
    await scriptsValidesDe(["a", "b", "c"]);
    expect(lireParametre).toHaveBeenCalledTimes(1);
    expect(lireParametre).toHaveBeenCalledWith("casConcret.scriptsValides", {});
  });

  it("réglage illisible (pas un objet) : aucun script du studio, pas d'erreur", async () => {
    expect(await scriptsValidesDe(["a"], async () => "n'importe quoi")).toEqual({ a: null });
  });

  const estStock = (id: string) => id.startsWith("s") || id.startsWith("vs");

  it("22 cas d'avant le stock : 22 estimations, comme avant K3 (réglage éteint)", async () => {
    const estimer = vi.fn(async (_c: { cas: { id: string } }, _essai: boolean) => ({ centimes: 100 }));
    const { montants } = await preparerPageCas(cas(17), cas(5, "v"), estimer, CAS_PAR_PAGE, estStock);
    expect(estimer).toHaveBeenCalledTimes(22);
    expect(Object.keys(montants)).toHaveLength(22);
  });

  it("sans fonction « du stock » : aucun cas n'est plafonné", async () => {
    const estimer = vi.fn(async (_c: { cas: { id: string } }, _essai: boolean) => ({ centimes: 100 }));
    await preparerPageCas(cas(30), cas(5, "v"), estimer);
    expect(estimer).toHaveBeenCalledTimes(35);
  });

  it("120 cas dont 98 du stock : 22 + 20 estimations au plus, les valides d'abord", async () => {
    const estimer = vi.fn(async (_c: { cas: { id: string } }, _essai: boolean) => ({ centimes: 100 }));
    // 12 cas d'avant + 78 du stock valides ; 10 d'avant + 20 du stock à valider.
    const valides = [...cas(12, "c"), ...cas(78, "s")];
    const aValider = [...cas(10, "vc"), ...cas(20, "vs")];
    const { montants } = await preparerPageCas(valides, aValider, estimer, CAS_PAR_PAGE, estStock);
    expect(estimer).toHaveBeenCalledTimes(22 + CAS_PAR_PAGE);
    expect(Object.keys(montants).filter((id) => estStock(id))).toHaveLength(CAS_PAR_PAGE);
    expect(Object.keys(montants).filter((id) => !estStock(id))).toHaveLength(22);
    // Les 20 du stock estimés sont les premiers valides du stock : aucun cas à valider du stock.
    expect(estimer.mock.calls.filter((a) => a[1] === true && estStock(a[0].cas.id))).toHaveLength(0);
  });

  it("peu de cas valides du stock : le reste du plafond va aux cas à valider du stock, en essai", async () => {
    const estimer = vi.fn(async (c: { cas: { id: string } }, essai: boolean) => ({ centimes: 1, ...(essai ? {} : { refus: `non ${c.cas.id}` }) }));
    const { montants, refus } = await preparerPageCas(cas(5, "s"), cas(100, "vs"), estimer, CAS_PAR_PAGE, estStock);
    expect(estimer).toHaveBeenCalledTimes(20);
    expect(estimer.mock.calls.filter((a) => a[1] === true)).toHaveLength(15);
    expect(Object.keys(montants)).toHaveLength(20);
    expect(Object.keys(refus)).toHaveLength(5);
  });
});
