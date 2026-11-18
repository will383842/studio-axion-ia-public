/**
 * L8-02a : lecteur de statistiques par liste et par période. Faux client (seule `requete` répond), fixtures copiées
 * des exemples de docs/zernio/openapi-extrait-1.418.1.json (chemin /v1/analytics), identifiants neutres, aucun appel réel.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ClientZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { valeursDepuisAnalyticsZernio } from "@/fournisseurs/mesures/zernio";
import {
  ETENDUE_MAX_JOURS,
  PAGES_STATISTIQUES_MAX,
  TAILLE_PAGE_STATISTIQUES,
  lirePageStatistiques,
  lireStatistiquesPeriode,
  pageDepuisListe,
  statistiquesDepuisPost,
} from "@/services/lecteur-statistiques";

const analytics = (extra: Record<string, unknown> = {}) => ({
  impressions: 15420, reach: 12350, likes: 342, comments: 28, shares: 45, saves: 7, clicks: 189, views: 14000, engagementRate: 2.78, lastUpdated: "2024-11-02T08:30:00Z", ...extra,
});
const post = (extra: Record<string, unknown> = {}, a: Record<string, unknown> | null = analytics()) => ({
  _id: "id-diffuseur-1", latePostId: "id-studio-1", content: "Texte du post à ne jamais garder", scheduledFor: "2024-11-01T10:00:00Z", publishedAt: "2024-11-01T10:00:05Z", status: "published",
  ...(a ? { analytics: a } : {}),
  platforms: [{ platform: "instagram", status: "published", platformPostId: "0", accountId: "compte-neutre", accountUsername: "@compte-neutre", syncStatus: "synced", platformPostUrl: "https://www.instagram.com/reel/ABC123xyz/", errorMessage: "message du diffuseur" }],
  platform: "instagram", platformPostUrl: "https://www.instagram.com/reel/ABC123xyz/", isExternal: true, thumbnailUrl: "https://stockage.exemple/vignette.jpg", mediaType: "carousel",
  mediaItems: [{ type: "image", url: "https://stockage.exemple/diapo1.jpg", thumbnail: "https://stockage.exemple/diapo1.jpg" }], syncStatus: "synced",
  ...extra,
});
const liste = (n: number) => ({ overview: { totalPosts: n }, posts: Array.from({ length: n }, (_, i) => post({ _id: `id-${i}`, latePostId: `studio-${i}` })), pagination: { page: 1, limit: 50 } });

type Appel = { methode: string; chemin: string; query?: Record<string, unknown>; corps?: unknown };
type Reponse = { statut: number; corps?: unknown } | Error;
function fauxClient(reponses: Reponse[]) {
  const appels: Appel[] = [];
  const interdite = (nom: string) => () => { throw new Error(`méthode interdite appelée : ${nom}`); };
  const base = {
    async requete(req: Appel) {
      appels.push(req);
      const r = reponses[Math.min(appels.length - 1, reponses.length - 1)];
      if (r instanceof Error) throw r;
      return { statut: r.statut, corps: r.corps, route: "analytics" };
    },
  };
  const client = new Proxy(base, { get: (c, nom: string) => (nom in c ? (c as Record<string, unknown>)[nom] : interdite(nom)) }) as unknown as Pick<ClientZernio, "requete">;
  return { client, appels };
}
const erreur = (statut: number, code: ConstructorParameters<typeof ErreurZernio>[0]) => new ErreurZernio(code, "message du diffuseur", { statut });
const PERIODE = { du: "2024-11-01", au: "2024-11-30" };

describe("statistiquesDepuisPost", () => {
  it("lit un post 200 complet", () => {
    const l = statistiquesDepuisPost(post());
    expect(l).toEqual({
      idDiffuseur: "id-diffuseur-1", idPostStudio: "id-studio-1", reseau: "instagram", urlPubliee: "https://www.instagram.com/reel/ABC123xyz/",
      vues: 14000, portee: 12350, reactions: 342, commentaires: 28, partages: 45, enregistrements: 7, clics: 189, tauxEngagement: 2.78,
      publieLe: "2024-11-01T10:00:05Z", misesAJourLe: "2024-11-02T08:30:00Z", synchro: "a-jour",
    });
  });
  it("un champ absent donne null, jamais zéro", () => {
    const { clicks: _c, ...sans } = analytics();
    const l = statistiquesDepuisPost(post({}, sans))!;
    expect(l.clics).toBeNull();
    const vide = statistiquesDepuisPost(post({ latePostId: undefined, publishedAt: undefined, platformPostUrl: undefined, syncStatus: undefined, platforms: undefined }, { views: 3 }))!;
    expect(vide).toMatchObject({ idPostStudio: null, publieLe: null, urlPubliee: null, portee: null, reactions: null, enregistrements: null, tauxEngagement: null, misesAJourLe: null, synchro: "inconnu" });
  });
  it("views absent : repli sur impressions (arrondi)", () => {
    const { views: _v, ...sans } = analytics({ impressions: 100.6 });
    expect(statistiquesDepuisPost(post({}, sans))!.vues).toBe(101);
  });
  it("un zéro rendu par le diffuseur reste un zéro ; négatif ou texte illisible donne null", () => {
    const l = statistiquesDepuisPost(post({}, analytics({ likes: 0, comments: -2, shares: "abc" })))!;
    expect(l.reactions).toBe(0);
    expect(l.commentaires).toBeNull();
    expect(l.partages).toBeNull();
  });
  it("story Facebook : clics null (toujours 0 chez le diffuseur)", () => {
    expect(statistiquesDepuisPost(post({ platform: "facebook", mediaType: "story" }, analytics({ clicks: 0 })))!.clics).toBeNull();
    expect(statistiquesDepuisPost(post({ platform: "facebook", mediaType: "image", platformPostUrl: "https://www.facebook.com/stories/123" }, analytics({ clicks: 0 })))!.clics).toBeNull();
    expect(statistiquesDepuisPost(post({ platform: "facebook", mediaType: "image" }, analytics({ clicks: 0 })))!.clics).toBe(0);
    expect(statistiquesDepuisPost(post({ platform: "instagram", mediaType: "story" }, analytics({ clicks: 0 })))!.clics).toBe(0);
  });
  it("TikTok sans reach : portee null", () => {
    const { reach: _r, ...sans } = analytics();
    expect(statistiquesDepuisPost(post({ platform: "tiktok" }, sans))!.portee).toBeNull();
    expect(statistiquesDepuisPost(post({ platform: "tiktok" }, analytics({ reach: 0 })))!.portee).toBe(0);
  });
  it("synchro : synced, pending, sinon inconnu", () => {
    expect(statistiquesDepuisPost(post({ syncStatus: "pending" }))!.synchro).toBe("en-cours");
    expect(statistiquesDepuisPost(post({ syncStatus: "failed" }))!.synchro).toBe("inconnu");
  });
  it("date illisible : null ; corps illisible : null", () => {
    expect(statistiquesDepuisPost(post({ publishedAt: "pas une date" }))!.publieLe).toBeNull();
    for (const b of [null, undefined, 4, "x", [], {}, { analytics: null }, { analytics: {} }]) expect(statistiquesDepuisPost(b)).toBeNull();
  });
  it("mêmes valeurs que valeursDepuisAnalyticsZernio pour les cinq anciens champs", () => {
    const fixtures = [post(), post({}, analytics({ views: undefined })), post({}, analytics({ reach: undefined, likes: 0 })), post({ platform: "tiktok" }, analytics({ comments: 9.6 }))];
    for (const f of fixtures) {
      const ancien = valeursDepuisAnalyticsZernio(f)!.valeurs;
      const neuf = statistiquesDepuisPost(f)!;
      expect({ vues: neuf.vues ?? undefined, portee: neuf.portee ?? undefined, reactions: neuf.reactions ?? undefined, commentaires: neuf.commentaires ?? undefined, partages: neuf.partages ?? undefined })
        .toEqual({ vues: ancien.vues, portee: ancien.portee, reactions: ancien.likes, commentaires: ancien.commentaires, partages: ancien.partages });
    }
  });
});

describe("pageDepuisListe", () => {
  it("page pleine : incomplète ; page courte : complète", () => {
    const pleine = pageDepuisListe(liste(TAILLE_PAGE_STATISTIQUES))!;
    expect(pleine.lignes).toHaveLength(50);
    expect(pleine.complete).toBe(false);
    expect(pageDepuisListe(liste(12))).toMatchObject({ complete: true });
    expect(pageDepuisListe(liste(0))).toEqual({ lignes: [], complete: true });
  });
  it("corps illisible : null", () => {
    for (const b of [null, undefined, "x", 3, {}, { posts: "non" }]) expect(pageDepuisListe(b)).toBeNull();
  });
});

describe("lirePageStatistiques", () => {
  it("une requête GET /v1/analytics aux paramètres limités", async () => {
    const f = fauxClient([{ statut: 200, corps: liste(3) }]);
    const r = await lirePageStatistiques(f.client, { page: 2, ...PERIODE });
    expect(r).toMatchObject({ etat: "lues", complete: true });
    expect(f.appels).toEqual([{ methode: "GET", chemin: "/v1/analytics", query: { page: 2, limit: 50, fromDate: "2024-11-01", toDate: "2024-11-30", source: "late" } }]);
  });
  it("202 : pas encore prêtes (statut rendu ou erreur)", async () => {
    expect(await lirePageStatistiques(fauxClient([{ statut: 202, corps: {} }]).client, { page: 1, ...PERIODE })).toEqual({ etat: "pas-encore-pretes" });
    expect(await lirePageStatistiques(fauxClient([erreur(202, "reponse-invalide")]).client, { page: 1, ...PERIODE })).toEqual({ etat: "pas-encore-pretes" });
  });
  it.each([
    [402, "refuse", "indisponible-offre"],
    [424, "refuse", "echec-reseaux"],
    [400, "refuse", "invalide"],
    [401, "acces", "refuse"],
    [403, "acces", "refuse"],
    [500, "indisponible", "reseau"],
  ] as const)("statut %i : état distinct", async (statut, code, raison) => {
    expect(await lirePageStatistiques(fauxClient([erreur(statut, code)]).client, { page: 1, ...PERIODE })).toEqual({ etat: "non-lisible", raison });
  });
  it("réseau coupé : non lisible, raison reseau, jamais un zéro", async () => {
    expect(await lirePageStatistiques(fauxClient([new TypeError("fetch failed")]).client, { page: 1, ...PERIODE })).toEqual({ etat: "non-lisible", raison: "reseau" });
  });
  it("corps 200 illisible : illisible", async () => {
    expect(await lirePageStatistiques(fauxClient([{ statut: 200, corps: "x" }]).client, { page: 1, ...PERIODE })).toEqual({ etat: "non-lisible", raison: "illisible" });
  });
  it("période invalide : 0 requête", async () => {
    for (const [du, au] of [["2024-01-01", "2025-01-03"], ["2024-11-30", "2024-11-01"], ["2024-1-1", "2024-11-01"], ["2024-02-31", "2024-03-01"], ["x", "y"]]) {
      const f = fauxClient([{ statut: 200, corps: liste(1) }]);
      expect(await lirePageStatistiques(f.client, { page: 1, du, au })).toEqual({ etat: "non-lisible", raison: "invalide" });
      expect(f.appels).toHaveLength(0);
    }
    const f = fauxClient([{ statut: 200, corps: liste(1) }]);
    expect(await lirePageStatistiques(f.client, { page: 0, ...PERIODE })).toEqual({ etat: "non-lisible", raison: "invalide" });
    expect(f.appels).toHaveLength(0);
  });
  it("une étendue de 366 jours est permise, 367 refusée avant toute requête", async () => {
    expect(ETENDUE_MAX_JOURS).toBe(366);
    const ok = fauxClient([{ statut: 200, corps: liste(1) }]);
    expect((await lirePageStatistiques(ok.client, { page: 1, du: "2024-01-01", au: "2025-01-01" })).etat).toBe("lues");
    const non = fauxClient([{ statut: 200, corps: liste(1) }]);
    expect(await lirePageStatistiques(non.client, { page: 1, du: "2024-01-01", au: "2025-01-02" })).toEqual({ etat: "non-lisible", raison: "invalide" });
    expect(non.appels).toHaveLength(0);
  });
});

describe("lireStatistiquesPeriode", () => {
  it("page de 50 puis de 12 : 2 requêtes, complet", async () => {
    const f = fauxClient([{ statut: 200, corps: liste(50) }, { statut: 200, corps: liste(12) }]);
    const r = await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 5 });
    expect(r).toMatchObject({ requetes: 2, complet: true, dernierEtat: "lues" });
    expect(r.lignes).toHaveLength(62);
    expect(f.appels.map((a) => a.query?.page)).toEqual([1, 2]);
  });
  it("pagesMax 9 : 5 requêtes au plus, incomplet", async () => {
    expect(PAGES_STATISTIQUES_MAX).toBe(5);
    const f = fauxClient([{ statut: 200, corps: liste(50) }]);
    const r = await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 9 });
    expect(r).toMatchObject({ requetes: 5, complet: false, dernierEtat: "lues" });
    expect(r.lignes).toHaveLength(250);
  });
  it("page vide : arrêt, complet", async () => {
    const f = fauxClient([{ statut: 200, corps: liste(0) }]);
    expect(await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 3 })).toMatchObject({ requetes: 1, complet: true, lignes: [] });
  });
  it("202 en page 2 : les lignes de la page 1 restent", async () => {
    const f = fauxClient([{ statut: 200, corps: liste(50) }, { statut: 202, corps: {} }]);
    const r = await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 5 });
    expect(r).toMatchObject({ requetes: 2, complet: false, dernierEtat: "pas-encore-pretes" });
    expect(r.lignes).toHaveLength(50);
  });
  it.each([[402, "refuse"], [424, "refuse"], [400, "refuse"]] as const)("échec %i en page 2 : compté, page 1 gardée", async (statut, code) => {
    const f = fauxClient([{ statut: 200, corps: liste(50) }, erreur(statut, code)]);
    const r = await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 5 });
    expect(r).toMatchObject({ requetes: 2, complet: false, dernierEtat: "non-lisible" });
    expect(r.lignes).toHaveLength(50);
  });
  it("réseau coupé dès la page 1 : 1 requête comptée, aucune ligne", async () => {
    const f = fauxClient([new TypeError("fetch failed")]);
    expect(await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 5 })).toEqual({ lignes: [], requetes: 1, complet: false, dernierEtat: "non-lisible" });
  });
  it("étendue de 367 jours ou pagesMax nul : 0 requête", async () => {
    const f = fauxClient([{ statut: 200, corps: liste(1) }]);
    expect(await lireStatistiquesPeriode(f.client, { du: "2024-01-01", au: "2025-01-02", pagesMax: 5 })).toEqual({ lignes: [], requetes: 0, complet: false, dernierEtat: "non-lisible" });
    expect((await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 0 })).requetes).toBe(0);
    expect(f.appels).toHaveLength(0);
  });
  it("chaque requête : GET, sans corps, clés de query permises, aucune autre méthode du client", async () => {
    const f = fauxClient([{ statut: 200, corps: liste(50) }]);
    await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 5 });
    expect(f.appels).toHaveLength(5);
    for (const a of f.appels) {
      expect(a.methode).toBe("GET");
      expect(a.chemin).toBe("/v1/analytics");
      expect("corps" in a).toBe(false);
      for (const k of Object.keys(a.query ?? {})) expect(["page", "limit", "fromDate", "toDate", "source"]).toContain(k);
    }
  });
  it("aucun texte de post, nom de compte, vignette, média ni message d'erreur dans le résultat", async () => {
    const f = fauxClient([{ statut: 200, corps: liste(3) }]);
    const r = await lireStatistiquesPeriode(f.client, { ...PERIODE, pagesMax: 2 });
    const texte = JSON.stringify(r);
    for (const interdit of ["content", "accountUsername", "thumbnailUrl", "mediaItems", "errorMessage", "Texte du post", "compte-neutre", "vignette", "diapo1", "message du diffuseur"]) expect(texte).not.toContain(interdit);
    const echec = JSON.stringify(await lireStatistiquesPeriode(fauxClient([erreur(424, "refuse")]).client, { ...PERIODE, pagesMax: 1 }));
    expect(echec).not.toContain("message du diffuseur");
  });
});

describe("source du lecteur", () => {
  const source = readFileSync(new URL("../../src/services/lecteur-statistiques.ts", import.meta.url), "utf8");
  it("aucun import de @/services/, ./_commun, @/fournisseurs/claude, aucun fetch(", () => {
    expect(source).not.toMatch(/from\s+["']@\/services\//);
    expect(source).not.toMatch(/from\s+["']\.\/_commun/);
    expect(source).not.toMatch(/@\/fournisseurs\/claude/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
  it("seuls imports de @/fournisseurs : le type du client et estErreurZernio", () => {
    const imports = [...source.matchAll(/from\s+["'](@\/[^"']+)["']/g)].map((m) => m[1]);
    expect(imports.sort()).toEqual(["@/fournisseurs/publication/zernio-client", "@/fournisseurs/publication/zernio-erreurs"]);
    expect(source).toMatch(/import type \{ ClientZernio \}/);
    expect(source).not.toMatch(/lireParametre|server-only/);
  });
});
