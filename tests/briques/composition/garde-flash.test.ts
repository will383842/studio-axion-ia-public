import { describe, expect, it } from "vitest";
import { mesurerFlashs, FENETRE_FLASH_MS, SEUIL_FLASHS_PAR_FENETRE } from "@/briques/composition/garde-flash";

type Entree = Parameters<typeof mesurerFlashs>[0];
type Scene = { debutMs: number; finMs: number; transition: { entree: string; sortie: string; dureeMs: number } };
const plan = (dureeMs: number, scenes: Scene[]): Entree => ({ dureeMs, scenes }) as unknown as Entree;
const scene = (debutMs: number, finMs: number, entree = "fondu", sortie = "fondu"): Scene => ({ debutMs, finMs, transition: { entree, sortie, dureeMs: 200 } });
/** n scènes de 250 ms, toutes entrées en flash : n flashs dans la même seconde. */
const rafale = (n: number): Entree => plan(5000, Array.from({ length: n }, (_, i) => scene(i * 250, (i + 1) * 250, "flash-ivoire")));

describe("mesurerFlashs (X1-15)", () => {
  it("seuils documentés", () => {
    expect(FENETRE_FLASH_MS).toBe(1000);
    expect(SEUIL_FLASHS_PAR_FENETRE).toBe(3);
  });
  it("plan vide ou illisible : OK, aucune exception", () => {
    expect(mesurerFlashs(plan(0, [])).reserves).toEqual([]);
    expect(mesurerFlashs(plan(5000, [])).maxParSeconde).toBe(0);
    expect(() => mesurerFlashs(undefined as unknown as Entree)).not.toThrow();
  });
  it("3 flashs dans 1 s : OK", () => {
    const m = mesurerFlashs(rafale(3));
    expect(m.flashs).toBe(3);
    expect(m.maxParSeconde).toBe(3);
    expect(m.reserves).toEqual([]);
  });
  it("4 flashs dans 1 s : réserve « À vérifier »", () => {
    const m = mesurerFlashs(rafale(4));
    expect(m.maxParSeconde).toBe(4);
    expect(m.reserves).toHaveLength(1);
    expect(m.reserves[0]).toMatch(/^À vérifier : 4 flashs en 1 s/);
  });
  it("flashs espacés de plus d'1 s : OK", () => {
    const m = mesurerFlashs(plan(9000, [0, 2000, 4000, 6000, 8000].map((d) => scene(d, d + 1500, "flash-ivoire"))));
    expect(m.flashs).toBe(5);
    expect(m.maxParSeconde).toBe(1);
    expect(m.reserves).toEqual([]);
  });
  it("la sortie compte (instant = fin − durée) et les lumières comptent aussi", () => {
    const m = mesurerFlashs(plan(3000, [scene(0, 1000, "reflet-entree", "flash-ivoire"), scene(1000, 2000, "fondu", "flash-ivoire")]));
    expect(m.flashs).toBe(3);
  });
  it("transitions sans lumière : zéro flash", () => {
    expect(mesurerFlashs(plan(4000, [scene(0, 2000), scene(2000, 4000, "poussee", "iris")])).flashs).toBe(0);
  });
  it("ne modifie pas le plan (pur)", () => {
    const p = rafale(4);
    const avant = JSON.stringify(p);
    mesurerFlashs(p);
    expect(JSON.stringify(p)).toBe(avant);
  });
});
