import { describe, expect, it } from "vitest";
import { cleEnvoiPublication } from "@/domaine/outil-publication";
import { cleIdempotenceImport, creerClientZernio, enteteIdempotenceStudio, type RequeteZernio } from "@/fournisseurs/publication/zernio-client";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { CLE_FICTIVE, creerFauxClientZernio, fetchInterdit, horlogeFictive, postExemple } from "./aides/faux-zernio";

const CLE_STUDIO = enteteIdempotenceStudio(cleEnvoiPublication("exemple-video-1", "instagram", "2026-11-03T10:00:00Z", "exemple-compte"));
const BROUILLON = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };

/** Client dont le fetch fait échouer le test s'il est appelé. */
function clientSansReseau() {
  const faux = fetchInterdit();
  const h = horlogeFictive();
  const client = creerClientZernio({ cle: CLE_FICTIVE, fetch: faux.fetch, maintenant: h.maintenant, attendre: h.attendre });
  return { client, faux };
}

async function refusAvantReseau(req: RequeteZernio): Promise<ErreurZernio> {
  const { client, faux } = clientSansReseau();
  const e = await client.requete(req).then(
    () => null,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErreurZernio);
  expect(faux.appels).toHaveLength(0);
  return e as ErreurZernio;
}

describe("z1c · liste fermée D6 : chemins permis", () => {
  const permis: [string, RequeteZernio, unknown][] = [
    ["GET /v1/accounts", { methode: "GET", chemin: "/v1/accounts" }, { accounts: [] }],
    ["GET facebook-page", { methode: "GET", chemin: "/v1/accounts/exemple-compte-1/facebook-page" }, { pages: [] }],
    ["GET linkedin-organizations", { methode: "GET", chemin: "/v1/accounts/exemple-compte-1/linkedin-organizations" }, { organizations: [] }],
    ["GET tiktok/creator-info", { methode: "GET", chemin: "/v1/accounts/exemple-compte-1/tiktok/creator-info" }, {}],
    ["GET instagram/publishing-limit", { methode: "GET", chemin: "/v1/accounts/exemple-compte-1/instagram/publishing-limit" }, {}],
    ["POST /v1/media/presign", { methode: "POST", chemin: "/v1/media/presign", corps: { filename: "exemple.mp4", contentType: "video/mp4" } }, {}],
    ["POST /v1/posts (brouillon)", { methode: "POST", chemin: "/v1/posts", corps: BROUILLON, idempotence: CLE_STUDIO }, { post: postExemple() }],
    ["GET /v1/posts", { methode: "GET", chemin: "/v1/posts", query: { status: "draft" } }, { posts: [] }],
    ["GET /v1/posts/{postId}", { methode: "GET", chemin: "/v1/posts/exemple-post-1" }, { post: postExemple() }],
    ["PUT promotion", { methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps: { isDraft: false, scheduledFor: "2026-11-03T10:00:00Z" } }, {}],
    ["PUT mediaItems", { methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps: { mediaItems: [{ type: "image", url: "https://media.exemple/a.jpg" }] } }, {}],
    ["GET /v1/analytics", { methode: "GET", chemin: "/v1/analytics" }, {}],
  ];
  it.each(permis)("%s passe et part au réseau une seule fois", async (_nom, req, corps) => {
    const { client, faux } = creerFauxClientZernio([{ statut: 200, corps }]);
    await client.requete(req);
    expect(faux.appels).toHaveLength(1);
    expect(faux.appels[0].url.startsWith("https://zernio.com/api/v1/")).toBe(true);
  });
});

describe("z1c · liste fermée D6 : refus AVANT le réseau", () => {
  const refuses: [string, RequeteZernio][] = [
    ["DELETE d'un post", { methode: "DELETE", chemin: "/v1/posts/exemple-post-1" }],
    ["DELETE d'un compte (déconnexion)", { methode: "DELETE", chemin: "/v1/accounts/exemple-compte-1" }],
    ["PUT sur un compte", { methode: "PUT", chemin: "/v1/accounts/exemple-compte-1", corps: { name: "x" } }],
    ["PUT selectedPageId", { methode: "PUT", chemin: "/v1/accounts/exemple-compte-1/facebook-page", corps: { selectedPageId: "exemple-page" } }],
    ["PUT linkedin-organization", { methode: "PUT", chemin: "/v1/accounts/exemple-compte-1/linkedin-organization", corps: { organizationUrn: "exemple" } }],
    ["connexion de compte", { methode: "GET", chemin: "/v1/connect/facebook" }],
    ["api-keys", { methode: "POST", chemin: "/v1/api-keys", corps: { name: "x" } }],
    ["webhooks", { methode: "GET", chemin: "/v1/webhooks/settings" }],
    ["messages", { methode: "GET", chemin: "/v1/inbox/conversations" }],
    ["automatisations", { methode: "POST", chemin: "/v1/automations", corps: {} }],
    ["publicités", { methode: "POST", chemin: "/v1/ads/create", corps: {} }],
    ["publicités meta", { methode: "GET", chemin: "/v1/metaads/campaigns" }],
    ["bulk-upload", { methode: "POST", chemin: "/v1/posts/bulk-upload", corps: {} }],
    ["files d'attente", { methode: "GET", chemin: "/v1/queue/slots" }],
    ["remontée de chemin", { methode: "GET", chemin: "/v1/posts/../accounts" }],
    ["chemin encodé", { methode: "GET", chemin: "/v1/posts/%2e%2e" }],
    ["requête dans le chemin", { methode: "GET", chemin: "/v1/posts?status=draft" }],
    ["hors /v1", { methode: "GET", chemin: "/v2/accounts" }],
    ["PATCH d'un post", { methode: "PATCH", chemin: "/v1/posts/exemple-post-1", corps: { content: "x" } }],
  ];
  it.each(refuses)("%s est refusé sans appel réseau", async (_nom, req) => {
    const e = await refusAvantReseau(req);
    expect(e.code).toBe("chemin-refuse");
    expect(e.avantReseau).toBe(true);
  });

  const formesPublishNow: [string, RequeteZernio][] = [
    ["corps", { methode: "POST", chemin: "/v1/posts", corps: { ...BROUILLON, publishNow: true }, idempotence: CLE_STUDIO }],
    ["casse différente", { methode: "POST", chemin: "/v1/posts", corps: { ...BROUILLON, PUBLISHNOW: true }, idempotence: CLE_STUDIO }],
    ["souligné", { methode: "POST", chemin: "/v1/posts", corps: { ...BROUILLON, publish_now: "true" }, idempotence: CLE_STUDIO }],
    ["imbriqué", { methode: "POST", chemin: "/v1/posts", corps: { ...BROUILLON, platforms: [{ platform: "instagram", accountId: "x", publishNow: true }] }, idempotence: CLE_STUDIO }],
    ["paramètre de requête", { methode: "GET", chemin: "/v1/posts", query: { publishNow: "true" } }],
    ["dans le PUT", { methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps: { isDraft: false, scheduledFor: "2026-11-03T10:00:00Z", publishNow: true } }],
  ];
  it.each(formesPublishNow)("publishNow (%s) est refusé", async (_nom, req) => {
    const e = await refusAvantReseau(req);
    expect(e.code).toBe("chemin-refuse");
  });

  it("PUT d'un post : seules les deux formes de D5 passent", async () => {
    for (const corps of [
      { scheduledFor: "2026-11-03T10:00:00Z" },
      { isDraft: true, scheduledFor: "2026-11-03T10:00:00Z" },
      { isDraft: false, scheduledFor: "2026-11-03T10:00:00+01:00" },
      { isDraft: false, scheduledFor: "2026-11-03T10:00:00Z", content: "x" },
      { isDraft: false, scheduledFor: "2026-11-03T10:00:00Z", instagramSettings: {} },
      { mediaItems: [] },
      { mediaItems: [{ type: "image", url: "https://media.exemple/a.jpg" }], content: "x" },
    ]) {
      const e = await refusAvantReseau({ methode: "PUT", chemin: "/v1/posts/exemple-post-1", corps });
      expect(e.code).toBe("chemin-refuse");
    }
  });

  it("POST /v1/posts exige une Idempotency-Key studio-<hex> ou imp-<hex>", async () => {
    expect((await refusAvantReseau({ methode: "POST", chemin: "/v1/posts", corps: BROUILLON })).code).toBe("chemin-refuse");
    expect((await refusAvantReseau({ methode: "POST", chemin: "/v1/posts", corps: BROUILLON, idempotence: "autre-cle" })).code).toBe("chemin-refuse");
  });

  it("POST /v1/posts hors brouillon : date à plus de 30 min exigée (sinon publication immédiate)", async () => {
    const corps = { content: "Bonjour", platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };
    expect((await refusAvantReseau({ methode: "POST", chemin: "/v1/posts", corps, idempotence: CLE_STUDIO })).code).toBe("chemin-refuse");
    const proche = { ...corps, scheduledFor: "2026-11-01T08:10:00Z" };
    expect((await refusAvantReseau({ methode: "POST", chemin: "/v1/posts", corps: proche, idempotence: CLE_STUDIO })).code).toBe("chemin-refuse");
  });

  it("aucun en-tête Authorization ou autre en-tête sensible ne peut être imposé", async () => {
    const e = await refusAvantReseau({ methode: "GET", chemin: "/v1/accounts", entetes: { Authorization: "Bearer autre" } });
    expect(e.code).toBe("chemin-refuse");
  });
});

describe("z1c · PUT <uploadUrl> : https, hôte de presign, sans Authorization", () => {
  const presign = { statut: 200, corps: { uploadUrl: "https://stockage.exemple/televersement/exemple-1", publicUrl: "https://media.exemple/exemple-1.mp4", expiresIn: 3600 } };

  it("le téléversement part vers l'hôte rendu par presign, sans Authorization, avec Content-Length", async () => {
    const { client, faux } = creerFauxClientZernio([presign, { statut: 200 }]);
    const p = await client.preparerTeleversement({ filename: "exemple.mp4", contentType: "video/mp4", size: 3 });
    await client.televerser({ uploadUrl: p.uploadUrl, corps: new Uint8Array([1, 2, 3]), contentType: "video/mp4", contentLength: 3 });
    expect(faux.appels).toHaveLength(2);
    const envoi = faux.appels[1];
    expect(envoi.url).toBe("https://stockage.exemple/televersement/exemple-1");
    expect(Object.keys(envoi.entetes).map((k) => k.toLowerCase())).not.toContain("authorization");
    expect(envoi.entetes["Content-Length"]).toBe("3");
  });

  it("refuse http, un autre hôte, ou un en-tête Authorization, sans appel réseau", async () => {
    const { client, faux } = creerFauxClientZernio([presign]);
    await client.preparerTeleversement({ filename: "exemple.mp4", contentType: "video/mp4" });
    const base = { methode: "PUT" as const, corps: new Uint8Array([1]), contentType: "video/mp4", contentLength: 1 };
    for (const req of [
      { ...base, urlTeleversement: "http://stockage.exemple/televersement/exemple-1" },
      { ...base, urlTeleversement: "https://autre.exemple/televersement/exemple-1" },
      { ...base, urlTeleversement: "https://stockage.exemple/x", entetes: { authorization: "Bearer x" } },
    ]) {
      await expect(client.requete(req)).rejects.toMatchObject({ code: "chemin-refuse" });
    }
    expect(faux.appels).toHaveLength(1); // le seul presign
  });

  it("refuse tout téléversement si aucun presign n'a été fait", async () => {
    const { client, faux } = creerFauxClientZernio([]);
    await expect(client.televerser({ uploadUrl: "https://stockage.exemple/x", corps: new Uint8Array([1]), contentType: "image/png", contentLength: 1 })).rejects.toMatchObject({ code: "chemin-refuse" });
    expect(faux.appels).toHaveLength(0);
  });
});

describe("z1c · idempotence D4", () => {
  it("l'en-tête studio-<hex> fait au plus 255 signes et part avec la création", async () => {
    expect(CLE_STUDIO).toMatch(/^studio-[0-9a-f]{64}$/);
    expect(CLE_STUDIO.length).toBeLessThanOrEqual(255);
    const { client, faux } = creerFauxClientZernio([{ statut: 201, corps: { post: postExemple() } }]);
    await client.creerPost(BROUILLON, CLE_STUDIO);
    expect(faux.appels[0].entetes["Idempotency-Key"]).toBe(CLE_STUDIO);
  });

  it("clé d'import imp-<…> stable, différente entre pageId et organizationUrn", () => {
    const a = cleIdempotenceImport("exemple-buffer-1", "exemple-compte-1", { pageId: "exemple-cible" });
    expect(a).toBe(cleIdempotenceImport("exemple-buffer-1", "exemple-compte-1", { pageId: "exemple-cible" }));
    expect(a).toMatch(/^imp-[0-9a-f]{64}$/);
    expect(cleIdempotenceImport("exemple-buffer-1", "exemple-compte-1", { organizationUrn: "exemple-cible-2" })).not.toBe(a);
  });

  it("rejeu : 200 rend le post d'origine, marqué rejeu", async () => {
    const { client } = creerFauxClientZernio([{ statut: 200, corps: { post: postExemple() } }]);
    expect((await client.creerPost(BROUILLON, CLE_STUDIO)).rejeu).toBe(true);
  });

  it("409 idempotency_conflict : erreur d'attente, aucun renvoi", async () => {
    const { client, faux } = creerFauxClientZernio([{ statut: 409, corps: { error: "en cours", code: "idempotency_conflict" }, entetes: { "Retry-After": "5" } }]);
    await expect(client.creerPost(BROUILLON, CLE_STUDIO)).rejects.toMatchObject({ code: "conflit-idempotence", attenteMs: 5000 });
    expect(faux.appels).toHaveLength(1);
  });

  it("409 doublon : existingPostId lu dans details puis à la racine", async () => {
    const { client } = creerFauxClientZernio([
      { statut: 409, corps: { error: "doublon", details: { existingPostId: "exemple-post-origine" } } },
      { statut: 409, corps: { error: "doublon", existingPostId: "exemple-post-racine" } },
    ]);
    await expect(client.creerPost(BROUILLON, CLE_STUDIO)).rejects.toMatchObject({ code: "doublon", existingPostId: "exemple-post-origine" });
    await expect(client.creerPost(BROUILLON, CLE_STUDIO)).rejects.toMatchObject({ code: "doublon", existingPostId: "exemple-post-racine" });
  });

  it.each([
    ["5xx", { statut: 503, corps: { error: "indisponible" } }],
    ["délai dépassé", { erreur: "delai" as const }],
  ])("après %s sur une écriture : lecture GET exigée avant tout nouvel envoi", async (_nom, premiere) => {
    const { client, faux } = creerFauxClientZernio([premiere, { statut: 200, corps: { posts: [] } }, { statut: 200, corps: { post: postExemple() } }]);
    await expect(client.creerPost(BROUILLON, CLE_STUDIO)).rejects.toMatchObject({ code: "a-verifier" });
    await expect(client.creerPost(BROUILLON, CLE_STUDIO)).rejects.toMatchObject({ code: "lecture-requise" });
    expect(faux.appels).toHaveLength(1);
    await client.listerPosts({ status: "draft" });
    await client.creerPost(BROUILLON, CLE_STUDIO);
    expect(faux.appels.map((a) => a.methode)).toEqual(["POST", "GET", "POST"]);
  });
});

describe("z1c · 207 jugé sur platforms[].status", () => {
  const plateformes = (a: string, b: string) => [
    { platform: "instagram", accountId: "exemple-compte-1", status: a },
    { platform: "facebook", accountId: "exemple-compte-2", status: b, errorMessage: "exemple d'échec" },
  ];
  it("207 avec une plateforme publiée et une en échec : partiel", async () => {
    const { client } = creerFauxClientZernio([{ statut: 207, corps: { post: postExemple({ status: "partial", platforms: plateformes("published", "failed") }) } }]);
    const r = await client.creerPost(BROUILLON, CLE_STUDIO);
    expect(r.issue).toBe("partiel");
    expect(r.echecs.map((e) => e.platform)).toEqual(["facebook"]);
  });
  it("207 où toutes les plateformes ont échoué : échec, même si le code est 2xx", async () => {
    const { client } = creerFauxClientZernio([{ statut: 207, corps: { post: postExemple({ status: "failed", platforms: plateformes("failed", "failed") }) } }]);
    expect((await client.creerPost(BROUILLON, CLE_STUDIO)).issue).toBe("echec");
  });
  it("207 en attente de nouvel essai Zernio (pending) : pas un échec", async () => {
    const { client } = creerFauxClientZernio([{ statut: 207, corps: { post: postExemple({ status: "scheduled", platforms: plateformes("pending", "pending") }) } }]);
    expect((await client.creerPost(BROUILLON, CLE_STUDIO)).issue).toBe("ok");
  });
});
