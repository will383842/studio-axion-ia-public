/**
 * LOT S1 — lister les objets d'un dossier du stockage (ListObjectsV2) pour effacer ceux d'une vidéo supprimée.
 * Aucun réseau : `fetch` est un double. La GARDE STRICTE refuse tout préfixe qui ne désigne pas le dossier d'UNE vidéo.
 */
import { describe, expect, it, vi } from "vitest";
import { dossierPropreValide, prefixesDeVideo } from "@/domaine/dossiers-video";
import { creerStockageR2 } from "@/fournisseurs/r2/stockage";

const CONFIG = { compte: "c", cleAcces: "CLE", secret: "SECRET", seau: "seau", hote: "c.r2.cloudflarestorage.com", env: "dev" as const };
const PREFIXE = "studio/dev/videos/v-01/";

const page = (cles: string[], suite?: string) =>
  `<?xml version="1.0"?><ListBucketResult>${cles.map((k) => `<Contents><Key>${k}</Key></Contents>`).join("")}<IsTruncated>${suite ? "true" : "false"}</IsTruncated>${suite ? `<NextContinuationToken>${suite}</NextContinuationToken>` : ""}</ListBucketResult>`;

describe("listerPrefixe (R2)", () => {
  it("demande ListObjectsV2 signé sur le seau avec le préfixe, en GET", async () => {
    const urls: string[] = [];
    const fetchFaux = (async (url: string, init?: RequestInit) => {
      urls.push(`${init?.method ?? "GET"} ${url}`);
      return new Response(page([`${PREFIXE}a.mp4`]));
    }) as unknown as typeof fetch;
    const s = creerStockageR2(CONFIG, { fetch: fetchFaux });
    expect(await s.listerPrefixe!(PREFIXE)).toEqual([`${PREFIXE}a.mp4`]);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^GET https:\/\/c\.r2\.cloudflarestorage\.com\/seau\?/);
    expect(urls[0]).toContain("list-type=2");
    expect(urls[0]).toContain("prefix=studio%2Fdev%2Fvideos%2Fv-01%2F");
    expect(urls[0]).toContain("X-Amz-Signature=");
  });

  it("suit les pages (jeton de suite) et s'arrête à 20 pages", async () => {
    let n = 0;
    const jetons: (string | null)[] = [];
    const fetchFaux = (async (url: string) => {
      n++;
      jetons.push(new URL(url).searchParams.get("continuation-token"));
      return new Response(page([`${PREFIXE}p${n}.bin`], n < 3 ? `jeton-${n}` : undefined));
    }) as unknown as typeof fetch;
    const s = creerStockageR2(CONFIG, { fetch: fetchFaux });
    expect(await s.listerPrefixe!(PREFIXE)).toEqual([`${PREFIXE}p1.bin`, `${PREFIXE}p2.bin`, `${PREFIXE}p3.bin`]);
    expect(jetons).toEqual([null, "jeton-1", "jeton-2"]);

    n = 0;
    const sans_fin = (async () => {
      n++;
      return new Response(page([`${PREFIXE}x${n}.bin`], "encore"));
    }) as unknown as typeof fetch;
    const t = creerStockageR2(CONFIG, { fetch: sans_fin });
    expect((await t.listerPrefixe!(PREFIXE)).length).toBe(20);
    expect(n).toBe(20);
  });

  it("ne rend que des clés qui commencent par le préfixe", async () => {
    const fetchFaux = (async () => new Response(page([`${PREFIXE}a.mp4`, "studio/dev/videos/v-012/b.mp4", "autre/chose"]))) as unknown as typeof fetch;
    const s = creerStockageR2(CONFIG, { fetch: fetchFaux });
    expect(await s.listerPrefixe!(PREFIXE)).toEqual([`${PREFIXE}a.mp4`]);
  });

  it("au-delà de 20 pages la liste tronquée est dite au journal du serveur (objets possiblement orphelins)", async () => {
    let n = 0;
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchFaux = (async () => (n++, new Response(page([`${PREFIXE}p${n}.bin`], `jeton-${n}`)))) as unknown as typeof fetch;
    const s = creerStockageR2(CONFIG, { fetch: fetchFaux });
    expect(await s.listerPrefixe!(PREFIXE)).toHaveLength(20);
    expect(journal).toHaveBeenCalledWith(expect.stringContaining("tronquée"), PREFIXE);
    journal.mockRestore();
  });

  it("refuse un préfixe vide, qui remonte (../) ou hors de « studio/ », sans appeler le réseau", async () => {
    let appels = 0;
    const s = creerStockageR2(CONFIG, { fetch: (async () => (appels++, new Response(page([])))) as unknown as typeof fetch });
    for (const p of ["", "/", "../", "studio/dev/../prod/videos/v-01/", "autre/v-01/"]) await expect(s.listerPrefixe!(p), p).rejects.toThrow();
    expect(appels).toBe(0);
  });
});

describe("garde stricte du dossier d'une vidéo", () => {
  it("accepte exactement le dossier d'une vidéo, barre finale comprise", () => {
    for (const d of ["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes"]) {
      expect(dossierPropreValide(`studio/dev/${d}/v-01/`), d).toBe(true);
      expect(dossierPropreValide(`studio/prod/${d}/v_01/`), d).toBe(true);
    }
  });
  it("refuse vide, racine, dossier de type seul, remontée, id voisin sans barre, autre dossier", () => {
    for (const p of ["", "studio/", "studio/prod/", "studio/prod/videos/", "studio/dev/videos/v-01", "studio/dev/videos/../", "studio/dev/videos/v-01/../", "studio/dev/videos/v-01/x/", "studio/dev/elements/v-01/", "studio/test/videos/v-01/", "/studio/dev/videos/v-01/", "studio/dev/videos//"]) {
      expect(dossierPropreValide(p), p).toBe(false);
    }
  });
  it("prefixesDeVideo : les 5 dossiers de l'environnement, et une erreur pour un id hors convention (rien n'est effacé)", () => {
    expect(prefixesDeVideo("dev", "v-01")).toEqual(["audio-maitre", "videos", "facecam-animee", "image-video", "fiches-scenes"].map((d) => `studio/dev/${d}/v-01/`));
    for (const id of ["", "..", "v/01", "v-01/../x", "v 01"]) expect(() => prefixesDeVideo("dev", id), id).toThrow();
  });
});
