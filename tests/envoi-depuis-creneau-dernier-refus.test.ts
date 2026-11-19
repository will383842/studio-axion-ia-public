/**
 * Dernière raison de refus par clé d'envoi + « à compléter » (texte vide). Doublures pures : aucun appel réel. Données fictives.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "./helpers/next-mocks";
import type { Depot } from "@/domaine/depots";
import type { EnvoiPlanifie } from "@/domaine/envoi-planifie";
import { cleEnvoi } from "@/domaine/envoi-planifie";
import type { EtatsPromotion, NotificationPromotion } from "@/services/promotion-envois";
import { envoyerDepuisCreneau, lireDernierRefus, type CreneauCalendrier, type DepsEnvoiCreneau } from "@/services/envoi-depuis-creneau";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const NOW = Date.parse("2026-11-20T08:00:00Z");

function depot(): Depot<EnvoiPlanifie> {
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

const creneau = (p: Partial<CreneauCalendrier> = {}): CreneauCalendrier => ({
  id: "c1", videoId: "v1", nature: "visuel", reseau: "linkedin", versionCreneau: 1, jour: "2026-11-20", heure: "12:00", statut: "valide",
  valideeLe: "2026-11-19T10:00:00Z", valideePar: "le fondateur", texte: "Texte d'exemple", ...p,
});
const CLE = cleEnvoi("v1", "linkedin", 1);

function monter(o: { ouvert?: boolean; creneau?: CreneauCalendrier; envoyer?: () => Promise<void> } = {}) {
  const table = new Map<string, string>();
  const etats: EtatsPromotion = { async lire(c) { return table.get(c); }, async noter(c, v) { table.set(c, v); } };
  const notifications: NotificationPromotion[] = [];
  const ordre: string[] = [];
  const noter = etats.noter.bind(etats);
  etats.noter = async (c, v) => { ordre.push(c); await noter(c, v); };
  const envoyerReel = vi.fn(async () => { await o.envoyer?.(); });
  const ouvert = o.ouvert ?? true;
  const deps = {
    depot: depot(),
    creneaux: async () => [o.creneau ?? creneau()],
    client: { lectureExigee: () => false, listerPosts: async () => [] } as never,
    reglages: { envoiAutorise: async () => ouvert, envoiCalendrierAutorise: async () => ouvert, editorialeActive: async () => ouvert },
    maintenant: () => NOW,
    etats,
    notifier: async (n) => { notifications.push(n); },
    envoyerReel,
  } as DepsEnvoiCreneau;
  return { deps, table, etats, notifications, envoyerReel, ordre };
}

describe("dernier refus par clé d'envoi", () => {
  it("refus avant le réseau : raison gardée, instant écrit avant la raison", async () => {
    const m = monter();
    m.envoyerReel.mockImplementation(async () => { throw Object.assign(new Error("Cochez la page de destination."), { code: "CIBLE_INCONNUE" }); });
    const l = await envoyerDepuisCreneau(m.deps, "c1");
    expect(l?.etat).toBe("refuse");
    expect(m.table.get(`dernier-refus:${CLE}`)).toBe("Cochez la page de destination.");
    expect(m.table.get(`dernier-refus-le:${CLE}`)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(m.ordre.indexOf(`dernier-refus-le:${CLE}`)).toBeLessThan(m.ordre.indexOf(`dernier-refus:${CLE}`));
    expect(await lireDernierRefus(m.etats, CLE)).toEqual({ raison: "Cochez la page de destination.", le: expect.any(String) });
  });

  it("la raison est tronquée à 300 signes", async () => {
    const m = monter();
    m.envoyerReel.mockImplementation(async () => { throw Object.assign(new Error("x".repeat(500)), { code: "CIBLE_INCONNUE" }); });
    await envoyerDepuisCreneau(m.deps, "c1");
    expect(m.table.get(`dernier-refus:${CLE}`)).toHaveLength(300);
  });

  it("« envoi-eteint » : rien n'est écrit", async () => {
    const m = monter({ ouvert: false });
    const l = await envoyerDepuisCreneau(m.deps, "c1");
    expect(l?.etat).toBe("envoi-eteint");
    expect([...m.table.keys()].filter((k) => k.startsWith("dernier-refus"))).toEqual([]);
    expect(await lireDernierRefus(m.etats, CLE)).toBeUndefined();
  });

  it("heure absente : raison gardée", async () => {
    const m = monter({ creneau: creneau({ heure: undefined }) });
    await envoyerDepuisCreneau(m.deps, "c1");
    expect(m.table.get(`dernier-refus:${CLE}`)).toMatch(/heure absente/);
  });

  it("après un brouillon créé, la raison est remise à vide", async () => {
    const m = monter();
    m.envoyerReel.mockImplementationOnce(async () => { throw Object.assign(new Error("Refus un."), { code: "CIBLE_INCONNUE" }); });
    await envoyerDepuisCreneau(m.deps, "c1");
    expect(m.table.get(`dernier-refus:${CLE}`)).toBe("Refus un.");
    const l = await envoyerDepuisCreneau(m.deps, "c1");
    expect(l?.etat).toBe("brouillon-cree");
    expect(m.table.get(`dernier-refus:${CLE}`)).toBe("");
    expect(await lireDernierRefus(m.etats, CLE)).toBeUndefined();
  });

  it("« a-corriger » ne remplace pas la raison précédente", async () => {
    const m = monter();
    m.envoyerReel.mockImplementation(async () => { throw Object.assign(new Error("Vraie raison."), { code: "CIBLE_INCONNUE" }); });
    await envoyerDepuisCreneau(m.deps, "c1");
    await envoyerDepuisCreneau(m.deps, "c1");
    const l = await envoyerDepuisCreneau(m.deps, "c1");
    expect(l?.etat).toBe("a-corriger");
    expect(m.table.get(`dernier-refus:${CLE}`)).toBe("Vraie raison.");
  });
});

describe("« à compléter » : texte vide", () => {
  it("aucun appel, aucun essai consommé, une seule notification sur deux passages", async () => {
    const m = monter({ creneau: creneau({ texte: "  " }) });
    const l1 = await envoyerDepuisCreneau(m.deps, "c1");
    const l2 = await envoyerDepuisCreneau(m.deps, "c1");
    expect(l1?.etat).toBe("a-completer");
    expect(l2?.etat).toBe("a-completer");
    expect(l1?.raison).toBe("Légende à écrire : ouvrez le carrousel et écrivez sa légende. Rien n'est envoyé sans elle.");
    expect(m.envoyerReel).not.toHaveBeenCalled();
    expect(m.table.has(`essais:${CLE}`)).toBe(false);
    expect(await m.deps.depot.compter()).toBe(0);
    expect(m.notifications).toHaveLength(1);
    expect(m.table.get(`dernier-refus:${CLE}`)).toBe(l1?.raison);
  });

  it("porte fermée : « envoi-eteint » prime, rien n'est écrit", async () => {
    const m = monter({ ouvert: false, creneau: creneau({ texte: "" }) });
    expect((await envoyerDepuisCreneau(m.deps, "c1"))?.etat).toBe("envoi-eteint");
    expect(m.notifications).toHaveLength(0);
  });
});
