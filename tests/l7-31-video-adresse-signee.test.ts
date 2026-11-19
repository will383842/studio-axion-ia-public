/**
 * Étape 1 du retrait de l'ancien outil : la vidéo part comme les visuels, par une adresse de stockage signée courte
 * (GET, 3 600 s). Plus aucun jeton public /api/media-buffer/ (30 jours) n'est émis à l'envoi ; la route, le relais et le
 * jeton restent en place pour les envois déjà programmés (retrait dans une PR suivante).
 * Remplace tests/l7-31-relais-media-vivant.test.ts (qui prouvait l'ancien chemin).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.SESSION_SECRET = "secret-de-session-essai-0123456789-abcdef";
process.env.FOURNISSEUR_STOCKAGE = "r2";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-r2-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.STUDIO_ADRESSE = "https://studio.essai.example/";

const { urlVideoPourBuffer } = await import("@/services/publications");
const { depots } = await import("@/services/_commun");
const { phraseLisible } = await import("@/lib/erreur-lisible");
const { lecteurMediaParDefaut } = await import("@/fournisseurs/publication/zernio-medias");

const racine = process.cwd();
const horo = { creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z" };
const enregistrer = (id: string, cleStockage: string) =>
  depots().fichiers.enregistrer({ id, cleStockage, nom: `${id}.mp4`, taille: 20, mime: "video/mp4", origine: "genere", statut: "pret", ...horo } as never);

beforeEach(async () => {
  await enregistrer("f-reel", "studio/prod/videos/v1/f-reel.mp4");
  await enregistrer("f-demo", "/demo/avocat-1.mp4");
});
afterEach(() => vi.restoreAllMocks());

describe("la vidéo part par une adresse de stockage signée courte", () => {
  it("adresse signée du stockage (https, GET, 3 600 s), jamais /api/media-buffer/", async () => {
    const url = await urlVideoPourBuffer("f-reel");
    const u = new URL(url);
    expect(u.protocol).toBe("https:");
    expect(url).not.toContain("/api/media-buffer/");
    expect(url).not.toContain("studio.essai.example");
    expect(u.hostname).toMatch(/r2\.cloudflarestorage\.com$/);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(u.pathname.endsWith(".mp4")).toBe(true);
    expect(url).not.toContain(process.env.SESSION_SECRET!);
  });

  it("garde : vidéo d'essai refusée, fichier absent hors ligne", async () => {
    await expect(urlVideoPourBuffer("f-demo")).rejects.toThrow(/essai|démonstration/i);
    await expect(urlVideoPourBuffer(undefined)).rejects.toMatchObject({ code: "FICHIER_HORS_LIGNE" });
    await expect(urlVideoPourBuffer("f-inconnu")).rejects.toMatchObject({ code: "FICHIER_HORS_LIGNE" });
  });

  it("l'adresse est lue comme avant par le Studio : même flux, même Content-Length", async () => {
    const url = await urlVideoPourBuffer("f-reel");
    const octets = new TextEncoder().encode("0123456789abcdefghij");
    const fetchEssai = vi.fn(async () => new Response(octets, { status: 200, headers: { "content-length": "20", "content-type": "video/mp4" } }));
    vi.stubGlobal("fetch", fetchEssai);
    const lu = await lecteurMediaParDefaut(url);
    vi.unstubAllGlobals();
    expect(fetchEssai).toHaveBeenCalledWith(url, expect.objectContaining({ redirect: "error" }));
    expect(lu.taille).toBe(20);
    expect(lu.contentType).toBe("video/mp4");
  });

  it("aucune adresse signée dans un message : phraseLisible la refuse", async () => {
    const url = await urlVideoPourBuffer("f-reel");
    expect(phraseLisible(`La vidéo n'a pas pu être lue ${url}`)).toBe(false);
    expect(phraseLisible(`La vidéo n'a pas pu être lue (${url.split("?")[1]})`)).toBe(false);
    expect(phraseLisible(encodeURIComponent(`Lecture refusée pour ${url}`))).toBe(false);
  });

  it("la route de l'ancienne adresse reste en place pour les envois déjà programmés", () => {
    expect(existsSync(join(racine, "src/app/api/media-buffer/[jeton]/[nom]/route.ts"))).toBe(true);
    expect(existsSync(join(racine, "src/services/relais-buffer.ts"))).toBe(true);
    expect(existsSync(join(racine, "src/lib/jeton-media-buffer.ts"))).toBe(true);
    expect(readFileSync(join(racine, "src/services/publications.ts"), "utf8")).not.toMatch(/adresseRelaisBuffer/);
  });
});

describe("l'adresse est signée juste avant chaque téléversement", () => {
  it("la source de l'envoi signe l'adresse dans la boucle d'envoi (pas pendant la préparation)", () => {
    const src = readFileSync(join(racine, "src/services/publications.ts"), "utf8");
    expect(src).toMatch(/fichierCle: await urlVideoPourBuffer\(p\.fichierId\)/);
    expect(src).not.toMatch(/fichierCle: p\.url/);
  });
});
