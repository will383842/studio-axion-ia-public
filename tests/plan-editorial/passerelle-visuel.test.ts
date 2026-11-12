/**
 * L4-08 : passerelle visuel -> créneau -> Publication. Dépôts en mémoire (doublures), aucun appel réel, données fictives.
 */
import { describe, expect, it } from "vitest";
import type { Depot, JournalDecalage } from "@/domaine/depots";
import type { Publication } from "@/domaine/types";
import { sourceDe } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { CreneauPlan } from "@/services/plan-editorial";
import { decaler } from "@/services/plan-editorial";
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

async function monter(statutVisuel = "valide", statutCreneau: CreneauPlan["statut"] = "valide") {
  const d: DepotsPasserelle = { creneaux: faux<CreneauPlan>(), journal: faux<JournalDecalage>(), publications: faux<Publication>(), visuels: faux<Visuel>() };
  await d.visuels.enregistrer({ id: "vis_1", titre: "Visuel fictif", statut: statutVisuel } as unknown as Visuel);
  await d.creneaux.enregistrer({
    id: "c1", jourVise: "2026-11-25", compteCible: "compte-fictif-1", visuelId: "vis_1", statut: statutCreneau, decalages: 0,
    heuresParReseau: { linkedin: "2026-11-25T08:30:00.000Z", instagram: "2026-11-25T16:00:00.000Z" },
  });
  return d;
}

describe("passerelle visuel -> publication", () => {
  it("crée une Publication par réseau dont la source est le visuel, et passe le visuel et le créneau à « programme »", async () => {
    const d = await monter();
    const pubs = await programmerVisuel(d, "c1", T0);
    expect(pubs).toHaveLength(2);
    for (const p of pubs) {
      expect(sourceDe(p)).toEqual({ famille: "visuel", visuelId: "vis_1" });
      expect(p.statut).toBe("programmee");
      expect(p.via).toBe("manuel");
    }
    expect(pubs.map((p) => p.reseau).sort()).toEqual(["instagram", "linkedin"]);
    expect((await d.visuels.obtenir("vis_1"))?.statut).toBe("programme");
    expect((await d.creneaux.obtenir("c1"))?.statut).toBe("programme");
  });

  it("un double appel ne crée pas de doublon", async () => {
    const d = await monter();
    const a = await programmerVisuel(d, "c1", T0);
    const b = await programmerVisuel(d, "c1", T0);
    expect((await d.publications.lister()).length).toBe(2);
    expect(b.map((p) => p.id).sort()).toEqual(a.map((p) => p.id).sort());
    expect((await d.visuels.obtenir("vis_1"))?.statut).toBe("programme");
  });

  it("refuse un visuel non validé, sans rien écrire", async () => {
    const d = await monter("a_valider");
    await expect(programmerVisuel(d, "c1", T0)).rejects.toThrow(/valid/i);
    expect(await d.publications.lister()).toHaveLength(0);
    expect((await d.visuels.obtenir("vis_1"))?.statut).toBe("a_valider");
    expect((await d.creneaux.obtenir("c1"))?.statut).toBe("valide");
  });

  it("refuse un créneau non validé, un créneau sans visuel, un créneau ou un visuel absent", async () => {
    await expect(programmerVisuel(await monter("valide", "propose"), "c1", T0)).rejects.toThrow();
    const d = await monter();
    await d.creneaux.enregistrer({ id: "c2", jourVise: "2026-11-25", compteCible: "x", videoId: "v1", statut: "valide", decalages: 0, heuresParReseau: { linkedin: "2026-11-25T08:30:00.000Z" } });
    await expect(programmerVisuel(d, "c2", T0)).rejects.toThrow(/visuel/i);
    await expect(programmerVisuel(d, "absent", T0)).rejects.toThrow(/introuvable/i);
    await d.creneaux.enregistrer({ id: "c3", jourVise: "2026-11-25", compteCible: "x", visuelId: "vis_x", statut: "valide", decalages: 0, heuresParReseau: { linkedin: "2026-11-25T08:30:00.000Z" } });
    await expect(programmerVisuel(d, "c3", T0)).rejects.toThrow(/introuvable/i);
  });

  it("reprend après une coupure : publications déjà écrites, visuel pas encore programmé", async () => {
    const d = await monter();
    const [premiere] = await programmerVisuel(d, "c1", T0);
    await d.visuels.modifier("vis_1", { statut: "valide" } as Partial<Visuel>);
    await d.creneaux.modifier("c1", { statut: "valide" });
    const reprise = await programmerVisuel(d, "c1", T0);
    expect((await d.publications.lister()).length).toBe(2);
    expect(reprise.map((p) => p.id)).toContain(premiere.id);
    expect((await d.visuels.obtenir("vis_1"))?.statut).toBe("programme");
  });
  it("un décalage puis un rejeu ne crée pas de 2e Publication : la date de l'existante est mise à jour", async () => {
    const d = await monter();
    await programmerVisuel(d, "c1", T0);
    await decaler(d, "c1", { cle: "k1", nouveauJour: "2026-11-27", raison: "test" }, T0);
    const rejeu = await programmerVisuel(d, "c1", T0);
    const toutes = await d.publications.lister();
    expect(toutes).toHaveLength(2);
    expect(rejeu).toHaveLength(2);
    for (const p of toutes) expect(p.date.startsWith("2026-11-27")).toBe(true);
  });

  it("un rejeu après décalage d'un créneau confié (à renvoyer) est refusé, sans écriture", async () => {
    const d = await monter();
    await d.creneaux.modifier("c1", { repereUsine: "repere-fictif" } as Partial<CreneauPlan>);
    await programmerVisuel(d, "c1", T0);
    await decaler(d, "c1", { cle: "k1", nouveauJour: "2026-11-27", raison: "test" }, T0);
    await expect(programmerVisuel(d, "c1", T0)).rejects.toThrow(/renvoy/i);
    const toutes = await d.publications.lister();
    expect(toutes).toHaveLength(2);
    for (const p of toutes) expect(p.date.startsWith("2026-11-25")).toBe(true);
  });

  it("un même visuel placé dans un 2e créneau à une autre date est refusé : la Publication du 1er créneau n'est pas déplacée", async () => {
    const d = await monter();
    await programmerVisuel(d, "c1", T0);
    await d.creneaux.enregistrer({
      id: "c2", jourVise: "2026-12-02", compteCible: "compte-fictif-1", visuelId: "vis_1", statut: "valide", decalages: 0,
      heuresParReseau: { linkedin: "2026-12-02T08:30:00.000Z" },
    });
    await expect(programmerVisuel(d, "c2", T0)).rejects.toThrow(/autre créneau/i);
    const toutes = await d.publications.lister();
    expect(toutes).toHaveLength(2);
    const li = toutes.find((p) => p.reseau === "linkedin")!;
    expect(li.date).toBe("2026-11-25T08:30:00.000Z");
    expect((await d.creneaux.obtenir("c2"))?.statut).toBe("valide");
  });
});
