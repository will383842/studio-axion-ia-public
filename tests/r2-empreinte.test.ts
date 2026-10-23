/**
 * Empreinte SHA-256 d'un objet R2, lue en continu (mémoire constante). Aucun réseau : `fetch` est un double.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { creerStockageR2 } from "@/fournisseurs/r2/stockage";

const CONFIG = { compte: "c", cleAcces: "CLE", secret: "SECRET", seau: "seau", hote: "c.r2.cloudflarestorage.com", env: "dev" as const };
const CLE = "studio/dev/entree/image-video/f-01/f-01.jpg";

const MORCEAUX = [new Uint8Array([1, 2, 3, 4]), new Uint8Array([5, 6]), new Uint8Array([7, 8, 9, 10, 11])];
const TOUT = Buffer.concat(MORCEAUX);

const flux = (morceaux: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(c) {
      for (const m of morceaux) c.enqueue(m);
      c.close();
    },
  });

describe("empreinteSha256 (R2)", () => {
  it("rend le SHA-256 en hexadécimal minuscule des octets entiers, lus en 3 morceaux", async () => {
    const fetchFaux = (async () => new Response(flux(MORCEAUX), { status: 200 })) as unknown as typeof fetch;
    const s = creerStockageR2(CONFIG, { fetch: fetchFaux });
    const r = await s.empreinteSha256!(CLE, TOUT.length);
    expect(r.sha256).toBe(createHash("sha256").update(TOUT).digest("hex"));
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(r.taille).toBe(TOUT.length);
  });

  it("rejette si le nombre d'octets lus n'est pas la taille attendue", async () => {
    const s = creerStockageR2(CONFIG, { fetch: (async () => new Response(flux(MORCEAUX))) as unknown as typeof fetch });
    await expect(s.empreinteSha256!(CLE, TOUT.length + 1)).rejects.toThrow();
    await expect(s.empreinteSha256!(CLE, TOUT.length - 1)).rejects.toThrow();
  });

  it("rejette un 404 avec statut 404", async () => {
    const s = creerStockageR2(CONFIG, { fetch: (async () => new Response("absent", { status: 404 })) as unknown as typeof fetch });
    await expect(s.empreinteSha256!(CLE, 1)).rejects.toMatchObject({ statut: 404 });
  });

  it("fait un GET signé complet, sans en-tête range", async () => {
    const vus: { url: string; init?: RequestInit }[] = [];
    const fetchFaux = (async (url: string, init?: RequestInit) => {
      vus.push({ url, init });
      return new Response(flux(MORCEAUX));
    }) as unknown as typeof fetch;
    const s = creerStockageR2(CONFIG, { fetch: fetchFaux });
    await s.empreinteSha256!(CLE, TOUT.length);
    expect(vus).toHaveLength(1);
    expect(vus[0].init?.method ?? "GET").toBe("GET");
    expect(vus[0].url).toContain("X-Amz-Signature=");
    const entetes = new Headers(vus[0].init?.headers);
    expect(entetes.has("range")).toBe(false);
    expect(entetes.get("accept-encoding")).toBe("identity");
    expect(vus[0].init?.signal).toBeDefined();
  });
});
