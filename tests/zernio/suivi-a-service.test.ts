/** SUI-A : service du suivi et geste. Faux site, aucun réseau, valeurs fictives. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransportSite } from "@/fournisseurs/site/types";
import { ENV_SITE_FICTIF } from "./aides/site-cibles-factice";

vi.mock("server-only", () => ({}));
const exiger = vi.fn(async () => ({}));
vi.mock("@/services/auth", () => ({ exigerSession: () => exiger() }));
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const pm = await import("@/services/parcours-mot");
const S = await import("@/services/suivi-mots");

const T0 = Date.UTC(2026, 10, 12, 10, 0, 0);
const MIN = 60_000;
const env = ENV_SITE_FICTIF as unknown as Record<string, string>;
const corpsOk = {
  v: 1,
  genereLe: "2026-11-12T10:00:00.000Z",
  lignes: [
    {
      mot: "ESSAI",
      reseau: "instagram",
      postRef: null,
      versionTexte: null,
      cible: "gde-essai01",
      formulaires: { j7: 1, j30: 1, total: 1 },
      envois: { j7: 0, j30: 0, total: 0 },
      clics: { j7: 2, j30: 2, total: 2 },
    },
  ],
};
const lecture = {
  evenements: async () => [{ recuLe: "2026-11-11T10:00:00.000Z", motSeul: "ESSAI" }],
  conversations: async () => [],
};
let appels: { chemin: string; methode: string; corps: string }[] = [];
const site = (rep: () => Promise<{ statut: number; corps: unknown }>): TransportSite =>
  (async (r) => {
    appels.push({ chemin: r.chemin, methode: r.methode, corps: r.corps });
    return rep();
  }) as TransportSite;
const lire = (ms = T0) => S.lireTableauSuivi({ env, maintenantMs: ms, lecture });

beforeEach(() => {
  reinitialiserDepots();
  S.reinitialiserCacheSuivi();
  appels = [];
  exiger.mockClear();
  exiger.mockImplementation(async () => ({}));
});

describe("service", () => {
  it("lit le site en POST signé { v: 1 } et copie la réponse", async () => {
    pm.injecterTransportSite(site(async () => ({ statut: 200, corps: corpsOk })));
    const t = await lire();
    expect(appels).toEqual([
      { chemin: "/api/interne/compteurs-guide-reseau", methode: "POST", corps: '{"v":1}' },
    ]);
    expect(t.siteDisponible).toBe(true);
    expect(t.lignes[0].clics?.total).toBe(2);
    expect(
      await depots().parametres.lister((x) => x.id === S.PARAM_SUIVI_MIROIR),
    ).toHaveLength(1);
  });

  it.each([
    ["panne (exception)", async () => { throw new Error("coupure"); }],
    ["404", async () => ({ statut: 404, corps: { erreur: "introuvable" } })],
    ["503", async () => ({ statut: 503, corps: { erreur: "base_indisponible" } })],
    ["forme fausse", async () => ({ statut: 200, corps: { v: 1, genereLe: "x", lignes: [{ mot: "ESSAI" }] } })],
  ])("site en %s → siteDisponible false, aucune exception", async (_n, rep) => {
    pm.injecterTransportSite(site(rep as never));
    const t = await lire();
    expect(t.siteDisponible).toBe(false);
    expect(t.lignes[0].formulaires).toBeNull();
    expect(t.lignes[0].commentaires.total).toBe(1);
  });

  it("copie gardée 24 h après un échec, pause de 60 s", async () => {
    let ok = true;
    pm.injecterTransportSite(
      site(async () => (ok ? { statut: 200, corps: corpsOk } : { statut: 500, corps: {} })),
    );
    await lire(T0);
    ok = false;
    S.viderCacheTableauSuivi();
    // Copie fraîche (< 10 min) : aucun appel de plus.
    await lire(T0 + 5 * MIN);
    expect(appels).toHaveLength(1);
    S.viderCacheTableauSuivi();
    const t = await lire(T0 + 11 * MIN);
    expect(appels).toHaveLength(2);
    expect(t.siteDisponible).toBe(true);
    S.viderCacheTableauSuivi();
    await lire(T0 + 11 * MIN + 30_000);
    expect(appels).toHaveLength(2);
    S.viderCacheTableauSuivi();
    await lire(T0 + 12 * MIN + 1);
    expect(appels).toHaveLength(3);
    S.viderCacheTableauSuivi();
    expect((await lire(T0 + 25 * 60 * MIN)).siteDisponible).toBe(false);
  });

  it("écriture de la copie impossible : le site est lu, puis pause d'une minute", async () => {
    pm.injecterTransportSite(site(async () => ({ statut: 200, corps: corpsOk })));
    const ecriture = vi
      .spyOn(depots().parametres, "enregistrer")
      .mockRejectedValue(new Error("base coupée"));
    const t = await lire(T0);
    expect(t.siteDisponible).toBe(true);
    S.viderCacheTableauSuivi();
    // Pas de copie, site en pause : pas de nouvel appel, aucune exception.
    expect((await lire(T0 + 30_000)).siteDisponible).toBe(false);
    expect(appels).toHaveLength(1);
    S.viderCacheTableauSuivi();
    ecriture.mockRestore();
    expect((await lire(T0 + 61_000)).siteDisponible).toBe(true);
    expect(appels).toHaveLength(2);
  });

  it("cache mémoire de 60 s", async () => {
    pm.injecterTransportSite(site(async () => ({ statut: 200, corps: corpsOk })));
    const a = await lire(T0);
    expect(await lire(T0 + 30_000)).toBe(a);
    expect(await lire(T0 + 61_000)).not.toBe(a);
  });

  it("site non relié : siteDisponible false, aucun appel", async () => {
    pm.injecterTransportSite(site(async () => ({ statut: 200, corps: corpsOk })));
    const t = await S.lireTableauSuivi({ env: {}, maintenantMs: T0, lecture });
    expect(t.siteDisponible).toBe(false);
    expect(appels).toHaveLength(0);
  });
});

describe("geste", () => {
  it("sans session : refus et 0 lecture", async () => {
    exiger.mockImplementation(async () => {
      throw new Error("non_connecte");
    });
    const lecteur = vi.spyOn(depots().evenementsFournisseurs, "lister");
    const G = await import("@/services/suivi-mots-gestes");
    await expect(G.gesteLireTableauSuivi()).rejects.toThrow("non_connecte");
    expect(lecteur).not.toHaveBeenCalled();
    expect(
      await depots().parametres.lister((x) => x.id === S.PARAM_SUIVI_MIROIR),
    ).toEqual([]);
    expect(appels).toHaveLength(0);
  });
  it("avec session : exige la session puis lit", async () => {
    pm.injecterTransportSite(site(async () => ({ statut: 200, corps: corpsOk })));
    const G = await import("@/services/suivi-mots-gestes");
    const t = await G.gesteLireTableauSuivi();
    expect(exiger).toHaveBeenCalledTimes(1);
    expect(t.lignes).toEqual([]);
  });
});
