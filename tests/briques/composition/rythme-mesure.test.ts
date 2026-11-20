import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { mesurerRythme, SEUIL_EVENEMENTS_MIN_PAR_MINUTE, SEUIL_PLAGE_CALME_MS } from "@/briques/composition/rythme-mesure";

type Entree = Parameters<typeof mesurerRythme>[0];
type Scene = { debutMs: number; finMs: number; calques?: { debutMs: number }[] };
const plan = (dureeMs: number, scenes: Scene[]): Entree => ({ dureeMs, scenes }) as unknown as Entree;

describe("mesurerRythme (C10-02)", () => {
  it("seuils documentés", () => {
    expect(SEUIL_PLAGE_CALME_MS).toBe(4000);
    expect(SEUIL_EVENEMENTS_MIN_PAR_MINUTE).toBe(12);
  });

  it("3 scènes régulières de 2 s sur 6 s : plage 2000 ms, aucune réserve", () => {
    const m = mesurerRythme(plan(6000, [{ debutMs: 0, finMs: 2000 }, { debutMs: 2000, finMs: 4000 }, { debutMs: 4000, finMs: 6000 }]));
    expect(m.plusLonguePlageMs).toBe(2000);
    expect(m.debutPlageMs).toBe(0);
    expect(m.evenements).toBe(4);
    expect(m.evenementsParMinute).toBe(40);
    expect(m.reserves).toEqual([]);
  });

  it("une scène de 8 s : plage 8000 ms et réserve avec les secondes exactes", () => {
    const m = mesurerRythme(plan(8000, [{ debutMs: 0, finMs: 8000 }]));
    expect(m.plusLonguePlageMs).toBe(8000);
    expect(m.reserves).toContain("À vérifier : plage sans changement de 0 s à 8 s");
  });

  it("les calques comptent à leur instant absolu", () => {
    const m = mesurerRythme(plan(8000, [{ debutMs: 0, finMs: 8000, calques: [{ debutMs: 3000 }] }]));
    expect(m.plusLonguePlageMs).toBe(5000);
    expect(m.debutPlageMs).toBe(3000);
    expect(m.reserves[0]).toBe("À vérifier : plage sans changement de 3 s à 8 s");
  });

  it("scènes non triées = scènes triées", () => {
    const triees = [{ debutMs: 0, finMs: 2000 }, { debutMs: 2000, finMs: 9000 }];
    expect(mesurerRythme(plan(9000, [...triees].reverse()))).toEqual(mesurerRythme(plan(9000, triees)));
  });

  it("rythme lent signalé sous le seuil", () => {
    const m = mesurerRythme(plan(60000, [{ debutMs: 0, finMs: 30000 }, { debutMs: 30000, finMs: 60000 }]));
    expect(m.reserves.some((r) => r.startsWith("À vérifier : rythme lent (3 événements par minute)"))).toBe(true);
  });

  it.each([
    ["dureeMs 0", plan(0, [{ debutMs: 0, finMs: 0 }])],
    ["scenes vide", plan(5000, [])],
    ["finMs < debutMs", plan(5000, [{ debutMs: 3000, finMs: 1000 }])],
    ["valeurs absurdes", plan(Number.NaN, [{ debutMs: Number.NaN, finMs: Infinity }])],
  ])("%s : pas d'exception, réserve, aucun NaN", (_n, p) => {
    const m = mesurerRythme(p);
    expect(m.reserves.length).toBeGreaterThan(0);
    for (const v of [m.plusLonguePlageMs, m.debutPlageMs, m.evenementsParMinute, m.evenements]) expect(Number.isFinite(v)).toBe(true);
  });

  it("ne modifie pas son entrée", () => {
    const p = plan(8000, [{ debutMs: 4000, finMs: 8000, calques: [{ debutMs: 100 }] }, { debutMs: 0, finMs: 4000 }]);
    const avant = structuredClone(p);
    mesurerRythme(p);
    expect(p).toEqual(avant);
  });

  it("garde statique : non branché, sans service", () => {
    const racine = join(__dirname, "../../../src");
    const fichiers: string[] = [];
    const parcourir = (d: string) => { for (const n of readdirSync(d)) { const c = join(d, n); statSync(c).isDirectory() ? parcourir(c) : /\.tsx?$/.test(n) && fichiers.push(c); } };
    parcourir(racine);
    const propre = join(racine, "briques/composition/rythme-mesure.ts");
    const adaptateur = join(racine, "briques/plan-scenes-generateurs/adaptateur.ts"); // C10-15-b2 : seul appelant autorisé
    for (const f of fichiers) if (f !== propre && f !== adaptateur) expect(readFileSync(f, "utf8"), f).not.toMatch(/rythme-mesure/);
    expect(fichiers.filter((f) => f !== propre && /rythme-mesure/.test(readFileSync(f, "utf8")))).toEqual([adaptateur]);
    expect(readFileSync(propre, "utf8")).not.toMatch(/@\/services/);
  });
});
