/**
 * RELAIS VIDÉO POUR BUFFER (/api/media-buffer/<jeton>/video.mp4) : Buffer vérifie l'adresse par un HEAD, que l'adresse R2
 * signée (GET seulement) refuse. Comportements : jeton (valide, expiré, falsifié, charge modifiée), HEAD sans lecture du fichier,
 * GET entier et GET Range, fichier inconnu ou de démonstration, adresse donnée à Buffer sans signature R2, aucun secret au journal.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET = "secret-de-session-essai-0123456789-abcdef";
process.env.FOURNISSEUR_STOCKAGE = "r2";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-r2-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.STUDIO_ADRESSE = "https://studio.essai.example/";

const { creerJetonMediaBuffer, verifierJetonMediaBuffer, DUREE_JETON_MEDIA_BUFFER_SEC } = await import("@/lib/jeton-media-buffer");
const { GET, HEAD } = await import("@/app/api/media-buffer/[jeton]/[nom]/route");
const { reinitialiserLimitePourEssai, LIMITE_REQUETES_PAR_MINUTE } = await import("@/services/relais-buffer");
const { urlVideoPourBuffer } = await import("@/services/publications");
const { depots } = await import("@/services/_commun");

const OCTETS = new TextEncoder().encode("0123456789abcdefghij"); // 20 octets
const horo = { creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z" };
const enregistrer = (id: string, cleStockage: string) =>
  depots().fichiers.enregistrer({ id, cleStockage, nom: `${id}.mp4`, taille: OCTETS.length, mime: "video/mp4", origine: "genere", statut: "pret", ...horo } as never);
const ctx = (jeton: string, nom = "video.mp4") => ({ params: Promise.resolve({ jeton, nom }) });
const requete = (methode: string, range?: string) => new Request("https://studio.essai.example/api/media-buffer/x/video.mp4", { method: methode, headers: range ? { range } : {} });
const lire = async (r: Response) => new TextDecoder().decode(await r.arrayBuffer());

let r2: ReturnType<typeof vi.fn>;
let journaux: string[];

beforeEach(async () => {
  reinitialiserLimitePourEssai();
  journaux = [];
  for (const m of ["log", "info", "warn", "error"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void journaux.push(a.join(" ")));
  await enregistrer("f-reel", "studio/prod/videos/v1/f-reel.mp4");
  await enregistrer("f-demo", "/demo/avocat-1.mp4");
  // R2 doublé : GET seulement (comme l'adresse signée) ; Range géré comme R2.
  r2 = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const plage = new Headers(init?.headers).get("range");
    const m = plage ? /^bytes=(\d+)-(\d*)$/.exec(plage) : null;
    if (m) {
      const debut = Number(m[1]);
      if (debut >= OCTETS.length) return new Response(null, { status: 416, headers: { "content-range": `bytes */${OCTETS.length}` } });
      const fin = m[2] ? Math.min(Number(m[2]), OCTETS.length - 1) : OCTETS.length - 1;
      return new Response(OCTETS.slice(debut, fin + 1), { status: 206, headers: { "content-range": `bytes ${debut}-${fin}/${OCTETS.length}`, "content-length": String(fin - debut + 1) } });
    }
    return new Response(OCTETS, { status: 200, headers: { "content-length": String(OCTETS.length) } });
  });
  vi.stubGlobal("fetch", r2);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("jeton du relais", () => {
  it("un jeton valide rend l'identifiant du fichier", () => {
    expect(verifierJetonMediaBuffer(creerJetonMediaBuffer("f-reel"))).toBe("f-reel");
  });
  it("expire au bout de 30 jours", () => {
    const t0 = Date.parse("2026-03-01T00:00:00Z");
    const jeton = creerJetonMediaBuffer("f-reel", t0);
    expect(DUREE_JETON_MEDIA_BUFFER_SEC).toBe(30 * 24 * 3600);
    expect(verifierJetonMediaBuffer(jeton, t0 + (DUREE_JETON_MEDIA_BUFFER_SEC - 5) * 1000)).toBe("f-reel");
    expect(verifierJetonMediaBuffer(jeton, t0 + (DUREE_JETON_MEDIA_BUFFER_SEC + 5) * 1000)).toBeNull();
  });
  it("signature falsifiée, charge modifiée, jeton illisible ou signé avec une autre clé : refusé", () => {
    const jeton = creerJetonMediaBuffer("f-reel");
    const [charge, signature] = jeton.split(".");
    const autre = Buffer.from(JSON.stringify({ fichierId: "f-demo", exp: Math.floor(Date.now() / 1000) + 99999 })).toString("base64url");
    expect(verifierJetonMediaBuffer(`${charge}.${signature.slice(0, -2)}AA`)).toBeNull();
    expect(verifierJetonMediaBuffer(`${autre}.${signature}`)).toBeNull();
    for (const mauvais of ["", "x", "a.b.c", "!!!.???", `${charge}.`, `.${signature}`]) expect(verifierJetonMediaBuffer(mauvais)).toBeNull();
    expect(verifierJetonMediaBuffer(jeton, Date.now(), { SESSION_SECRET: "un-tout-autre-secret-de-session-0123456789" })).toBeNull();
  });
});

describe("relais : HEAD et GET", () => {
  it("HEAD : 200 avec les bons en-têtes, SANS lire le fichier", async () => {
    const r = await HEAD(requete("HEAD"), ctx(creerJetonMediaBuffer("f-reel")));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("video/mp4");
    expect(r.headers.get("content-length")).toBe(String(OCTETS.length));
    expect(r.headers.get("accept-ranges")).toBe("bytes");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(await lire(r)).toBe("");
    expect(r2).not.toHaveBeenCalled();
  });
  it("GET : le fichier entier en flux, l'adresse signée n'est utilisée qu'en interne", async () => {
    const r = await GET(requete("GET"), ctx(creerJetonMediaBuffer("f-reel")));
    expect(r.status).toBe(200);
    expect(await lire(r)).toBe("0123456789abcdefghij");
    expect(r.headers.get("content-type")).toBe("video/mp4");
    expect(r.headers.get("accept-ranges")).toBe("bytes");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(r2).toHaveBeenCalledTimes(1);
    expect(String(r2.mock.calls[0][0])).toContain("X-Amz-Signature");
    for (const [, valeur] of r.headers) expect(valeur).not.toMatch(/X-Amz|secret/i);
  });
  it("GET avec Range : 206 et Content-Range", async () => {
    const r = await GET(requete("GET", "bytes=5-9"), ctx(creerJetonMediaBuffer("f-reel")));
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe("bytes 5-9/20");
    expect(r.headers.get("content-length")).toBe("5");
    expect(await lire(r)).toBe("56789");
    expect(new Headers(r2.mock.calls[0][1].headers).get("range")).toBe("bytes=5-9");
  });
  it("Range hors du fichier : 416 ; Range mal formé : ignoré (fichier entier)", async () => {
    const jeton = creerJetonMediaBuffer("f-reel");
    expect((await GET(requete("GET", "bytes=50-"), ctx(jeton))).status).toBe(416);
    const r = await GET(requete("GET", "bytes=0-1,5-6"), ctx(jeton));
    expect(r.status).toBe(200);
    expect(new Headers(r2.mock.calls[1][1].headers).get("range")).toBeNull();
  });
  it("erreur R2 ou stockage injoignable : 502 propre, sans adresse signée ni secret", async () => {
    r2.mockResolvedValueOnce(new Response("<Error>AccessDenied</Error>", { status: 403 }));
    const r = await GET(requete("GET"), ctx(creerJetonMediaBuffer("f-reel")));
    expect(r.status).toBe(502);
    r2.mockRejectedValueOnce(new Error("connexion coupée https://compte-essai.r2.cloudflarestorage.com/?X-Amz-Signature=abc"));
    const r2bis = await GET(requete("GET"), ctx(creerJetonMediaBuffer("f-reel")));
    expect(r2bis.status).toBe(502);
    for (const texte of [await lire(r), await lire(r2bis), ...journaux]) expect(texte).not.toMatch(/X-Amz|secret-r2-essai|ACCES-ESSAI|compte-essai/);
  });
  it("limite de débit par jeton : 429 au-delà, un autre jeton n'est pas touché", async () => {
    const jeton = creerJetonMediaBuffer("f-reel");
    for (let i = 0; i < LIMITE_REQUETES_PAR_MINUTE; i++) expect((await HEAD(requete("HEAD"), ctx(jeton))).status).toBe(200);
    expect((await HEAD(requete("HEAD"), ctx(jeton))).status).toBe(429);
    expect((await HEAD(requete("HEAD"), ctx(creerJetonMediaBuffer("f-reel", Date.now() + 1000)))).status).toBe(200);
  });
});

describe("relais : refus", () => {
  it("jeton faux, expiré, illisible, ou nom autre que video.mp4 : le même 404", async () => {
    const t0 = Date.now() - (DUREE_JETON_MEDIA_BUFFER_SEC + 10) * 1000;
    const bon = creerJetonMediaBuffer("f-reel");
    const reponses = [
      await GET(requete("GET"), ctx(creerJetonMediaBuffer("f-reel", t0))),
      await GET(requete("GET"), ctx(`${bon.split(".")[0]}.AAAA`)),
      await GET(requete("GET"), ctx("n-importe-quoi")),
      await HEAD(requete("HEAD"), ctx(bon, "autre.mp4")),
    ];
    const corps = await Promise.all(reponses.map(lire));
    expect(reponses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    expect(new Set(corps).size).toBe(1);
    expect(r2).not.toHaveBeenCalled();
  });
  it("fichier inconnu : 404", async () => {
    expect((await GET(requete("GET"), ctx(creerJetonMediaBuffer("f-inconnu")))).status).toBe(404);
    expect((await HEAD(requete("HEAD"), ctx(creerJetonMediaBuffer("f-inconnu")))).status).toBe(404);
  });
  it("fichier de démonstration : refusé, même avec un jeton valide", async () => {
    const jeton = creerJetonMediaBuffer("f-demo");
    expect((await GET(requete("GET"), ctx(jeton))).status).toBe(404);
    expect((await HEAD(requete("HEAD"), ctx(jeton))).status).toBe(404);
    expect(r2).not.toHaveBeenCalled();
  });
});

describe("urlVideoPourBuffer", () => {
  it("rend l'adresse du relais : https, finit par /video.mp4, aucune signature R2, jeton valable pour ce fichier", async () => {
    const url = await urlVideoPourBuffer("f-reel");
    expect(url).toMatch(/^https:\/\/studio\.essai\.example\/api\/media-buffer\/[A-Za-z0-9_.-]+\/video\.mp4$/);
    expect(url).not.toMatch(/X-Amz|r2\.cloudflarestorage|seau-essai/i);
    const jeton = url.split("/").at(-2)!;
    expect(verifierJetonMediaBuffer(jeton)).toBe("f-reel");
    expect(url).not.toContain(process.env.SESSION_SECRET!);
  });
  it("garde : vidéo d'essai refusée, fichier absent hors ligne", async () => {
    await expect(urlVideoPourBuffer("f-demo")).rejects.toThrow(/essai|démonstration/i);
    await expect(urlVideoPourBuffer(undefined)).rejects.toMatchObject({ code: "FICHIER_HORS_LIGNE" });
    await expect(urlVideoPourBuffer("f-inconnu")).rejects.toMatchObject({ code: "FICHIER_HORS_LIGNE" });
  });
});
