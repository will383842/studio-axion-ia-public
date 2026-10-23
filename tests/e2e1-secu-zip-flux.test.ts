/**
 * VÉRIFICATION E2E-1 n° 2 (03/10) — téléchargement groupé AU FIL DE L'EAU, mémoire bornée.
 * Un « gros sujet » est simulé (plusieurs centaines de Mo produits morceau par morceau, jamais alloués d'un bloc) : on
 * prouve que l'archive ne lit jamais d'avance (au plus un morceau « en vol ») et que la mémoire ne grandit pas avec le
 * total. Puis la route elle-même : 401 sans session, flux tiré par le lecteur, fichier illisible → archive valide.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { crc32, fluxZip, lireZip, NOM_FICHIERS_ILLISIBLES, type EntreeFluxZip } from "@/lib/zip";

const sessionApi = vi.fn(async (): Promise<unknown> => ({ id: "s" }));
const contenuArchiveSujet = vi.fn();
vi.mock("@/services/auth", () => ({ sessionApi: () => sessionApi() }));
vi.mock("@/services/telechargements", () => ({
  cetteSemaine: () => ({ debut: "2026-09-28", fin: "2026-10-04" }),
  contenuArchiveSujet: (id: string) => contenuArchiveSujet(id),
  contenuArchiveReseau: vi.fn(),
}));

const MO = 1024 * 1024;

/** Lecteur LENT (un tour de boucle entre deux lectures) : laisse à un producteur trop pressé le temps de prendre de l'avance. */
const pause = () => new Promise<void>((r) => setImmediate(r));

/** Compteur de morceaux produits par les sources et lus par le lecteur de l'archive. */
function compteur() {
  return { produits: 0, lus: 0, avanceMax: 0 };
}

/** Source paresseuse : `n` morceaux d'1 Mo, le MÊME tampon rendu à chaque fois (rien n'est accumulé ici). */
async function* sourceLourde(n: number, c: ReturnType<typeof compteur>, motif = 7): AsyncGenerator<Uint8Array> {
  const tampon = new Uint8Array(MO).fill(motif);
  for (let i = 0; i < n; i++) {
    c.produits++;
    c.avanceMax = Math.max(c.avanceMax, c.produits - c.lus);
    yield tampon;
  }
}

async function lireTout(flux: ReadableStream<Uint8Array>, c?: ReturnType<typeof compteur>, garder = true): Promise<{ octets: number; zip: Uint8Array | null }> {
  const lecteur = flux.getReader();
  const morceaux: Uint8Array[] = [];
  let octets = 0;
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) break;
    await pause();
    octets += value.length;
    if (c && value.length === MO) c.lus++;
    if (garder) morceaux.push(value.slice());
  }
  if (!garder) return { octets, zip: null };
  const zip = new Uint8Array(octets);
  let p = 0;
  for (const m of morceaux) {
    zip.set(m, p);
    p += m.length;
  }
  return { octets, zip };
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionApi.mockClear();
});

describe("E2E-1 n° 2 · lib/zip : archive au fil de l'eau", () => {
  it("relue à l'identique : noms UTF-8, doublons renommés, CRC exacts, sous-titres et vidéos en morceaux", async () => {
    const enc = new TextEncoder();
    const video = new Uint8Array(300_000).map((_, i) => i % 251);
    const entrees: EntreeFluxZip[] = [
      { nom: "0042-AV-TT-données-9x16.mp4", ouvrir: async () => new Blob([video]).stream() },
      { nom: "0042-AV-TT-données.srt", ouvrir: async () => enc.encode("1\n00:00:00,000 --> 00:00:01,000\nÉté\n") },
      { nom: "0042-AV-TT-données.srt", ouvrir: async () => enc.encode("doublon") },
    ];
    const { zip } = await lireTout(fluxZip(entrees));
    const relu = lireZip(zip!);
    expect(relu.map((f) => f.nom)).toEqual(["0042-AV-TT-données-9x16.mp4", "0042-AV-TT-données.srt", "0042-AV-TT-données (2).srt"]);
    expect(crc32(relu[0].donnees)).toBe(crc32(video));
    expect(new TextDecoder().decode(relu[2].donnees)).toBe("doublon");
    // Répertoire central : CRC et tailles réels (les décompresseurs les lisent là).
    const v = new DataView(zip!.buffer);
    expect(v.getUint32(zip!.length - 22, true)).toBe(0x06054b50);
    expect(v.getUint16(zip!.length - 12, true)).toBe(3);
  });

  it("MÉMOIRE BORNÉE : 6 vidéos de 64 Mo (384 Mo) passent avec au plus un morceau lu d'avance", async () => {
    const c = compteur();
    const entrees: EntreeFluxZip[] = Array.from({ length: 6 }, (_, i) => ({ nom: `video-${i}.mp4`, ouvrir: async () => sourceLourde(64, c, i) }));
    (globalThis as { gc?: () => void }).gc?.();
    const avant = process.memoryUsage().heapUsed + process.memoryUsage().arrayBuffers;
    let pic = avant;
    const lecteur = fluxZip(entrees).getReader();
    let octets = 0;
    for (;;) {
      const { value, done } = await lecteur.read();
      if (done) break;
      await pause();
      octets += value.length;
      if (value.length === MO) c.lus++;
      if (c.lus % 32 === 0) pic = Math.max(pic, process.memoryUsage().heapUsed + process.memoryUsage().arrayBuffers);
    }
    expect(octets).toBeGreaterThan(384 * MO);
    expect(c.produits).toBe(384);
    expect(c.lus).toBe(384);
    // Tiré par le lecteur : jamais plus d'un morceau produit et pas encore lu.
    expect(c.avanceMax).toBeLessThanOrEqual(1);
    // Le total (384 Mo) n'a jamais été en mémoire : la croissance reste très en dessous.
    expect(pic - avant).toBeLessThan(64 * MO);
  }, 60_000);

  it("une vidéo illisible à l'ouverture est sautée ; une lecture coupée laisse un fichier incomplet ; l'archive reste valide", async () => {
    const enc = new TextEncoder();
    async function* coupee(): AsyncGenerator<Uint8Array> {
      yield enc.encode("début");
      throw new Error("réseau coupé");
    }
    const entrees: EntreeFluxZip[] = [
      { nom: "a.mp4", ouvrir: async () => enc.encode("A") },
      { nom: "b.mp4", ouvrir: async () => Promise.reject(new Error("fichier illisible (404)")) },
      { nom: "c.mp4", ouvrir: async () => coupee() },
    ];
    const relu = lireZip((await lireTout(fluxZip(entrees))).zip!);
    expect(relu.map((f) => f.nom)).toEqual(["a.mp4", "c.mp4", NOM_FICHIERS_ILLISIBLES]);
    const note = new TextDecoder().decode(relu[2].donnees);
    // Audit C (écran) : le nom du fichier seulement, jamais le code de réponse (« (404) ») ni le message brut.
    expect(note).toContain("\r\nb.mp4\r\n");
    expect(note).not.toContain("404");
    expect(note).toContain("c.mp4 (lecture interrompue : fichier incomplet)");
  });

  it("téléchargement abandonné : la source en cours est fermée, rien n'est lu au-delà", async () => {
    const c = compteur();
    let fermee = false;
    async function* source(): AsyncGenerator<Uint8Array> {
      try {
        yield* sourceLourde(1000, c);
      } finally {
        fermee = true;
      }
    }
    const lecteur = fluxZip([{ nom: "gros.mp4", ouvrir: async () => source() }]).getReader();
    for (let i = 0; i < 4; i++) await lecteur.read();
    await lecteur.cancel();
    expect(fermee).toBe(true);
    expect(c.produits).toBeLessThan(10);
  });
});

describe("E2E-1 n° 2 · /api/telechargements : la route envoie le flux", () => {
  async function route() {
    return import("@/app/api/telechargements/route");
  }

  it("401 sans session (rien n'est lu)", async () => {
    sessionApi.mockResolvedValueOnce(null);
    const { GET } = await route();
    const r = await GET(new NextRequest("http://localhost:3304/api/telechargements?sujet=s1"));
    expect(r.status).toBe(401);
  });

  it("gros sujet simulé (3 vidéos de 96 Mo) : flux tiré par le navigateur, au plus un morceau d'avance, vidéo 404 sautée", async () => {
    const c = compteur();
    contenuArchiveSujet.mockResolvedValue({
      nom: "0042-gros-sujet.zip",
      entrees: [
        { nom: "0042-AV-TT-9x16.mp4", url: "/api/depots/v1.mp4" },
        { nom: "0042-AV-IG-9x16.mp4", url: "https://r2.exemple/v2.mp4" },
        { nom: "0042-AV-YT-9x16.mp4", url: "/api/depots/v3.mp4" },
        { nom: "0042-AV-LI-9x16.mp4", url: "/api/depots/absente.mp4" },
        { nom: "0042-AV-TT.srt", contenu: "1\n00:00:00,000 --> 00:00:01,000\nBonjour\n" },
      ],
    });
    const appels: { url: string; cookie: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: URL, init?: RequestInit) => {
      const cookie = new Headers(init?.headers).get("cookie");
      appels.push({ url: String(url), cookie });
      if (String(url).includes("absente")) return new Response("introuvable", { status: 404 });
      const it = sourceLourde(96, c);
      const corps = new ReadableStream<Uint8Array>(
        {
          async pull(ctl) {
            const { value, done } = await it.next();
            if (done) ctl.close();
            else ctl.enqueue(value);
          },
        },
        { highWaterMark: 0 },
      );
      return new Response(corps, { status: 200 });
    });
    const { GET } = await route();
    const r = await GET(new NextRequest("http://localhost:3304/api/telechargements?sujet=s1", { headers: { cookie: "studio_session=jeton" } }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/zip");
    expect(r.headers.get("content-length")).toBeNull();
    // Rien n'est ouvert avant que le navigateur ne lise : la réponse part tout de suite.
    expect(appels).toHaveLength(0);
    const { octets } = await lireTout(r.body!, c, false);
    expect(octets).toBeGreaterThan(288 * MO);
    expect(c.lus).toBe(288);
    expect(c.avanceMax).toBeLessThanOrEqual(2);
    // Les adresses du studio sont lues avec le cookie de la session ; jamais une adresse extérieure.
    expect(appels.map((a) => [a.url, a.cookie])).toEqual([
      ["http://localhost:3304/api/depots/v1.mp4", "studio_session=jeton"],
      ["https://r2.exemple/v2.mp4", null],
      ["http://localhost:3304/api/depots/v3.mp4", "studio_session=jeton"],
      ["http://localhost:3304/api/depots/absente.mp4", "studio_session=jeton"],
    ]);
  }, 60_000);

  it("contenu de l'archive : les entrées du service telles quelles, plus la note des fichiers illisibles", async () => {
    contenuArchiveSujet.mockResolvedValue({
      nom: "0042-x.zip",
      entrees: [
        { nom: "0042-x-9x16.mp4", url: "/v.mp4" },
        { nom: "0042-x.srt", contenu: "1\n00:00:00,000 --> 00:00:01,000\nBonjour\n" },
        { nom: "0042-x-1x1.mp4", url: "/manque.mp4" },
      ],
    });
    vi.stubGlobal("fetch", async (url: URL) => (String(url).includes("manque") ? new Response("", { status: 404 }) : new Response(new Uint8Array([1, 2, 3]))));
    const { GET } = await route();
    const r = await GET(new NextRequest("http://localhost:3304/api/telechargements?sujet=s1"));
    const relu = lireZip((await lireTout(r.body!)).zip!);
    expect(relu.map((f) => f.nom)).toEqual(["0042-x-9x16.mp4", "0042-x.srt", NOM_FICHIERS_ILLISIBLES]);
    expect([...relu[0].donnees]).toEqual([1, 2, 3]);
    expect(new TextDecoder().decode(relu[1].donnees)).toBe("1\n00:00:00,000 --> 00:00:01,000\nBonjour\n");
    expect(new TextDecoder().decode(relu[2].donnees)).toContain("0042-x-1x1.mp4");
    expect(new TextDecoder().decode(relu[2].donnees)).not.toContain("404");
  });
});
