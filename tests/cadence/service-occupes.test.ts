/**
 * L3-17 : service des créneaux occupés. Dépôts en mémoire (doublures locales), aucun appel réel, données fictives.
 */
import { describe, expect, it } from "vitest";
import type { Depot } from "@/domaine/depots";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import type { CreneauPlan } from "@/services/plan-editorial";
import { estOccupe, creneauxOccupes, reseauxOccupes } from "@/services/cadence";

function faux(init: CreneauPlan[]) {
  const m = new Map(init.map((c) => [c.id, c]));
  const appels = { ecritures: 0 };
  const depot = {
    async lister(f?: (e: CreneauPlan) => boolean) { return [...m.values()].filter((e) => !f || f(e)).map((e) => structuredClone(e)); },
    async obtenir(id: string) { const e = m.get(id); return e ? structuredClone(e) : null; },
    async trouver(f: (e: CreneauPlan) => boolean) { const e = [...m.values()].find(f); return e ? structuredClone(e) : null; },
    async enregistrer() { appels.ecritures++; throw new Error("écriture interdite"); },
    async modifier() { appels.ecritures++; throw new Error("écriture interdite"); },
  } as unknown as Depot<CreneauPlan>;
  return { depot, appels, m };
}
const cr = (id: string, extra: Partial<CreneauEditorial> = {}): CreneauPlan => ({
  id, jourVise: "2026-12-01", heuresParReseau: { linkedin: "2026-12-01T08:30:00.000Z" }, compteCible: "compte-fictif-1",
  videoId: "v1", statut: "valide", decalages: 0, ...extra,
});

describe("créneaux occupés", () => {
  it("deux créneaux LinkedIn le même jour sont rendus tous les deux", async () => {
    const { depot } = faux([cr("a"), cr("b", { heuresParReseau: { linkedin: "2026-12-01T15:00:00.000Z" } })]);
    const r = await creneauxOccupes(depot, "2026-12-01", "2026-12-01");
    expect(r.map((o) => [o.creneauId, o.reseau, o.jour, o.heure])).toEqual([
      ["a", "linkedin", "2026-12-01", "09:30"],
      ["b", "linkedin", "2026-12-01", "16:00"],
    ]);
  });
  it("une publication archivée n'occupe rien", async () => {
    const { depot } = faux([cr("a", { statut: "archive" }), cr("b")]);
    const r = await creneauxOccupes(depot, "2026-12-01", "2026-12-01");
    expect(r.map((o) => o.creneauId)).toEqual(["b"]);
    expect(estOccupe(cr("a", { statut: "archive" }))).toBe(false);
    expect(estOccupe(cr("b"))).toBe(true);
  });
  it("un créneau multi-réseaux occupe chaque réseau ; un réseau sans heure n'est pas occupé", async () => {
    const c = cr("a", { heuresParReseau: { linkedin: "2026-12-01T08:30:00.000Z", tiktok: "2026-12-01T17:00:00.000Z" } });
    const { depot } = faux([c]);
    const r = await creneauxOccupes(depot, "2026-12-01", "2026-12-01");
    expect(r.map((o) => o.reseau).sort()).toEqual(["linkedin", "tiktok"]);
    expect(await reseauxOccupes(depot, "2026-12-01")).toEqual(["linkedin", "tiktok"]);
    expect(await reseauxOccupes(depot, "2026-12-02")).toEqual([]);
  });
  it("filtre par réseau et par période ; l'ordre est par jour puis heure", async () => {
    const { depot } = faux([
      cr("c", { jourVise: "2026-12-03", heuresParReseau: { linkedin: "2026-12-03T08:00:00.000Z" } }),
      cr("a", { jourVise: "2026-12-02", heuresParReseau: { linkedin: "2026-12-02T08:00:00.000Z", tiktok: "2026-12-02T09:00:00.000Z" } }),
      cr("x", { jourVise: "2026-12-09" }),
    ]);
    const r = await creneauxOccupes(depot, "2026-12-01", "2026-12-05", { reseau: "linkedin" });
    expect(r.map((o) => o.creneauId)).toEqual(["a", "c"]);
  });
  it("aucune écriture : le dépôt n'est jamais modifié", async () => {
    const f = faux([cr("a"), cr("b", { statut: "archive" })]);
    const avant = JSON.stringify([...f.m.values()]);
    await creneauxOccupes(f.depot, "2026-12-01", "2026-12-31");
    await reseauxOccupes(f.depot, "2026-12-01");
    expect(f.appels.ecritures).toBe(0);
    expect(JSON.stringify([...f.m.values()])).toBe(avant);
  });
});
