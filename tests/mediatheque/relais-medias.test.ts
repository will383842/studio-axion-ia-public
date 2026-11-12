/**
 * RELAIS DES MÉDIAS (/api/medias-publics/<jeton>/<nom>) : généralisation du relais vidéo. Noms permis : video.mp4, image.png,
 * image.jpg, document.pdf. Aucun appel réel : stockage R2 doublé. L'ancien relais (/api/media-buffer) reste un alias.
 */
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET = "secret-de-session-essai-0123456789-abcdef";
process.env.FOURNISSEUR_STOCKAGE = "r2";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-r2-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.STUDIO_ADRESSE = "https://studio.essai.example/";

const { creerJetonMediaBuffer, DUREE_JETON_MEDIA_BUFFER_SEC } = await import("@/lib/jeton-media-buffer");
const { GET, HEAD } = await import("@/app/api/medias-publics/[jeton]/[nom]/route");
const { GET: GET_ANCIEN } = await import("@/app/api/media-buffer/[jeton]/[nom]/route");
const medias = await import("@/services/relais-medias");
const ancien = await import("@/services/relais-buffer");
const { proxy } = await import("@/proxy");
const { depots } = await import("@/services/_commun");

const OCTETS = new TextEncoder().encode("0123456789abcdefghij");
const horo = { creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z" };
const enregistrer = (id: string, cle: string, mime: string, statut = "pret") =>
  depots().fichiers.enregistrer({ id, cleStockage: cle, nom: id, taille: OCTETS.length, mime, origine: "genere", statut, ...horo } as never);
const ctx = (jeton: string, nom: string) => ({ params: Promise.resolve({ jeton, nom }) });
const requete = (methode: string, nom: string) => new Request(`https://studio.essai.example/api/medias-publics/x/${nom}`, { method: methode });
const lire = async (r: Response) => new TextDecoder().decode(await r.arrayBuffer());

let r2: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  medias.reinitialiserLimitePourEssai();
  for (const m of ["log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation(() => undefined);
  await enregistrer("m-png", "studio/prod/visuels/m1/page-1-x1.png", "image/png");
  await enregistrer("m-jpg", "studio/prod/visuels/m1/page-1-x1.jpg", "image/jpeg");
  await enregistrer("m-pdf", "studio/prod/visuels/m1/rendu.pdf", "application/pdf");
  await enregistrer("m-mp4", "studio/prod/videos/v1/m-mp4.mp4", "video/mp4");
  await enregistrer("m-texte", "studio/prod/divers/notes.txt", "text/plain");
  await enregistrer("m-brouillon", "studio/prod/visuels/m1/b.png", "image/png", "en_cours");
  await enregistrer("m-demo", "/demo/image.png", "image/png");
  r2 = vi.fn(async (_u: string | URL | Request, init?: RequestInit) =>
    init?.method === "HEAD" ? new Response(null, { status: 200, headers: { "content-length": "20" } }) : new Response(OCTETS, { status: 200, headers: { "content-length": "20" } }));
  vi.stubGlobal("fetch", r2);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("critère 1 : PNG servi avec un jeton valide, 404 sinon", () => {
  it("PNG : 200 image/png, contenu relayé", async () => {
    const r = await GET(requete("GET", "image.png"), ctx(creerJetonMediaBuffer("m-png"), "image.png"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
    expect(await lire(r)).toBe("0123456789abcdefghij");
  });
  it("jpg, pdf et mp4 : bon type de contenu, en GET et en HEAD", async () => {
    for (const [id, nom, type] of [["m-jpg", "image.jpg", "image/jpeg"], ["m-pdf", "document.pdf", "application/pdf"], ["m-mp4", "video.mp4", "video/mp4"]] as const) {
      const j = creerJetonMediaBuffer(id);
      expect((await GET(requete("GET", nom), ctx(j, nom))).headers.get("content-type")).toBe(type);
      const h = await HEAD(requete("HEAD", nom), ctx(j, nom));
      expect(h.status).toBe(200);
      expect(h.headers.get("content-type")).toBe(type);
    }
  });
  it("jeton faux, expiré, illisible : le même 404, sans rien lire", async () => {
    const bon = creerJetonMediaBuffer("m-png");
    const vieux = creerJetonMediaBuffer("m-png", Date.now() - (DUREE_JETON_MEDIA_BUFFER_SEC + 10) * 1000);
    const rs = [vieux, `${bon.split(".")[0]}.AAAA`, "n-importe-quoi", ""].map((j) => GET(requete("GET", "image.png"), ctx(j, "image.png")));
    const reps = await Promise.all(rs);
    expect(reps.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    expect(r2).not.toHaveBeenCalled();
  });
  it("un jeton à la limite exacte de l'expiration est refusé, une seconde avant il passe", () => {
    const t0 = Date.parse("2026-03-01T00:00:00Z");
    const j = creerJetonMediaBuffer("m-png", t0);
    const fin = t0 + DUREE_JETON_MEDIA_BUFFER_SEC * 1000;
    return Promise.all([
      medias.servirRelaisMedias("HEAD", j, "image.png", null, undefined, fin - 1000).then((r) => expect(r.status).toBe(200)),
      medias.servirRelaisMedias("HEAD", j, "image.png", null, undefined, fin).then((r) => expect(r.status).toBe(404)),
    ]);
  });
  it("nom qui ne correspond pas au type du fichier, type non permis, fichier non prêt ou de démonstration : 404", async () => {
    const j = (id: string) => creerJetonMediaBuffer(id);
    const cas: [string, string][] = [["m-png", "document.pdf"], ["m-png", "image.jpg"], ["m-pdf", "image.png"], ["m-texte", "document.pdf"], ["m-brouillon", "image.png"], ["m-demo", "image.png"], ["m-inconnu", "image.png"], ["m-png", "autre.png"], ["m-png", "IMAGE.PNG"]];
    for (const [id, nom] of cas) expect((await GET(requete("GET", nom), ctx(j(id), nom))).status, `${id} ${nom}`).toBe(404);
    expect(r2).not.toHaveBeenCalled();
  });
});

describe("critère 2 : l'ancienne adresse reste valide", () => {
  it("/api/media-buffer/<ancien jeton>/video.mp4 répond toujours (jeton émis avant ce chantier)", async () => {
    const r = await GET_ANCIEN(requete("GET", "video.mp4"), ctx(creerJetonMediaBuffer("m-mp4", Date.now() - 5 * 24 * 3600 * 1000), "video.mp4"));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("video/mp4");
  });
  it("l'ancienne route ne sert que video.mp4 (pas d'image ni de PDF)", async () => {
    for (const [id, nom] of [["m-png", "image.png"], ["m-pdf", "document.pdf"]] as const) expect((await GET_ANCIEN(requete("GET", nom), ctx(creerJetonMediaBuffer(id), nom))).status).toBe(404);
  });
  it("relais-buffer renvoie vers le nouveau code, mêmes noms", () => {
    expect(ancien.servirRelaisBuffer).toBeTypeOf("function");
    expect(ancien.adresseRelaisBuffer("m-mp4")).toMatch(/^https:\/\/studio\.essai\.example\/api\/media-buffer\/[\w.-]+\/video\.mp4$/);
    expect(ancien.reinitialiserLimitePourEssai).toBe(medias.reinitialiserLimitePourEssai);
    expect(ancien.LIMITE_FLUX_SIMULTANES).toBe(medias.LIMITE_FLUX_SIMULTANES);
  });
  it("adresse nouvelle : https://<studio>/api/medias-publics/<jeton>/<nom>", () => {
    expect(medias.adresseRelaisMedias("m-png", "image.png")).toMatch(/^https:\/\/studio\.essai\.example\/api\/medias-publics\/[\w.-]+\/image\.png$/);
    expect(() => medias.adresseRelaisMedias("m-png", "autre.png" as never)).toThrow();
  });
});

describe("critère 3 : le proxy ne laisse passer que les quatre noms", () => {
  const appeler = (chemin: string) => proxy(new NextRequest(`https://studio.essai.example${chemin}`));
  for (const nom of ["video.mp4", "image.png", "image.jpg", "document.pdf"]) {
    it(`/api/medias-publics/jeton/${nom} passe sans session`, async () => {
      const r = await appeler(`/api/medias-publics/${creerJetonMediaBuffer("m-png")}/${nom}`);
      expect(r.status).toBe(200);
      expect(r.headers.get("x-middleware-next")).toBe("1");
    });
  }
  for (const chemin of ["/api/medias-publics/a/autre.png", "/api/medias-publics/a/image.gif", "/api/medias-publics/a/IMAGE.PNG", "/api/medias-publics/a/image.png/x", "/api/medias-publics//image.png", "/api/medias-publics/a b/image.png", "/api/medias-publics/a/b/image.png", "/api/medias-publics-x/a/image.png", "/api/medias-publics/a/image.pngx", "/api/medias-publics/a/document.pdf%00"]) {
    it(`${chemin} : 401 sans session`, async () => {
      const r = await appeler(chemin);
      expect(r.status).toBe(401);
      expect(r.headers.get("x-middleware-next")).toBeNull();
    });
  }
  it("l'ancien proxy reste strict : /api/media-buffer/a/image.png n'est pas public", async () => {
    expect((await appeler("/api/media-buffer/a/image.png")).status).toBe(401);
  });
});
