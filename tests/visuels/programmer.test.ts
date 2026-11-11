/**
 * L5-22 : bouton « Programmer » sur la fiche carrousel. Dépôts en mémoire (doublures), aucun appel réel, données fictives.
 * Fichier en .test.ts (createElement) car la configuration de vitest ne collecte que `*.test.ts`.
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Depot, JournalDecalage } from "@/domaine/depots";
import type { Publication } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { CreneauPlan } from "@/services/plan-editorial";
import type { DepotsPasserelle } from "@/services/plan-vers-publication";
import { BoutonProgrammerVisuel, programmerEnUnClic } from "@/components/visuels/BoutonProgrammerVisuel";

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

async function monter(visuel: Partial<Visuel> = {}) {
  const d: DepotsPasserelle = { creneaux: faux<CreneauPlan>(), journal: faux<JournalDecalage>(), publications: faux<Publication>(), visuels: faux<Visuel>() };
  await d.visuels.enregistrer({ id: "vis_1", titre: "Visuel fictif", statut: "valide", reseaux: ["linkedin", "instagram"], ...visuel } as unknown as Visuel);
  return d;
}

describe("programmer en un clic", () => {
  it("crée un créneau programmé pour le visuel, sans autre effet que des lignes du Studio", async () => {
    const d = await monter();
    const r = await programmerEnUnClic(d, "vis_1", "2026-11-25", T0);
    const c = await d.creneaux.obtenir(r.creneauId);
    expect(c?.visuelId).toBe("vis_1");
    expect(c?.statut).toBe("programme");
    expect(c?.jourVise).toBe("2026-11-25");
    expect(Object.keys(c!.heuresParReseau).sort()).toEqual(["instagram", "linkedin"]);
    const pubs = await d.publications.lister();
    expect(pubs).toHaveLength(2);
    expect(pubs.every((p) => p.statut === "programmee" && p.visuelId === "vis_1")).toBe(true);
    expect((await d.visuels.obtenir("vis_1"))?.statut).toBe("programme");
  });

  it("est idempotent : un second clic ne crée ni créneau ni Publication de plus", async () => {
    const d = await monter();
    await programmerEnUnClic(d, "vis_1", "2026-11-25", T0);
    await programmerEnUnClic(d, "vis_1", "2026-11-25", T0);
    expect(await d.creneaux.lister()).toHaveLength(1);
    expect(await d.publications.lister()).toHaveLength(2);
  });

  it("refuse un visuel non validé, sans rien écrire", async () => {
    const d = await monter({ statut: "a_valider" });
    await expect(programmerEnUnClic(d, "vis_1", "2026-11-25", T0)).rejects.toThrow(/valid/i);
    expect(await d.creneaux.lister()).toHaveLength(0);
    expect(await d.publications.lister()).toHaveLength(0);
  });

  it("refuse un visuel sans réseau préparé, un jour invalide ou passé, un visuel inconnu", async () => {
    const d = await monter({ reseaux: [] });
    await expect(programmerEnUnClic(d, "vis_1", "2026-11-25", T0)).rejects.toThrow(/réseaux/i);
    const d2 = await monter();
    await expect(programmerEnUnClic(d2, "vis_1", "demain", T0)).rejects.toThrow(/jour/i);
    await expect(programmerEnUnClic(d2, "vis_1", "2026-11-01", T0)).rejects.toThrow(/jour/i);
    await expect(programmerEnUnClic(d2, "vis_9", "2026-11-25", T0)).rejects.toThrow(/introuvable/i);
    expect(await d2.creneaux.lister()).toHaveLength(0);
  });
});

describe("bouton Programmer", () => {
  const action = async () => {};
  it("affiche un formulaire avec l'identifiant, le jour et le bouton", () => {
    const html = renderToStaticMarkup(createElement(BoutonProgrammerVisuel, { id: "vis_1", action, jourParDefaut: "2026-11-25" }));
    expect(html).toContain("Programmer");
    expect(html).toContain('name="id"');
    expect(html).toContain('value="vis_1"');
    expect(html).toContain('name="jour"');
    expect(html).toContain('value="2026-11-25"');
  });
});

describe("fiche carrousel", () => {
  const lire = (p: string) => readFileSync(p, "utf8");
  it("montre le bouton sur la fiche et relie l'action serveur, sans fournisseur de diffusion", () => {
    const page = lire("src/app/(studio)/carrousels/[id]/page.tsx");
    const actions = lire("src/app/(studio)/carrousels/[id]/actions.ts");
    expect(page).toContain("BoutonProgrammerVisuel");
    expect(page).toContain("programmerAction");
    expect(actions).toContain("export async function programmerAction");
    expect(actions).toMatch(/exigerSession/);
    expect(actions).not.toMatch(/fournisseur|diffus|fetch\(/i);
  });
});
