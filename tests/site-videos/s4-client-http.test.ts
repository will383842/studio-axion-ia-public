/** S4.11 — le vrai client HTTP du site, éprouvé contre le site factice par un `fetch` injecté. Jamais branché, jamais de réseau. */
import { describe, expect, it, vi } from "vitest";
import type { CorpsPasseport } from "@/domaine/site-videos/contrat";
import { creerFournisseurSiteHttp, DELAI_SITE_MS, siteHttpDepuisEnv } from "@/fournisseurs/site/http";
import { creerSiteFactice } from "@/fournisseurs/site/simulation";
import { ErreurSite } from "@/fournisseurs/site/types";
import { corpsExemple } from "./helpers-contrat";

const SECRET = "secret-client-http";
const T0 = Date.UTC(2026, 9, 18, 10, 0, 0);
const BASE = "https://site-factice.invalid";

function monde(options: { secret?: string; delaiMs?: number } = {}) {
  const factice = creerSiteFactice({ secret: SECRET, maintenant: () => T0 });
  const appels: { url: string; methode: string; entetes: Record<string, string>; corps: string }[] = [];
  const fetchEspion = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url: String(url), methode: String(init?.method), entetes: Object.fromEntries(new Headers(init?.headers).entries()), corps: String(init?.body ?? "") });
    return factice.fetch(url, init);
  }) as typeof fetch;
  const client = creerFournisseurSiteHttp({ url: BASE, secret: options.secret ?? SECRET, fetch: fetchEspion, maintenant: () => T0, ...(options.delaiMs ? { delaiMs: options.delaiMs } : {}) });
  return { factice, appels, client };
}
const corps = (c: Partial<CorpsPasseport> = {}): CorpsPasseport => ({ ...corpsExemple(), ...c });

describe("S4.11 le client réel contre le site factice", () => {
  it("lit les réglages, publie, republie sans doublon, retire : mêmes résultats que la simulation", async () => {
    const { client, factice } = monde();
    expect(client.mode).toBe("reel");
    expect(await client.lireReglages()).toEqual({ certifexempleCertificationObtenue: false, avisPublies: false });
    const a = await client.publier(corps());
    expect(a).toMatchObject({ statut: "publiee", inchange: false, url: `${BASE}/fr/videos/automatiser-ses-devis-en-10-minutes` });
    expect((await client.publier(corps())).inchange).toBe(true);
    expect(factice.pages.size).toBe(1);
    expect(await client.retirer("vid_exemple")).toEqual({ statut: "retiree" });
    expect(await client.retirer("vid_jamais_vue")).toEqual({ statut: "inconnue" });
    expect(factice.statutPage("vid_exemple")).toBe(410);
  });

  it("les en-têtes, la méthode et l'adresse : signature complète, JSON, chemin exact", async () => {
    const { client, appels } = monde();
    await client.publier(corps());
    const a = appels[0];
    expect(a.url).toBe(`${BASE}/api/interne/videos`);
    expect(a.methode).toBe("POST");
    expect(a.entetes["x-axion-horodatage"]).toBe(String(T0 / 1000));
    expect(a.entetes["x-axion-nonce"]).toMatch(/^[0-9a-f]{32}$/);
    expect(a.entetes["x-axion-signature"]).toMatch(/^[0-9a-f]{64}$/);
    expect(a.entetes["content-type"]).toBe("application/json");
    expect(JSON.parse(a.corps).idStudio).toBe("vid_exemple");
    await client.retirer("vid_exemple");
    expect(appels[1].url).toBe(`${BASE}/api/interne/videos/vid_exemple`);
    expect(appels[1].methode).toBe("DELETE");
    await client.lireReglages();
    expect(appels[2].url).toBe(`${BASE}/api/interne/videos/reglages`);
    expect(appels[2].methode).toBe("GET");
  });

  it("une adresse de base avec « / » final ne double pas la barre", async () => {
    const factice = creerSiteFactice({ secret: SECRET, maintenant: () => T0 });
    const vues: string[] = [];
    const f = (async (url: string | URL | Request, init?: RequestInit) => {
      vues.push(String(url));
      return factice.fetch(url, init);
    }) as typeof fetch;
    await creerFournisseurSiteHttp({ url: `${BASE}/`, secret: SECRET, fetch: f, maintenant: () => T0 }).lireReglages();
    expect(vues[0]).toBe(`${BASE}/api/interne/videos/reglages`);
  });

  it("chaque appel porte un nonce neuf", async () => {
    const { client, appels } = monde();
    await client.lireReglages();
    await client.lireReglages();
    expect(appels[0].entetes["x-axion-nonce"]).not.toBe(appels[1].entetes["x-axion-nonce"]);
  });
});

describe("S4.11 les réponses du site deviennent des phrases", () => {
  it("401 : signature refusée (mauvais secret)", async () => {
    const { client } = monde({ secret: "autre-secret" });
    const e = await client.lireReglages().catch((x) => x);
    expect(e).toBeInstanceOf(ErreurSite);
    expect(e).toMatchObject({ code: "signature", statut: 401 });
    expect(e.message).toContain("signature");
  });

  it("409 : le site a une version plus récente", async () => {
    const { client } = monde();
    await client.publier(corps({ versionPasseport: 5 }));
    await expect(client.publier(corps({ versionPasseport: 2 }))).rejects.toMatchObject({ code: "conflit", statut: 409, message: "Le site a déjà une version plus récente de cette vidéo." });
  });

  it("422 : la liste des erreurs du site est reprise", async () => {
    const { client } = monde();
    const e = await client.publier(corps({ titre: "" })).catch((x) => x);
    expect(e).toMatchObject({ code: "invalide", statut: 422 });
    expect(e.erreurs.length).toBeGreaterThan(0);
    expect(e.message).toContain("Le site refuse cette page");
  });

  it("410 : page retirée", async () => {
    const f = (async () => new Response(JSON.stringify({ erreur: "retirée" }), { status: 410 })) as typeof fetch;
    const client = creerFournisseurSiteHttp({ url: BASE, secret: SECRET, fetch: f, maintenant: () => T0 });
    await expect(client.publier(corps())).rejects.toMatchObject({ code: "retiree", statut: 410 });
  });

  it("5xx : « le site a eu un souci », sans le texte brut du site", async () => {
    const { client, factice } = monde();
    factice.panne = "500";
    const e = await client.lireReglages().catch((x) => x);
    expect(e).toMatchObject({ code: "serveur", statut: 500 });
    expect(e.message).toBe("Le site a eu un souci : réessayez dans quelques minutes.");
  });

  it("réponse qui n'est pas du JSON, ou site injoignable : phrases claires, jamais une exception brute", async () => {
    const html = (async () => new Response("<html>Bad gateway</html>", { status: 502 })) as typeof fetch;
    await expect(creerFournisseurSiteHttp({ url: BASE, secret: SECRET, fetch: html, maintenant: () => T0 }).lireReglages()).rejects.toMatchObject({ code: "serveur" });
    const coupe = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const e = await creerFournisseurSiteHttp({ url: BASE, secret: SECRET, fetch: coupe, maintenant: () => T0 }).publier(corps()).catch((x) => x);
    expect(e).toMatchObject({ code: "injoignable" });
    expect(e.message).toContain("Le site ne répond pas");
    expect(e.message).not.toContain("fetch failed");
  });
});

describe("S4.11 délai borné", () => {
  it("le délai par défaut est de 10 s (AbortSignal.timeout)", async () => {
    expect(DELAI_SITE_MS).toBe(10_000);
    const espion = vi.spyOn(AbortSignal, "timeout");
    const { client } = monde();
    await client.lireReglages();
    expect(espion).toHaveBeenCalledWith(10_000);
    espion.mockRestore();
  });

  it("un site qui ne répond jamais : l'appel est coupé au délai, erreur « injoignable »", async () => {
    const { client, factice } = monde({ delaiMs: 40 });
    factice.panne = "lent";
    const t = Date.now();
    const e = await client.lireReglages().catch((x) => x);
    expect(e).toMatchObject({ code: "injoignable" });
    expect(Date.now() - t).toBeLessThan(2000);
  });
});

describe("S4.11 inscription au registre : prévue, jamais branchée", () => {
  it("variables absentes, incomplètes ou adresse non-http : aucun client (« à relier »), aucun appel possible", () => {
    expect(siteHttpDepuisEnv({})).toEqual({});
    expect(siteHttpDepuisEnv({ SITE_VIDEOS_URL: BASE })).toEqual({});
    expect(siteHttpDepuisEnv({ SITE_VIDEOS_SECRET: SECRET })).toEqual({});
    expect(siteHttpDepuisEnv({ SITE_VIDEOS_URL: "axion-ia.com", SITE_VIDEOS_SECRET: SECRET })).toEqual({});
    expect(siteHttpDepuisEnv({ SITE_VIDEOS_URL: BASE, SITE_VIDEOS_SECRET: "   " })).toEqual({});
  });

  it("variables présentes : le client « http » est inscrit, en mode réel", () => {
    const r = siteHttpDepuisEnv({ SITE_VIDEOS_URL: BASE, SITE_VIDEOS_SECRET: SECRET });
    expect(Object.keys(r)).toEqual(["http"]);
    expect(r.http.mode).toBe("reel");
    expect(r.http.type).toBe("site");
  });

  it("par défaut, le registre garde la simulation : le client réel n'est choisi que par le réglage « fournisseur.site »", async () => {
    vi.stubEnv("SITE_VIDEOS_URL", BASE);
    vi.stubEnv("SITE_VIDEOS_SECRET", SECRET);
    vi.resetModules();
    const registre = await import("@/fournisseurs");
    expect(registre.resoudreFournisseur("site", null).mode).toBe("simulation");
    expect(registre.etatConnexion("site", null)).toBe("simulation");
    expect(registre.resoudreFournisseur("site", "http").mode).toBe("reel");
    vi.unstubAllEnvs();
    vi.resetModules();
    const sans = await import("@/fournisseurs");
    expect(sans.resoudreFournisseur("site", "http").mode).toBe("simulation");
    expect(sans.etatConnexion("site", "http")).toBe("a-relier");
  });
});
