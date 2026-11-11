/**
 * L0-07 — collection envoisPlanifies. Test autonome : doublure locale du dépôt, aucun appel réel,
 * rien importé de tests/helpers/. Données fictives.
 */
import { describe, expect, it } from "vitest";
import type { Depot } from "@/domaine/depots";
import { TRANSITIONS_ENVOI, cleEnvoi, peutTransiter, type EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { annulerEnvoi, creerEnvoi, deplacerCreneau, transiterEnvoi, validerEnvoi } from "@/services/envois-planifies";

function doublure(): Depot<EnvoiPlanifie> {
  const t = new Map<string, EnvoiPlanifie>();
  return {
    async lister(f) { return structuredClone([...t.values()].filter((e) => !f || f(e))); },
    async obtenir(id) { const e = t.get(id); return e ? structuredClone(e) : null; },
    async trouver(f) { const e = [...t.values()].find(f); return e ? structuredClone(e) : null; },
    async enregistrer(e) { t.set(e.id, structuredClone(e)); return structuredClone(e); },
    async modifier(id, p) { const a = t.get(id); if (!a) throw new Error("introuvable"); const s = { ...a, ...structuredClone(p) }; t.set(id, s); return structuredClone(s); },
    async supprimer(id) { return t.delete(id); },
    async compter(f) { return [...t.values()].filter((e) => !f || f(e)).length; },
  };
}
const NOW = "2026-11-20T10:00:00.000Z";
const base = { videoId: "vid-1", reseau: "linkedin" as const, versionCreneau: 1, jour: "2026-11-25", heure: "09:30" };

describe("domaine", () => {
  it("refuse programme → a-envoyer, accepte la chaîne complète", () => {
    expect(peutTransiter("programme", "a-envoyer")).toBe(false);
    for (const [a, b] of [["brouillon", "valide"], ["valide", "programme"], ["programme", "confirme"], ["confirme", "a-envoyer"], ["a-envoyer", "envoye"]] as const) expect(peutTransiter(a, b), `${a}→${b}`).toBe(true);
    expect(TRANSITIONS_ENVOI.envoye).toEqual([]);
    expect(TRANSITIONS_ENVOI.annule).toEqual([]);
  });
  it("clé stable tant que la version du créneau ne change pas", () => {
    expect(cleEnvoi("vid-1", "linkedin", 1)).toBe(cleEnvoi("vid-1", "linkedin", 1));
    expect(cleEnvoi("vid-1", "linkedin", 2)).not.toBe(cleEnvoi("vid-1", "linkedin", 1));
    expect(cleEnvoi("vid-1", "tiktok", 1)).not.toBe(cleEnvoi("vid-1", "linkedin", 1));
  });
});

describe("service", () => {
  it("refuse la transition programme → a-envoyer et laisse l'état intact", async () => {
    const d = doublure();
    const e = await creerEnvoi(d, base, NOW);
    await validerEnvoi(d, e.id, "le fondateur", NOW);
    await transiterEnvoi(d, e.id, "programme", NOW);
    await expect(transiterEnvoi(d, e.id, "a-envoyer", NOW)).rejects.toThrow(/transition/i);
    expect((await d.obtenir(e.id))?.statut).toBe("programme");
  });
  it("refuse de programmer sans validation ; la validation porte valideeLe et valideePar", async () => {
    const d = doublure();
    const e = await creerEnvoi(d, base, NOW);
    await expect(transiterEnvoi(d, e.id, "programme", NOW)).rejects.toThrow();
    const v = await validerEnvoi(d, e.id, "le fondateur", NOW);
    expect(v).toMatchObject({ statut: "valide", valideeLe: NOW, valideePar: "le fondateur" });
  });
  it("création idempotente : même clé, même entrée ; déplacer le créneau garde la clé, changer de version non", async () => {
    const d = doublure();
    const a = await creerEnvoi(d, base, NOW);
    const b = await creerEnvoi(d, { ...base, jour: "2026-11-26" }, NOW);
    expect(b.id).toBe(a.id);
    expect(await d.compter()).toBe(1);
    const m = await deplacerCreneau(d, a.id, { jour: "2026-11-27", heure: "11:00" }, NOW);
    expect(m).toMatchObject({ id: a.id, cle: a.cle, jour: "2026-11-27", heure: "11:00" });
    const c = await creerEnvoi(d, { ...base, versionCreneau: 2 }, NOW);
    expect(c.id).not.toBe(a.id);
    expect(await d.compter()).toBe(2);
  });
  it("TikTok : pas de a-envoyer sans consentement ni niveau de confidentialité", async () => {
    const d = doublure();
    const e = await creerEnvoi(d, { ...base, reseau: "tiktok" }, NOW);
    await validerEnvoi(d, e.id, "le fondateur", NOW);
    await transiterEnvoi(d, e.id, "programme", NOW);
    await transiterEnvoi(d, e.id, "confirme", NOW);
    await expect(transiterEnvoi(d, e.id, "a-envoyer", NOW)).rejects.toThrow(/tiktok/i);
    await d.modifier(e.id, { consentementTiktok: true, niveauConfidentialiteTiktok: "PUBLIC_TO_EVERYONE" });
    expect((await transiterEnvoi(d, e.id, "a-envoyer", NOW)).statut).toBe("a-envoyer");
  });
  it("annuler : possible avant l'envoi, impossible après", async () => {
    const d = doublure();
    const e = await creerEnvoi(d, base, NOW);
    expect((await annulerEnvoi(d, e.id, NOW)).statut).toBe("annule");
    await expect(transiterEnvoi(d, e.id, "valide", NOW)).rejects.toThrow();
  });
});
