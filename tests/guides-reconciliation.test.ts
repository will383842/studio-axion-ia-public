import { describe, expect, it, vi } from "vitest";
import type { ReponseSite, RequeteSignee } from "@/fournisseurs/site/types";
import { CHEMIN_VERSIONS_GUIDES, PARAM_RECONCILIATION, guidesReconciliationActif, reconcilierGuides, versionsStudioDepuisParametres, type DepsReconciliation } from "@/services/guides-reconciliation";

const h = (c: string) => c.repeat(64);
const A = "gde-aaaaaaaa";
const B = "gde-bbbbbbbb";
const ligne = (code: string, version: number, o: Record<string, unknown> = {}) => ({ code, version, sha256Texte: h("a"), statut: "pret", sha256Pdf: h("b"), tailleOctets: 99, ...o });

function monter(reponse: (r: RequeteSignee) => ReponseSite | Promise<ReponseSite>, o: { studio?: DepsReconciliation["lireVersionsStudio"]; relie?: boolean; env?: Record<string, string> } = {}) {
  const magasin = new Map<string, unknown>();
  const appels: RequeteSignee[] = [];
  const transport = vi.fn(async (r: RequeteSignee) => {
    appels.push(r);
    return reponse(r);
  });
  const journal: string[] = [];
  const d: DepsReconciliation = {
    env: o.env ?? { GUIDES_RECONCILIATION_ENABLED: "true" },
    transport: () => (o.relie === false ? null : { transport, secret: "s".repeat(40) }),
    lireVersionsStudio: o.studio ?? (async () => [{ code: A, version: 1, empreinte: h("a") }]),
    lireParametre: async (id) => magasin.get(id) ?? null,
    ecrireParametre: async (id, v) => void magasin.set(id, v),
    journaliser: async (t, m) => void journal.push(`${t}|${m}`),
    maintenantMs: () => Date.UTC(2026, 10, 15, 10, 0, 0),
  };
  return { d, transport, appels, magasin, journal };
}

describe("G6 · interrupteur GUIDES_RECONCILIATION_ENABLED", () => {
  it("éteint par défaut : seul « true » allume", () => {
    expect(guidesReconciliationActif({})).toBe(false);
    for (const v of ["1", "TRUE", "True", " true", "true ", "", "false", "yes"]) expect(guidesReconciliationActif({ GUIDES_RECONCILIATION_ENABLED: v })).toBe(false);
    expect(guidesReconciliationActif({ GUIDES_RECONCILIATION_ENABLED: "true" + " ".repeat(500) })).toBe(false);
    expect(guidesReconciliationActif({ GUIDES_RECONCILIATION_ENABLED: "true" })).toBe(true);
  });
  it("éteint = 0 appel réseau, rien lu, rien écrit", async () => {
    const m = monter(() => ({ statut: 200, corps: [] }), { env: {} });
    const lire = vi.fn(m.d.lireVersionsStudio);
    const r = await reconcilierGuides({ ...m.d, lireVersionsStudio: lire });
    expect(r).toEqual({ ok: false, raison: "interrupteur_eteint" });
    expect(m.transport).not.toHaveBeenCalled();
    expect(lire).not.toHaveBeenCalled();
    expect(m.magasin.size).toBe(0);
  });
});

describe("G6 · passage allumé", () => {
  it("un GET signé par guide, jamais d'écriture vers le site, aucun écart quand tout concorde", async () => {
    const m = monter(() => ({ statut: 200, corps: [ligne(A, 1)] }));
    const r = await reconcilierGuides(m.d);
    expect(r).toEqual({ ok: true, etat: "compare", ecarts: [], codesRestants: 0 });
    expect(m.appels).toHaveLength(1);
    expect(m.appels[0].methode).toBe("GET");
    expect(m.appels[0].corps).toBe("");
    expect(m.appels[0].chemin).toBe(`${CHEMIN_VERSIONS_GUIDES}?code=${A}`);
    expect(Object.keys(m.appels[0].entetes).sort()).toEqual(["x-axion-horodatage", "x-axion-nonce", "x-axion-signature"]);
    const mem = m.magasin.get(PARAM_RECONCILIATION) as { dernierPassage: string; etat: string; ecarts: unknown[] };
    expect(mem).toMatchObject({ dernierPassage: "2026-11-15T10:00:00.000Z", etat: "compare", ecarts: [] });
  });
  it("affiche les écarts et les mémorise, sans texte", async () => {
    const m = monter(() => ({ statut: 200, corps: [ligne(A, 1, { sha256Texte: h("c") })] }));
    const r = await reconcilierGuides(m.d);
    expect(r).toMatchObject({ ok: true, etat: "compare", ecarts: [{ type: "empreinte_differente", code: A, version: 1 }] });
    expect(JSON.stringify(m.magasin.get(PARAM_RECONCILIATION))).not.toMatch(/titre|paragraphes/);
  });
  it("ignore une ligne d'un autre guide et les lignes illisibles, en les comptant", async () => {
    const m = monter(() => ({ statut: 200, corps: [ligne(A, 1), ligne(B, 1), { x: 1 }] }));
    const r = await reconcilierGuides(m.d);
    expect(r).toEqual({ ok: true, etat: "compare", ecarts: [], codesRestants: 0 });
    expect((m.magasin.get(PARAM_RECONCILIATION) as { lignesIgnorees: number }).lignesIgnorees).toBe(2);
  });
  it("plusieurs guides : un appel chacun, dans l'ordre des codes", async () => {
    const m = monter((r) => ({ statut: 200, corps: [ligne(r.chemin.endsWith(A) ? A : B, 1)] }), {
      studio: async () => [
        { code: B, version: 1, empreinte: h("a") },
        { code: A, version: 1, empreinte: h("a") },
        { code: A, version: 2, empreinte: h("a") },
      ],
    });
    const r = await reconcilierGuides(m.d);
    expect(m.appels.map((a) => a.chemin.slice(-12))).toEqual([A, B]);
    expect(r).toMatchObject({ ok: true, ecarts: [{ type: "version_en_retard", code: A, version: 2 }] });
  });
  it("aucun guide au Studio : aucun appel", async () => {
    const m = monter(() => ({ statut: 200, corps: [] }), { studio: async () => [] });
    expect(await reconcilierGuides(m.d)).toEqual({ ok: true, etat: "compare", ecarts: [], codesRestants: 0 });
    expect(m.transport).not.toHaveBeenCalled();
  });
});

describe("G6 · pannes du site", () => {
  it("404 = « site pas prêt », pas une erreur ; un seul appel", async () => {
    const m = monter(() => ({ statut: 404, corps: null }), { studio: async () => [{ code: A, version: 1, empreinte: h("a") }, { code: B, version: 1, empreinte: h("a") }] });
    expect(await reconcilierGuides(m.d)).toEqual({ ok: true, etat: "site_pas_pret" });
    expect(m.appels).toHaveLength(1);
    expect(m.magasin.get(PARAM_RECONCILIATION)).toMatchObject({ etat: "site_pas_pret", ecarts: [] });
  });
  it("404 de route absente : l'ancien dernierPassage est gardé, les écarts déjà connus ne sont PAS remplacés par une liste vide", async () => {
    const m = monter(() => ({ statut: 404, corps: null }));
    const connus = [{ type: "manquant_au_site", code: A, version: 1 }];
    m.magasin.set(PARAM_RECONCILIATION, { dernierPassage: "2026-11-14T00:00:00.000Z", etat: "compare", guidesLus: 1, lignesIgnorees: 0, ecarts: connus, ecartsTronques: false });
    expect(await reconcilierGuides(m.d)).toEqual({ ok: true, etat: "site_pas_pret" });
    expect(m.magasin.get(PARAM_RECONCILIATION)).toMatchObject({ etat: "site_pas_pret", dernierPassage: "2026-11-14T00:00:00.000Z", guidesLus: 1, ecarts: connus });
  });
  it("404 isolé sur le 2e code : passage arrêté en « site pas prêt », écarts connus gardés", async () => {
    const m = monter((r) => (r.chemin.endsWith(B) ? { statut: 404, corps: null } : { statut: 200, corps: [] }), { studio: async () => [{ code: A, version: 1, empreinte: h("a") }, { code: B, version: 1, empreinte: h("a") }] });
    const connus = [{ type: "empreinte_differente", code: A, version: 1 }];
    m.magasin.set(PARAM_RECONCILIATION, { dernierPassage: null, etat: "compare", guidesLus: 2, lignesIgnorees: 0, ecarts: connus, ecartsTronques: false });
    expect(await reconcilierGuides(m.d)).toEqual({ ok: true, etat: "site_pas_pret" });
    expect(m.magasin.get(PARAM_RECONCILIATION)).toMatchObject({ etat: "site_pas_pret", ecarts: connus });
  });
  it("contrat : code inconnu du site = 200 + liste vide → « manquant_au_site » (ce n'est pas un 404)", async () => {
    const m = monter(() => ({ statut: 200, corps: [] }));
    expect(await reconcilierGuides(m.d)).toEqual({ ok: true, etat: "compare", ecarts: [{ type: "manquant_au_site", code: A, version: 1, empreinteStudio: "a".repeat(12) }], codesRestants: 0 });
    expect(m.magasin.get(PARAM_RECONCILIATION)).toMatchObject({ etat: "compare" });
  });
  it("503 : site indisponible, les écarts connus et le dernier passage sont gardés", async () => {
    const m = monter(() => ({ statut: 503, corps: null }));
    m.magasin.set(PARAM_RECONCILIATION, { dernierPassage: "2026-11-14T00:00:00.000Z", etat: "compare", guidesLus: 1, lignesIgnorees: 0, ecarts: [{ type: "manquant_au_site", code: A, version: 1 }], ecartsTronques: false });
    expect(await reconcilierGuides(m.d)).toEqual({ ok: false, raison: "site_indisponible" });
    expect(m.magasin.get(PARAM_RECONCILIATION)).toMatchObject({ etat: "site_indisponible", dernierPassage: "2026-11-14T00:00:00.000Z", ecarts: [{ type: "manquant_au_site" }] });
  });
  it("401, 500 et transport qui lève : indisponible", async () => {
    for (const rep of [() => ({ statut: 401, corps: null }), () => ({ statut: 500, corps: null }), () => { throw new Error("réseau"); }]) {
      const m = monter(rep);
      expect(await reconcilierGuides(m.d)).toEqual({ ok: false, raison: "site_indisponible" });
    }
  });
  it("délai : le site qui ne répond pas est coupé", async () => {
    vi.useFakeTimers();
    try {
      const m = monter(() => new Promise<ReponseSite>(() => {}));
      const p = reconcilierGuides(m.d);
      await vi.advanceTimersByTimeAsync(3_100);
      expect(await p).toEqual({ ok: false, raison: "site_indisponible" });
    } finally {
      vi.useRealTimers();
    }
  });
  it("réponse qui n'est pas une liste : illisible", async () => {
    const m = monter(() => ({ statut: 200, corps: { versions: [] } }));
    expect(await reconcilierGuides(m.d)).toEqual({ ok: false, raison: "reponse_illisible" });
  });
  it("site non relié : aucun appel", async () => {
    const m = monter(() => ({ statut: 200, corps: [] }), { relie: false });
    expect(await reconcilierGuides(m.d)).toEqual({ ok: false, raison: "site_non_relie" });
    expect(m.transport).not.toHaveBeenCalled();
  });
  it("lecture du Studio en panne : résultat d'échec, aucun appel", async () => {
    const m = monter(() => ({ statut: 200, corps: [] }), { studio: async () => { throw new Error("base"); } });
    expect(await reconcilierGuides(m.d)).toEqual({ ok: false, raison: "studio_illisible" });
    expect(m.transport).not.toHaveBeenCalled();
  });
  it("le journal ne contient ni texte ni empreinte", async () => {
    const m = monter(() => ({ statut: 200, corps: [ligne(A, 1, { sha256Texte: h("c") })] }));
    await reconcilierGuides(m.d);
    expect(m.journal.join("\n")).not.toMatch(/[0-9a-f]{12}/);
  });
});

describe("G6 · versions du Studio", () => {
  it("ne retient que les versions « Validé » d'un paramètre qui porte un code gde-", () => {
    const v = versionsStudioDepuisParametres([
      { code: A, versions: [{ version: 1, statut: "Validé", empreinte: h("a") }, { version: 2, statut: "À valider", empreinte: h("b") }] },
      { versions: [{ version: 1, statut: "Validé", empreinte: h("a") }] },
      { code: "pas-un-code", versions: [{ version: 1, statut: "Validé", empreinte: h("a") }] },
      null,
      "x",
    ]);
    expect(v).toEqual([{ code: A, version: 1, empreinte: h("a") }]);
  });
});

describe("G6 · plafond de codes par passage", () => {
  it("au-delà de 200 codes : seules les versions Studio des codes interrogés sont comparées (pas de faux manquant_au_site)", async () => {
    const codes = Array.from({ length: 205 }, (_, i) => `gde-cle${String(i).padStart(4, "0")}`);
    const m = monter((r) => {
      const code = decodeURIComponent(r.chemin.split("code=")[1]);
      return { statut: 200, corps: [ligne(code, 1)] };
    }, { studio: async () => codes.map((c) => ({ code: c, version: 1, empreinte: h("a") })) });
    const r = await reconcilierGuides(m.d);
    expect(m.appels).toHaveLength(200);
    expect(r).toEqual({ ok: true, etat: "compare", ecarts: [], codesRestants: 5 });
    expect(m.magasin.get(PARAM_RECONCILIATION)).toMatchObject({ etat: "compare", guidesLus: 200, ecarts: [], codesRestants: 5, curseur: codes[199] });
  });
  it("rotation : le 2e passage reprend après le curseur, atteint les codes au-delà de 200, puis boucle au début", async () => {
    const codes = Array.from({ length: 205 }, (_, i) => `gde-cle${String(i).padStart(4, "0")}`);
    const m = monter((r) => ({ statut: 200, corps: [ligne(decodeURIComponent(r.chemin.split("code=")[1]), 1)] }), { studio: async () => codes.map((c) => ({ code: c, version: 1, empreinte: h("a") })) });
    await reconcilierGuides(m.d);
    m.appels.length = 0;
    const r2 = await reconcilierGuides(m.d);
    const vus = m.appels.map((a) => decodeURIComponent(a.chemin.split("code=")[1]));
    expect(vus).toHaveLength(200);
    expect(vus.slice(0, 5)).toEqual(codes.slice(200)); // les 5 derniers, jamais vus avant
    expect(vus[5]).toBe(codes[0]); // puis boucle au début
    expect(r2).toMatchObject({ ok: true, codesRestants: 5 });
    expect(m.magasin.get(PARAM_RECONCILIATION)).toMatchObject({ curseur: codes[194] });
  });
  it("les écarts des codes non interrogés sont conservés, ceux des codes interrogés sont recalculés", async () => {
    const codes = Array.from({ length: 205 }, (_, i) => `gde-cle${String(i).padStart(4, "0")}`);
    const m = monter(() => ({ statut: 200, corps: [] }), { studio: async () => codes.map((c) => ({ code: c, version: 1, empreinte: h("a") })) });
    const ancienLoin = { type: "empreinte_differente", code: codes[202], version: 1 };
    m.magasin.set(PARAM_RECONCILIATION, { dernierPassage: null, etat: "compare", guidesLus: 0, lignesIgnorees: 0, ecarts: [ancienLoin, { type: "empreinte_differente", code: codes[0], version: 1 }], ecartsTronques: false, curseur: null, codesRestants: 5 });
    const r = await reconcilierGuides(m.d);
    expect(r.ok && r.etat === "compare" && r.ecarts).toContainEqual(ancienLoin);
    expect(r.ok && r.etat === "compare" && r.ecarts.filter((e) => e.code === codes[0])).toHaveLength(1);
    expect(r.ok && r.etat === "compare" && r.ecarts.filter((e) => e.type === "empreinte_differente")).toHaveLength(1 + 0);
  });
});
