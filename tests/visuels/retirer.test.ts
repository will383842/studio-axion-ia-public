/**
 * REF-RETIRER-CALENDRIER : retirer un carrousel programmé tant que rien n'est parti. Dépôts en mémoire (doublures),
 * données fictives, aucun appel réel.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Depot, DepotAjoutSeul, JournalDecalage, LotEcritures } from "@/domaine/depots";
import type { Evenement, Publication } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import type { CreneauPlan } from "@/services/plan-editorial";
import { PHRASES_RETRAIT, RefusRetrait, retirerVisuel, type DepotsPasserelle } from "@/services/plan-vers-publication";
import { programmerEnUnClic } from "@/components/visuels/BoutonProgrammerVisuel";

function faux<T extends { id: string }>(): Depot<T> {
  const m = new Map<string, T>();
  return {
    async lister(f) { return [...m.values()].filter((e) => !f || f(e)).map((e) => structuredClone(e)); },
    async obtenir(id) { const e = m.get(id); return e ? structuredClone(e) : null; },
    async trouver(f) { const e = [...m.values()].find(f); return e ? structuredClone(e) : null; },
    async enregistrer(e) { m.set(e.id, structuredClone(e)); return structuredClone(e); },
    async modifier(id, p) { const e = m.get(id); if (!e) throw new Error("absent"); const n = { ...e, ...p }; m.set(id, n); return structuredClone(n); },
    async supprimer(id) { return m.delete(id); },
  } as Depot<T>;
}
const T0 = "2026-11-14T10:00:00.000Z";
const JOUR = "2026-11-16";

async function monter(visuel: Partial<Visuel> = {}) {
  const d: DepotsPasserelle = { creneaux: faux<CreneauPlan>(), journal: faux<JournalDecalage>() as unknown as DepotAjoutSeul<JournalDecalage>, publications: faux<Publication>(), visuels: faux<Visuel>(), evenements: faux<Evenement>() };
  await d.visuels.enregistrer({ id: "vis_1", titre: "Visuel fictif", statut: "valide", reseaux: ["linkedin", "instagram"], ...visuel } as unknown as Visuel);
  return d;
}
const jouer = (d: DepotsPasserelle) => async (lot: LotEcritures) => {
  for (const s of lot.supprimer) await (d[s.collection as "publications"] as Depot<Publication>).supprimer(s.id);
  for (const e of lot.enregistrer) await (d[e.collection === "creneauxEditoriaux" ? "creneaux" : (e.collection as "visuels")] as Depot<{ id: string }>).enregistrer(e.entite);
};
const photo = async (d: DepotsPasserelle) => JSON.stringify([await d.creneaux.lister(), await d.publications.lister(), await d.visuels.lister(), await d.evenements!.lister()]);

async function programme() {
  const d = await monter();
  await programmerEnUnClic(d, "vis_1", JOUR, T0);
  return d;
}

describe("retirer du calendrier", () => {
  it("(a) défait la programmation : 0 publication, visuel valide, créneau archivé, une trace sans UTC", async () => {
    const d = await programme();
    const r = await retirerVisuel(d, "vis_1", T0, jouer(d));
    expect(r.creneauId).toBe("cre_vis_1");
    expect(r.retirees).toHaveLength(2);
    expect(await d.publications.lister()).toHaveLength(0);
    expect((await d.visuels.obtenir("vis_1"))?.statut).toBe("valide");
    const c = await d.creneaux.obtenir("cre_vis_1");
    expect(c?.statut).toBe("archive");
    expect(c?.retireLe).toBe(T0);
    const ev = await d.evenements!.lister();
    expect(ev).toHaveLength(1);
    expect(ev[0].message).toContain("LinkedIn");
    expect(ev[0].message).toContain("08:30");
    expect(ev[0].message).not.toMatch(/UTC/);
  });

  it("(b) reprogrammation : nouveau créneau -2, 2 publications, ancien archivé, second clic sans effet", async () => {
    const d = await programme();
    await retirerVisuel(d, "vis_1", T0, jouer(d));
    await programmerEnUnClic(d, "vis_1", "2026-11-17", T0);
    await programmerEnUnClic(d, "vis_1", "2026-11-17", T0);
    const c2 = await d.creneaux.obtenir("cre_vis_1-2");
    expect(c2?.jourVise).toBe("2026-11-17");
    expect(c2?.statut).toBe("programme");
    expect((await d.creneaux.obtenir("cre_vis_1"))?.statut).toBe("archive");
    const pubs = await d.publications.lister();
    expect(pubs).toHaveLength(2);
    expect(pubs.every((p) => p.statut === "programmee")).toBe(true);
    expect((await d.visuels.obtenir("vis_1"))?.statut).toBe("programme");
    expect(await d.creneaux.lister()).toHaveLength(2);
  });

  describe("(c) refus sans aucune écriture", () => {
    const cas: [string, (d: DepotsPasserelle) => Promise<unknown>, string, string?][] = [
      ["publication publiée", async (d) => { const [p] = await d.publications.lister(); await d.publications.modifier(p.id, { statut: "publiee" } as Partial<Publication>); }, PHRASES_RETRAIT.publiee],
      ["avec idExterne", async (d) => { const [p] = await d.publications.lister(); await d.publications.modifier(p.id, { idExterne: "ext_1" } as Partial<Publication>); }, PHRASES_RETRAIT.confiee],
      ["avec etatEnvoi", async (d) => { const [p] = await d.publications.lister(); await d.publications.modifier(p.id, { etatEnvoi: "en-cours" } as unknown as Partial<Publication>); }, PHRASES_RETRAIT.confiee],
      ["via zernio", async (d) => { const [p] = await d.publications.lister(); await d.publications.modifier(p.id, { via: "zernio" } as unknown as Partial<Publication>); }, PHRASES_RETRAIT.confiee],
      ["heure passée", async () => undefined, PHRASES_RETRAIT.passee, "2026-11-16T07:30:00.000Z"],
      ["visuel valide", async (d) => { await d.visuels.modifier("vis_1", { statut: "valide" } as Partial<Visuel>); }, PHRASES_RETRAIT.absent],
      ["créneau signé par l'usine", async (d) => { await d.creneaux.modifier("cre_vis_1", { signatureUsine: "sig" } as Partial<CreneauPlan>); }, PHRASES_RETRAIT.usine],
    ];
    it.each(cas)("%s", async (_nom, preparer, phrase, instant) => {
      const d = await programme();
      await preparer(d);
      const avant = await photo(d);
      let appels = 0;
      const err = await retirerVisuel(d, "vis_1", instant ?? T0, async () => { appels++; }).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(RefusRetrait);
      expect((err as Error).message).toBe(phrase);
      expect(appels).toBe(0);
      expect(await photo(d)).toBe(avant);
    });
    it("visuel inconnu", async () => {
      const d = await monter();
      await expect(retirerVisuel(d, "vis_9", T0, jouer(d))).rejects.toThrow(PHRASES_RETRAIT.introuvable);
    });
  });

  it("(d) atomicité : un seul lot, effacements limités aux publications, rien ne change si l'application échoue", async () => {
    const d = await programme();
    const lots: LotEcritures[] = [];
    await retirerVisuel(d, "vis_1", T0, async (lot) => { lots.push(lot); });
    expect(lots).toHaveLength(1);
    expect(lots[0].supprimer).toHaveLength(2);
    expect(lots[0].supprimer.every((s) => s.collection === "publications")).toBe(true);
    const avant = await photo(d);
    await expect(retirerVisuel(d, "vis_1", T0, async () => { throw new Error("panne"); })).rejects.toThrow("panne");
    expect(await photo(d)).toBe(avant);
  });

  it("(e) le service n'appelle aucun fournisseur ni le réseau", () => {
    const src = readFileSync("src/services/plan-vers-publication.ts", "utf8");
    expect(src).not.toMatch(/fetch\(|fournisseurs\//);
  });
});
