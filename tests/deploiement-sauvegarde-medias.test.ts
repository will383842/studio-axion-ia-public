/**
 * L2-12a · copie du delta des médias (R2_BUCKET → R2_BUCKET_SECOURS) par deploiement/copier-r2.mjs.
 * Aucun réseau, aucun vrai seau : un faux S3 en mémoire reçoit les requêtes (`appeler` injecté).
 * Le faux S3 FAIT ÉCHOUER le test s'il reçoit une requête DELETE.
 */
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ENV = {
  R2_ACCOUNT_ID: "compte",
  R2_ACCESS_KEY_ID: "CLEACCES",
  R2_SECRET_ACCESS_KEY: "secret-faux",
  R2_BUCKET: "source",
  R2_BUCKET_SECOURS: "secours",
};
const TAILLE_PAGE = 2;

function echapper(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fauxS3(initial: Record<string, Record<string, string>>) {
  const seaux: Record<string, Map<string, string>> = {};
  for (const [nom, objets] of Object.entries(initial)) seaux[nom] = new Map(Object.entries(objets));
  const requetes: string[] = [];
  const appeler = (async (url: string, init: { method?: string; body?: unknown } = {}) => {
    const u = new URL(url);
    const methode = init.method ?? "GET";
    requetes.push(`${methode} ${u.pathname}`);
    if (methode === "DELETE") throw new Error(`REQUÊTE DELETE INTERDITE : ${u.pathname}`);
    const [, seau, ...morceaux] = decodeURIComponent(u.pathname).split("/");
    const cle = morceaux.join("/");
    const contenu = seaux[seau];
    if (!contenu) return new Response(null, { status: 404 });
    if (methode === "GET" && cle === "") {
      const cles = [...contenu.keys()].sort();
      const debut = Number(u.searchParams.get("continuation-token") ?? "0");
      const page = cles.slice(debut, debut + TAILLE_PAGE);
      const suite = debut + TAILLE_PAGE < cles.length;
      const xml =
        `<?xml version="1.0"?><ListBucketResult><IsTruncated>${suite}</IsTruncated>` +
        page.map((k) => `<Contents><Key>${echapper(k)}</Key><Size>${contenu.get(k)!.length}</Size></Contents>`).join("") +
        (suite ? `<NextContinuationToken>${debut + TAILLE_PAGE}</NextContinuationToken>` : "") +
        `</ListBucketResult>`;
      return new Response(xml, { status: 200 });
    }
    if (methode === "HEAD") {
      const v = contenu.get(cle);
      return v === undefined ? new Response(null, { status: 404 }) : new Response(null, { status: 200, headers: { "content-length": String(v.length) } });
    }
    if (methode === "GET") {
      const v = contenu.get(cle);
      return v === undefined ? new Response(null, { status: 404 }) : new Response(v, { status: 200 });
    }
    if (methode === "PUT") {
      if (contenu.has(cle)) throw new Error(`ÉCRASEMENT INTERDIT : ${seau}/${cle}`);
      contenu.set(cle, Buffer.from(init.body as Uint8Array).toString("utf8"));
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 500 });
  }) as unknown as typeof fetch;
  return { seaux, requetes, appeler };
}

const SOURCE = { "a/1.jpg": "aaaa", "a/2.jpg": "bbbbb", "b/3 é&.png": "cc", "b/4.mp4": "dddddd", "c/5.webp": "e" };

describe("L2-12a · lister", () => {
  it("suit la pagination ListObjectsV2 (3 pages) et rend une ligne JSON {cle, taille} par objet", async () => {
    const { listerObjets, lignesListe } = await import("../deploiement/copier-r2.mjs");
    const s3 = fauxS3({ source: SOURCE, secours: {} });
    const objets = await listerObjets({ env: ENV, cible: "source", appeler: s3.appeler });
    expect(objets).toHaveLength(5);
    expect(s3.requetes.filter((r) => r.startsWith("GET /source"))).toHaveLength(3);
    expect(objets).toContainEqual({ cle: "b/3 é&.png", taille: 2 });
    const lignes = lignesListe(objets).split("\n");
    expect(lignes).toHaveLength(5);
    expect(JSON.parse(lignes[0])).toEqual({ cle: "a/1.jpg", taille: 4 });
  });
});

describe("L2-12a · medias-delta", () => {
  it("copie seulement le delta ; une relance ne copie rien ; jamais de DELETE", async () => {
    const { copierDelta } = await import("../deploiement/copier-r2.mjs");
    const s3 = fauxS3({ source: SOURCE, secours: { "a/1.jpg": "aaaa" } });
    const premier = await copierDelta({ env: ENV, appeler: s3.appeler });
    expect(premier).toEqual({ copies: 4, deja: 1, echecs: 0 });
    expect([...s3.seaux.secours.keys()].sort()).toEqual(Object.keys(SOURCE).sort());
    expect(s3.seaux.secours.get("b/3 é&.png")).toBe("cc");
    const relance = await copierDelta({ env: ENV, appeler: s3.appeler });
    expect(relance).toEqual({ copies: 0, deja: 5, echecs: 0 });
    expect(s3.requetes.some((r) => r.startsWith("DELETE"))).toBe(false);
  });

  it("même clé et autre taille : échec, rien n'est écrasé, les autres objets sont quand même copiés", async () => {
    const { copierDelta } = await import("../deploiement/copier-r2.mjs");
    const s3 = fauxS3({ source: SOURCE, secours: { "a/2.jpg": "different-et-plus-long" } });
    const r = await copierDelta({ env: ENV, appeler: s3.appeler });
    expect(r).toEqual({ copies: 4, deja: 0, echecs: 1 });
    expect(s3.seaux.secours.get("a/2.jpg")).toBe("different-et-plus-long");
  });

  it("un PUT refusé compte en échec sans arrêter la copie", async () => {
    const { copierDelta } = await import("../deploiement/copier-r2.mjs");
    const s3 = fauxS3({ source: SOURCE, secours: {} });
    const appeler = (async (url: string, init: { method?: string }) =>
      init.method === "PUT" && decodeURIComponent(url).includes("a/1.jpg") ? new Response(null, { status: 500 }) : s3.appeler(url, init as never)) as unknown as typeof fetch;
    const r = await copierDelta({ env: ENV, appeler });
    expect(r).toEqual({ copies: 4, deja: 0, echecs: 1 });
  });

  it("R2_BUCKET_SECOURS absent : erreur dédiée, zéro requête", async () => {
    const { copierDelta, ErreurSecoursAbsent } = await import("../deploiement/copier-r2.mjs");
    const s3 = fauxS3({ source: SOURCE, secours: {} });
    const { R2_BUCKET_SECOURS: _omis, ...sansSecours } = ENV;
    await expect(copierDelta({ env: sansSecours, appeler: s3.appeler })).rejects.toBeInstanceOf(ErreurSecoursAbsent);
    expect(s3.requetes).toHaveLength(0);
  });
});

describe("L2-12a · ligne de commande (aucun réseau)", () => {
  const lancer = (args: string[], env: Record<string, string>) =>
    spawnSync(process.execPath, ["deploiement/copier-r2.mjs", ...args], { env: { PATH: process.env.PATH ?? "", ...env }, encoding: "utf8", timeout: 20_000 });

  it("medias-delta sans R2_BUCKET_SECOURS : code 3, message clair, sans secret", () => {
    const { R2_BUCKET_SECOURS: _omis, ...sansSecours } = ENV;
    const r = lancer(["medias-delta"], sansSecours);
    expect(r.status).toBe(3);
    expect(r.stderr).toContain("R2_BUCKET_SECOURS");
    expect(r.stderr + r.stdout).not.toContain("secret-faux");
  });

  it("lister avec une cible inconnue : code 2", () => {
    expect(lancer(["lister", "autre"], ENV).status).toBe(2);
  });

  it("lister secours sans R2_BUCKET_SECOURS : code 3", () => {
    const { R2_BUCKET_SECOURS: _omis, ...sansSecours } = ENV;
    expect(lancer(["lister", "secours"], sansSecours).status).toBe(3);
  });
});
