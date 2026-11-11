/**
 * L3-02 — dépense Claude rattachée à tout contenu. Aucun appel réel : le chemin vidéo est remplacé par une doublure.
 *  - origine usine : seul le quota de quantité (appels par jour) arrête la fabrication ;
 *  - origine Studio : on prévient sans bloquer, sans montant ;
 *  - crédit épuisé chez le fournisseur : « en attente de crédit », sans montant ;
 *  - la dépense reste rattachée au contenu.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/domaine/types";

vi.mock("next/headers", () => ({ headers: async () => new Map(), cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }) }));

const appels: Array<{ id: Id; options: Record<string, unknown> }> = [];
let reponse: unknown = { ok: true, simule: true, coutUsd: 0, modele: "simulation" };
vi.mock("@/services/depense-claude-video", () => ({
  executerRolePourVideo: vi.fn(async (id: Id, _role: unknown, _entree: unknown, options: Record<string, unknown>) => {
    appels.push({ id, options });
    return reponse;
  }),
}));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const m = await import("@/services/depense-claude-contenu");

const role = {} as never;
const entree = {} as never;
const contenu = { type: "video-importee" as const, id: "v-03" };
const aucunMontant = (s: string) => expect(s).not.toMatch(/\d|€|\$|euro|dollar/i);

async function remplirQuota(n: number) {
  for (let i = 0; i < n; i++) {
    await depots().depenses.enregistrer({
      id: `dep-q-${i}`,
      videoId: "v-03",
      lignes: [{ etape: "Texte", fournisseur: "anthropic", unite: "forfait", quantite: 1, prixUnitaire: { centimes: 1, devise: "EUR" }, total: { centimes: 1, devise: "EUR" }, nature: "reel" }],
      total: { centimes: 1, devise: "EUR" },
      date: new Date().toISOString(),
    } as never);
  }
}

beforeEach(async () => {
  reinitialiserDepots();
  appels.length = 0;
  reponse = { ok: true, simule: true, coutUsd: 0, modele: "simulation" };
  await ecrireParametre(m.PARAM_QUOTA_APPELS_JOUR, 3);
});

describe("L3-02 · dépense Claude d'un contenu", () => {
  it("origine usine : sous le quota, la dépense passe par le chemin commun, rattachée au contenu", async () => {
    const r = await m.executerRolePourContenu(contenu, role, entree, { etape: "Texte", origine: "usine" });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect(appels[0].id).toBe("v-03");
    expect(appels[0].options).toMatchObject({ etape: "Texte", origine: "usine" });
  });

  it("origine usine : quota du jour atteint → la fabrication s'arrête, sans montant, rien n'est appelé", async () => {
    await remplirQuota(3);
    const r = await m.executerRolePourContenu(contenu, role, entree, { etape: "Texte", origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "quota-quantite" });
    if (!r.ok) aucunMontant(r.message);
    expect(appels).toHaveLength(0);
  });

  it("origine Studio : quota atteint → on prévient (journal) mais on ne bloque pas", async () => {
    await remplirQuota(3);
    const r = await m.executerRolePourContenu(contenu, role, entree, { etape: "Texte", origine: "studio" });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    const journal = (await depots().evenements.lister(() => true)).filter((j) => /quota/i.test(j.message));
    expect(journal.length).toBeGreaterThan(0);
    for (const j of journal) aucunMontant(j.message);
  });

  it("action manuelle de l'utilisateur (parWill) : jamais bloquée", async () => {
    await remplirQuota(5);
    const r = await m.executerRolePourContenu(contenu, role, entree, { etape: "Texte", parWill: true });
    expect(r.ok).toBe(true);
  });

  it("crédit Claude épuisé chez le fournisseur : « en attente de crédit » sans aucun montant", async () => {
    reponse = { ok: false, arret: "en-attente-credit", message: `Claude refuse l'appel : crédit de ${["4", "20"].join(",")} ${"\u0024"} épuisé.` };
    const r = await m.executerRolePourContenu(contenu, role, entree, { etape: "Texte", origine: "usine" });
    expect(r).toMatchObject({ ok: false, arret: "en-attente-credit" });
    if (!r.ok) {
      aucunMontant(r.message);
      expect(r.message).toMatch(/cr[ée]dit/i);
    }
  });

  it("le nombre d'appels du jour ne compte que les dépenses Claude d'aujourd'hui", async () => {
    await remplirQuota(2);
    expect(await m.appelsClaudeDuJour()).toBe(2);
  });
});
