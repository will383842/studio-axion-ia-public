/**
 * L0-10 — journal d'envoi durable. Doublure locale du dépôt, aucun appel réel, rien importé de tests/helpers/.
 */
import { describe, expect, it, vi } from "vitest";
import type { Depot } from "@/domaine/depots";
import type { Evenement } from "@/domaine/types";
import { ecrireJournalEnvoi, lireJournalEnvoi, filtrerEntreeJournal, TYPE_JOURNAL_ENVOI } from "@/services/journal-envoi-base";

function doublure(opts: { echecEcriture?: boolean; lent?: boolean } = {}) {
  const t = new Map<string, Evenement>();
  const appels = { supprimer: 0, lister: 0 };
  const d: Depot<Evenement> = {
    async lister(f) { appels.lister++; return structuredClone([...t.values()].filter((e) => !f || f(e))); },
    async obtenir(id) { return t.get(id) ?? null; },
    async trouver(f) { return [...t.values()].find(f) ?? null; },
    async enregistrer(e) {
      if (opts.echecEcriture) throw new Error("base indisponible");
      if (opts.lent) await new Promise((r) => setTimeout(r, 30));
      t.set(e.id, structuredClone(e));
      return e;
    },
    async modifier(id, p) { const s = { ...t.get(id)!, ...p }; t.set(id, s); return s; },
    async supprimer(id) { appels.supprimer++; return t.delete(id); },
    async compter() { return t.size; },
  };
  return { d, t, appels };
}
const NOW = "2026-11-20T10:00:00.000Z";

describe("écriture", () => {
  it("un envoi refusé écrit une ligne avec son code", async () => {
    const { d } = doublure();
    await ecrireJournalEnvoi(d, { action: "envoyer", outil: "zernio", reseau: "linkedin", code: "PAS_PRETE", contenuId: "vid-1" }, NOW, true);
    const l = await lireJournalEnvoi(d);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ code: "PAS_PRETE", action: "envoyer", reseau: "linkedin", contenuId: "vid-1", ts: NOW });
  });
  it("aucun champ hors liste blanche, aucune valeur mal formée", async () => {
    const { d, t } = doublure();
    await ecrireJournalEnvoi(d, { action: "envoyer", code: "CIBLE_INCONNUE", texte: "légende secrète", email: "a@exemple.fr", jeton: "abc", outil: "autre", reseau: "x y", nbComptes: -3 } as never, NOW, true);
    const brut = JSON.stringify([...t.values()]);
    for (const interdit of ["légende secrète", "a@exemple.fr", "jeton", "abc", "autre", "x y"]) expect(brut).not.toContain(interdit);
    expect(Object.keys(filtrerEntreeJournal({ action: "a", code: "OK", pirate: 1 }, NOW)).sort()).toEqual(["action", "code", "ts"]);
  });
  it("sans await : rend la main avant la fin de l'écriture, et une base en panne ne lève jamais", async () => {
    const lent = doublure({ lent: true });
    const p = ecrireJournalEnvoi(lent.d, { action: "envoyer", code: "OK" }, NOW);
    expect(p).toBeUndefined();
    expect(lent.t.size).toBe(0);
    await vi.waitFor(() => expect(lent.t.size).toBe(1));
    const panne = doublure({ echecEcriture: true });
    expect(() => ecrireJournalEnvoi(panne.d, { action: "envoyer", code: "OK" }, NOW)).not.toThrow();
    await new Promise((r) => setTimeout(r, 5));
  });
  it("conservé sans purge : aucune suppression, deux envois identiques = deux lignes", async () => {
    const { d, appels } = doublure();
    await ecrireJournalEnvoi(d, { action: "envoyer", code: "OK" }, NOW, true);
    await ecrireJournalEnvoi(d, { action: "envoyer", code: "OK" }, NOW, true);
    expect(await d.compter()).toBe(2);
    expect(appels.supprimer).toBe(0);
  });
});

describe("lecture", () => {
  it("n'appelle aucun fournisseur (fetch interdit) et ne rend que les lignes du journal, récentes d'abord", async () => {
    const fetchEspion = vi.fn(() => { throw new Error("réseau interdit"); });
    vi.stubGlobal("fetch", fetchEspion);
    const { d } = doublure();
    await d.enregistrer({ id: "autre", type: "autre", message: "x", date: NOW, creeLe: NOW, modifieLe: NOW });
    await ecrireJournalEnvoi(d, { action: "a", code: "OK" }, "2026-11-20T09:00:00.000Z", true);
    await ecrireJournalEnvoi(d, { action: "b", code: "PAS_PRETE" }, "2026-11-20T11:00:00.000Z", true);
    const l = await lireJournalEnvoi(d);
    expect(l.map((x) => x.action)).toEqual(["b", "a"]);
    expect(fetchEspion).not.toHaveBeenCalled();
    expect(TYPE_JOURNAL_ENVOI).toBe("envoi-journal");
    vi.unstubAllGlobals();
  });
});
