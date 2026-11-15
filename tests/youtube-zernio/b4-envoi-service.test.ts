/**
 * b4 · chaîne complète YouTube Shorts avec Zernio SIMULÉ (même banc que tests/zernio/e2e-04-service.test.ts).
 * Aucune vraie clé, aucun appel réseau, compte fictif.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_FICTIVE, postExemple, type AppelEnregistre, type ReponsePreparee } from "../zernio/aides/faux-zernio";
import { serveurSimule } from "../zernio/aides/serveur-simule";
import { PROPOSITION_YOUTUBE } from "@/fournisseurs/publication/zernio-youtube";

process.env.ZERNIO_API_KEY = CLE_FICTIVE;
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const { injecterClientZernio, PARAM_ENVOI_CALENDRIER } = await import("@/services/zernio");
const { ecrireParametre } = await import("@/services/_commun");
const { REGLAGE_EDITORIALE_ACTIVE } = await import("@/services/promotion-envois");

const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const ACTIF = "zernio.youtube_actif";
const REGLAGES = "zernio.youtube_reglages";
const REGLAGES_ESSAI = { ...PROPOSITION_YOUTUBE, visibilite: "private" as const };
const COMPTES = {
  accounts: [
    { _id: "exemple-compte-yt", platform: "youtube", displayName: "Exemple YT" },
    { _id: "exemple-compte-1", platform: "instagram", displayName: "Exemple IG" },
    { _id: "exemple-compte-li", platform: "linkedin", displayName: "Exemple LI" },
    { _id: "exemple-compte-tt", platform: "tiktok", displayName: "Exemple TT" },
    { _id: "exemple-compte-fb", platform: "facebook", displayName: "Exemple FB" },
  ],
};
let appelsZernio: AppelEnregistre[];
let serveur: ReturnType<typeof serveurSimule>;

function brancherReseauSimule(surmesure?: (a: AppelEnregistre) => ReponsePreparee | undefined) {
  serveur = serveurSimule({
    surmesure: (a) => {
      if (surmesure) {
        const s = surmesure(a);
        if (s) return s;
      }
      if (a.methode === "GET" && a.url.endsWith("/v1/accounts")) return { statut: 200, corps: COMPTES };
      if (a.methode === "GET" && /\/v1\/accounts\/exemple-compte-fb\/facebook-page/.test(a.url)) return { statut: 200, corps: { pages: [{ id: "exemple-page-1", name: "Page exemple" }], selectedPageId: "exemple-page-1" } };
      if (a.methode === "GET" && /\/v1\/accounts\/exemple-compte-li\/linkedin-organizations/.test(a.url)) return { statut: 200, corps: { organizations: [{ id: "12345", name: "Organisation exemple" }] } };
      return undefined;
    },
  });
  appelsZernio = [];
  vi.stubGlobal("fetch", async (url: unknown, init: RequestInit = {}) => {
    const u = String(url);
    if (u.startsWith("https://zernio.com/") || u.startsWith("https://exemple-stockage.test")) {
      const corps = typeof init.body === "string" ? init.body : undefined;
      const a: AppelEnregistre = { url: u, methode: String(init.method ?? "GET"), entetes: { ...(init.headers as Record<string, string>) }, corps, json: corps ? JSON.parse(corps) : undefined };
      appelsZernio.push(a);
      const r = serveur.repondre(a);
      if ("erreur" in r) throw Object.assign(new Error(r.message ?? "fetch failed"), { name: r.erreur === "delai" ? "TimeoutError" : "TypeError" });
      return new Response(r.corps === undefined ? null : JSON.stringify(r.corps), { status: r.statut, headers: { "content-type": "application/json", ...(r.entetes ?? {}) } });
    }
    return new Response(new Uint8Array([1]), { headers: { "content-length": "1" } });
  });
}
const posts = () => appelsZernio.filter((a) => a.methode === "POST" && a.url.endsWith("/v1/posts"));
const lignesZernio = () => depots().publications.lister((p) => p.via === "zernio");
const toutesLesPublications = () => depots().publications.lister((p) => p.videoId === VIDEO);
const envoyerYoutube = () => envoyerParOutilAction(VIDEO, "youtube-shorts", DEMAIN, { outil: "zernio" });
const allumerTout = async () => {
  await ecrireParametre(REGLAGES, REGLAGES_ESSAI);
  await ecrireParametre(ACTIF, true);
};

beforeAll(async () => {
  await preparerMotDePasse("essai-youtube-b4");
});

let decalageMs = 0;
beforeEach(async () => {
  decalageMs += 10 * 60_000;
  vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + decalageMs });
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(REGLAGE_EDITORIALE_ACTIVE, true);
  reinitialiserRequete();
  injecterClientZernio(null);
  process.env.ZERNIO_API_KEY = CLE_FICTIVE;
  await auth.seConnecter("essai-youtube-b4", false);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  brancherReseauSimule();
  await (await import("@/fournisseurs")).fournisseurParId("publication", "zernio").publicationsRecentes?.({ canalId: "exemple-compte-yt", depuis: "2000-01-01T00:00:00Z" });
  appelsZernio.length = 0;
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("b4 · envoi YouTube Shorts par le service", () => {
  it("(a) interrupteur absent : YOUTUBE_ETEINT, 0 requête, 0 publication", async () => {
    await ecrireParametre(REGLAGES, REGLAGES_ESSAI);
    const r = await envoyerYoutube();
    expect(r).toMatchObject({ ok: false, code: "YOUTUBE_ETEINT" });
    expect(appelsZernio).toHaveLength(0);
    expect(await toutesLesPublications()).toHaveLength(0);
  });

  it("(a bis) interrupteur « true » en texte ou faux : même refus", async () => {
    await ecrireParametre(REGLAGES, REGLAGES_ESSAI);
    for (const v of ["true", 1, false]) {
      await ecrireParametre(ACTIF, v);
      expect(await envoyerYoutube()).toMatchObject({ ok: false, code: "YOUTUBE_ETEINT" });
    }
    expect(appelsZernio).toHaveLength(0);
    expect(await toutesLesPublications()).toHaveLength(0);
  });

  it("(b) interrupteur true sans réglages : YOUTUBE_REGLAGES, 0 requête, 0 publication", async () => {
    await ecrireParametre(ACTIF, true);
    const r = await envoyerYoutube();
    expect(r).toMatchObject({ ok: false, code: "YOUTUBE_REGLAGES" });
    expect(appelsZernio).toHaveLength(0);
    expect(await toutesLesPublications()).toHaveLength(0);
  });

  it("(b bis) réglages invalides en base : même refus, jamais de repli sur les propositions", async () => {
    await ecrireParametre(ACTIF, true);
    await ecrireParametre(REGLAGES, { visibilite: "public" });
    expect(await envoyerYoutube()).toMatchObject({ ok: false, code: "YOUTUBE_REGLAGES" });
    expect(appelsZernio).toHaveLength(0);
    expect(await toutesLesPublications()).toHaveLength(0);
  });

  it("(c) tout prêt : 1 POST /v1/posts, plateforme youtube, corps conforme, publication envoyée par Zernio", async () => {
    await allumerTout();
    const r = await envoyerYoutube();
    expect(r).toMatchObject({ ok: true, donnees: { nombre: 1, problemes: [] } });
    expect(posts()).toHaveLength(1);
    const corps = posts()[0].json as { isDraft: boolean; content: string; platforms: { platform: string; accountId: string; platformSpecificData: Record<string, unknown> }[] };
    expect(corps.isDraft).toBe(true);
    expect(corps.platforms).toHaveLength(1);
    expect(corps.platforms[0]).toMatchObject({ platform: "youtube", accountId: "exemple-compte-yt" });
    const s = corps.platforms[0].platformSpecificData;
    expect(Object.keys(s).sort()).toEqual(["categoryId", "containsSyntheticMedia", "madeForKids", "title", "visibility"]);
    expect(s).toMatchObject({ visibility: "private", categoryId: "27", containsSyntheticMedia: true, madeForKids: false });
    expect(typeof s.title).toBe("string");
    expect((s.title as string).length).toBeGreaterThan(0);
    expect((s.title as string).length).toBeLessThanOrEqual(100);
    expect(JSON.stringify(corps)).not.toMatch(/firstComment|publishNow/);
    const [ligne] = await lignesZernio();
    expect(ligne).toMatchObject({ via: "zernio", etatEnvoi: "envoye", reseau: "youtube-shorts", statut: "brouillon" });
    expect(posts()[0].entetes["Idempotency-Key"]).toBe(`studio-${ligne.cleEnvoi}`);
  });

  it("(d) REJEU : même appel deux fois : 1 seul POST, même publication", async () => {
    await allumerTout();
    await envoyerYoutube();
    const [premiere] = await lignesZernio();
    await envoyerYoutube();
    expect(posts()).toHaveLength(1);
    const lignes = await lignesZernio();
    expect(lignes).toHaveLength(1);
    expect(lignes[0].id).toBe(premiere.id);
    expect(serveur.posts.size).toBe(1);
  });

  it("(e) PANNE : POST en 503 puis la liste rend le post à la même clé : envoyé, 0 second POST", async () => {
    await allumerTout();
    brancherReseauSimule((a) => {
      if (a.methode === "POST" && a.url.endsWith("/v1/posts")) {
        // Zernio a bien enregistré le post, la réponse est perdue (503).
        serveur.posts.set("exemple-post-perdu", postExemple({ _id: "exemple-post-perdu", metadata: { origine: "studio", studioCle: a.entetes["Idempotency-Key"].replace(/^studio-/, "") }, platforms: [{ platform: "youtube", accountId: "exemple-compte-yt", status: "pending" }] }));
        return { statut: 503, corps: { error: "indisponible" } };
      }
      return undefined;
    });
    const r = await envoyerYoutube();
    expect(r.ok).toBe(true);
    expect(posts()).toHaveLength(1);
    expect((await lignesZernio())[0]).toMatchObject({ etatEnvoi: "envoye", idExterne: "exemple-post-perdu" });
  });

  it("(e bis) PANNE puis liste vide : à vérifier, 0 second POST ; nouvel appel : ENVOI_A_VERIFIER, 0 POST", async () => {
    await allumerTout();
    brancherReseauSimule((a) => (a.methode === "POST" && a.url.endsWith("/v1/posts") ? { statut: 503, corps: { error: "indisponible" } } : undefined));
    const r = await envoyerYoutube();
    expect(r.ok).toBe(true);
    expect((await lignesZernio())[0]).toMatchObject({ etatEnvoi: "a-verifier" });
    expect(posts()).toHaveLength(1);
    const r2 = await envoyerYoutube();
    expect(JSON.stringify(r2)).toMatch(/ENVOI_A_VERIFIER|à vérifier/);
    expect(posts()).toHaveLength(1);
  });

  it("(f) DOUBLON 409 : existingPostId à notre clé : envoyé ; à une autre clé : à vérifier", async () => {
    await allumerTout();
    brancherReseauSimule((a) => {
      if (a.methode === "POST" && a.url.endsWith("/v1/posts")) {
        serveur.posts.set("exemple-post-nous", postExemple({ _id: "exemple-post-nous", metadata: { origine: "studio", studioCle: a.entetes["Idempotency-Key"].replace(/^studio-/, "") } }));
        return { statut: 409, corps: { error: "duplicate", details: { existingPostId: "exemple-post-nous" } } };
      }
      return undefined;
    });
    expect((await envoyerYoutube()).ok).toBe(true);
    expect((await lignesZernio())[0]).toMatchObject({ etatEnvoi: "envoye", idExterne: "exemple-post-nous" });
  });

  it("(f bis) DOUBLON 409 vers un post d'une autre clé : à vérifier, jamais envoyé", async () => {
    await allumerTout();
    brancherReseauSimule((a) => {
      if (a.methode === "POST" && a.url.endsWith("/v1/posts")) {
        serveur.posts.set("exemple-post-autre", postExemple({ _id: "exemple-post-autre", metadata: { origine: "studio", studioCle: "autre-cle" } }));
        return { statut: 409, corps: { error: "duplicate", details: { existingPostId: "exemple-post-autre" } } };
      }
      return undefined;
    });
    await envoyerYoutube();
    const [ligne] = await lignesZernio();
    expect(ligne.etatEnvoi).toBe("a-verifier");
    expect(ligne.idExterne).toBeUndefined();
    expect(posts()).toHaveLength(1);
  });

  it("(g) création partielle (plateforme failed) : à vérifier, jamais refusé", async () => {
    await allumerTout();
    brancherReseauSimule((a) =>
      a.methode === "POST" && a.url.endsWith("/v1/posts")
        ? { statut: 201, corps: { post: postExemple({ _id: "exemple-post-echec", status: "failed", platforms: [{ platform: "youtube", accountId: "exemple-compte-yt", status: "failed", errorCategory: "exemple" }] }) } }
        : undefined,
    );
    await envoyerYoutube();
    const [ligne] = await lignesZernio();
    expect(ligne.etatEnvoi).toBe("a-verifier");
    expect(ligne.etatEnvoi).not.toBe("refuse");
    expect(posts()).toHaveLength(1);
  });

  it("(h) NON-RÉGRESSION : Instagram, Facebook, LinkedIn, TikTok : corps identiques éteint et allumé, sans format ni durée", async () => {
    const cas: { reseau: "instagram" | "facebook" | "linkedin" | "tiktok"; compte: string; options: Record<string, unknown> }[] = [
      { reseau: "instagram", compte: "exemple-compte-1", options: {} },
      { reseau: "facebook", compte: "exemple-compte-fb:fb:exemple-page-1", options: {} },
      { reseau: "linkedin", compte: "exemple-compte-li:li:12345", options: {} },
      { reseau: "tiktok", compte: "exemple-compte-tt", options: { accordTiktok: true } },
    ];
    const corpsParEtat: Record<string, unknown[]> = { eteint: [], allume: [] };
    for (const etat of ["eteint", "allume"] as const) {
      for (const c of cas) {
        reinitialiserDepots();
        await exemplesCommeVraies(depots(), { plusExemples: true });
        await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
        await ecrireParametre(REGLAGE_EDITORIALE_ACTIVE, true);
        for (const k of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, k, true);
        if (etat === "allume") await allumerTout();
        decalageMs += 10 * 60_000;
        vi.setSystemTime(Date.now() + 10 * 60_000);
        brancherReseauSimule();
        const comptes = c.reseau === "facebook" || c.reseau === "linkedin" ? [c.compte] : undefined;
        await envoyerParOutilAction(VIDEO, c.reseau, DEMAIN, { outil: "zernio", ...(comptes ? { comptes } : {}), ...c.options } as never);
        const p = posts();
        if (!p.length) {
          // Si le réseau est refusé par le banc (cible), la comparaison éteint/allumé reste valable : le corps est alors absent des deux côtés.
          corpsParEtat[etat].push(null);
          continue;
        }
        const brut = JSON.stringify(p[0].json);
        expect(brut).not.toMatch(/"format"|"dureeSec"/);
        corpsParEtat[etat].push(JSON.parse(brut));
      }
    }
    expect(corpsParEtat.allume).toEqual(corpsParEtat.eteint);
    // Instagram, Facebook et LinkedIn sont réellement partis sur ce banc.
    expect(corpsParEtat.eteint[0]).not.toBeNull();
    expect(corpsParEtat.eteint[1]).not.toBeNull();
    expect(corpsParEtat.eteint[2]).not.toBeNull();
    // TikTok : le banc du service n'offre pas le niveau de confidentialité (refus d'avant le lot, identique des deux côtés) ; voir b5 pour son corps.
  });

  it("(h bis) demande au fournisseur : format et dureeSec transmis pour YouTube Shorts seulement", async () => {
    const { fournisseurParId } = await import("@/fournisseurs");
    const service = fournisseurParId("publication", "zernio");
    const envoyer = vi.spyOn(service, "envoyer");
    await allumerTout();
    await envoyerYoutube();
    expect(envoyer.mock.calls.at(-1)![0]).toMatchObject({ reseau: "youtube-shorts", format: "9:16", dureeSec: 30 });
    envoyer.mockClear();
    decalageMs += 10 * 60_000;
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "zernio" });
    const demande = envoyer.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(demande.reseau).toBe("instagram");
    expect("format" in demande).toBe(false);
    expect("dureeSec" in demande).toBe(false);
  });
});
