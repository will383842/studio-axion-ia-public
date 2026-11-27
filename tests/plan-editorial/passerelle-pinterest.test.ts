/**
 * Pinterest : un créneau visuel qui ne vise QUE Pinterest est refusé par `programmerVisuel` (rien d'écrit, aucun fournisseur).
 * Un créneau mixte programme les autres réseaux et ignore Pinterest. Dépôts en mémoire, données fictives.
 */
import { describe, expect, it, vi } from "vitest";
import type { Depot, JournalDecalage } from "@/domaine/depots";
import type { Publication } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { CreneauPlan } from "@/services/plan-editorial";
import { programmerVisuel, type DepotsPasserelle } from "@/services/plan-vers-publication";

function faux<T extends { id: string }>(): Depot<T> {
  const m = new Map<string, T>();
  return {
    async lister(f) { return [...m.values()].filter((e) => !f || f(e)).map((e) => structuredClone(e)); },
    async obtenir(id) { const e = m.get(id); return e ? structuredClone(e) : null; },
    async trouver(f) { const e = [...m.values()].find(f); return e ? structuredClone(e) : null; },
    async enregistrer(e) { m.set(e.id, structuredClone(e)); return structuredClone(e); },
    async modifier(id, p) {
      const e = m.get(id);
      if (!e) throw new Error("absent");
      const n = { ...e, ...p }; m.set(id, n); return structuredClone(n);
    },
  } as Depot<T>;
}
const T0 = "2026-11-20T10:00:00.000Z";

async function monter(heures: Record<string, string>) {
  const d: DepotsPasserelle = { creneaux: faux<CreneauPlan>(), journal: faux<JournalDecalage>(), publications: faux<Publication>(), visuels: faux<Visuel>() };
  await d.visuels.enregistrer({ id: "vis_1", titre: "Visuel fictif", statut: "valide" } as unknown as Visuel);
  await d.creneaux.enregistrer({
    id: "c1", jourVise: "2026-11-25", compteCible: "compte-fictif-1", visuelId: "vis_1", statut: "valide", decalages: 0,
    heuresParReseau: heures,
  } as unknown as CreneauPlan);
  return d;
}

describe("programmerVisuel et Pinterest", () => {
  it("refuse un créneau qui ne vise que Pinterest : aucune écriture, aucun appel fournisseur", async () => {
    const fournisseur = vi.fn();
    const fetchEspion = vi.spyOn(globalThis, "fetch").mockImplementation(fournisseur as never);
    const d = await monter({ pinterest: "2026-11-25T09:00:00.000Z" });
    await expect(programmerVisuel(d, "c1", T0)).rejects.toThrow(/Pinterest ne peut pas encore être programmé/);
    expect(await d.publications.lister()).toHaveLength(0);
    expect((await d.visuels.obtenir("vis_1"))?.statut).toBe("valide");
    expect((await d.creneaux.obtenir("c1"))?.statut).toBe("valide");
    expect(fournisseur).not.toHaveBeenCalled();
    fetchEspion.mockRestore();
  });

  it("un créneau mixte programme seulement les réseaux hors Pinterest", async () => {
    const d = await monter({ pinterest: "2026-11-25T09:00:00.000Z", linkedin: "2026-11-25T08:30:00.000Z", instagram: "2026-11-25T16:00:00.000Z" });
    const pubs = await programmerVisuel(d, "c1", T0);
    expect(pubs.map((p) => p.reseau).sort()).toEqual(["instagram", "linkedin"]);
    expect((await d.publications.lister()).map((p) => p.reseau).sort()).toEqual(["instagram", "linkedin"]);
    expect((await d.creneaux.obtenir("c1"))?.statut).toBe("programme");
  });
});
