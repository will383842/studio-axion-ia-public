/** RAP-3 finitions · cache mémoire BORNÉ de la miniature. Adresses et octets fictifs. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ sessionApi: vi.fn(), exigerSession: vi.fn() }));
const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const m = await import("@/services/miniature-diffuseur");

const rap = (id: string, url = `https://medias.exemple.test/${id}.jpg`) => ({ id, reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: "", creeLe: "x", modifieLe: "x", rapatrieeLe: "2026-11-20T10:00:00.000Z", mediaDiffuseur: { type: "image", nombre: 1, miniature: url } }) as never;
const publique = async () => ["93.184.216.34"];
const img = (octets = 10) => vi.fn(async () => new Response(new Uint8Array(octets), { status: 200, headers: { "content-type": "image/png", "content-length": String(octets) } }));
let t = 1_000_000;
const deps = (f: unknown, resoudre = publique) => ({ fetch: f as never, resoudre, maintenant: () => t });

beforeEach(() => { reinitialiserDepots(); m.viderCacheMiniatures(); t = 1_000_000; });

describe("RAP-3 finitions · cache de la miniature", () => {
  it("la 2e lecture ne rappelle pas le diffuseur ; expire après 1 h", async () => {
    await depots().publications.enregistrer(rap("zr_a"));
    const f = img();
    expect(await m.lireMiniatureDiffuseur("zr_a", deps(f))).not.toBeNull();
    expect(await m.lireMiniatureDiffuseur("zr_a", deps(f))).not.toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
    t += 3_600_001;
    await m.lireMiniatureDiffuseur("zr_a", deps(f));
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("lectures simultanées de la même clé : UNE seule lecture chez le diffuseur, partagée ; un échec n'est pas gardé", async () => {
    await depots().publications.enregistrer(rap("zr_a"));
    let ouvrir!: () => void;
    const porte = new Promise<void>((r) => (ouvrir = r));
    const f = vi.fn(async () => {
      await porte;
      return new Response(new Uint8Array(10), { status: 200, headers: { "content-type": "image/png" } });
    });
    const lectures = Array.from({ length: 5 }, () => m.lireMiniatureDiffuseur("zr_a", deps(f)));
    await new Promise((r) => setTimeout(r, 10));
    ouvrir();
    const res = await Promise.all(lectures);
    expect(f).toHaveBeenCalledTimes(1);
    expect(res.every((x) => x !== null && x.octets.byteLength === 10)).toBe(true);
    // clés différentes : lectures distinctes
    await depots().publications.enregistrer(rap("zr_b"));
    await m.lireMiniatureDiffuseur("zr_b", deps(f));
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("lecture en cours qui échoue : les suivantes réessaient (rien de gardé)", async () => {
    await depots().publications.enregistrer(rap("zr_a"));
    const f = vi.fn(async () => new Response("x", { status: 500 }));
    await Promise.all([m.lireMiniatureDiffuseur("zr_a", deps(f)), m.lireMiniatureDiffuseur("zr_a", deps(f))]);
    expect(f).toHaveBeenCalledTimes(1);
    await m.lireMiniatureDiffuseur("zr_a", deps(f));
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("la clé contient l'adresse : une adresse changée n'est pas servie depuis l'ancienne entrée", async () => {
    await depots().publications.enregistrer(rap("zr_a"));
    const f = img();
    await m.lireMiniatureDiffuseur("zr_a", deps(f));
    await depots().publications.modifier("zr_a", { mediaDiffuseur: { type: "image", nombre: 1, miniature: "https://medias.exemple.test/autre.jpg" } } as never);
    await m.lireMiniatureDiffuseur("zr_a", deps(f));
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("borné à 100 entrées : la plus ancienne part", async () => {
    const f = img();
    for (let i = 0; i < 101; i++) {
      await depots().publications.enregistrer(rap(`zr_${i}`));
      await m.lireMiniatureDiffuseur(`zr_${i}`, deps(f));
    }
    expect(m.tailleCacheMiniatures().entrees).toBe(100);
    await m.lireMiniatureDiffuseur("zr_0", deps(f));
    expect(f).toHaveBeenCalledTimes(102); // zr_0 évincée
    const avant = f.mock.calls.length;
    await m.lireMiniatureDiffuseur("zr_100", deps(f));
    expect(f).toHaveBeenCalledTimes(avant); // la dernière est restée
  });
  it("borné à 30 Mo au total", async () => {
    const f = img(4_900_000);
    for (let i = 0; i < 8; i++) {
      await depots().publications.enregistrer(rap(`zr_${i}`));
      await m.lireMiniatureDiffuseur(`zr_${i}`, deps(f));
    }
    expect(m.tailleCacheMiniatures().octets).toBeLessThanOrEqual(30_000_000);
    expect(m.tailleCacheMiniatures().entrees).toBe(6);
  });
  it("un refus de sécurité n'est gardé que quelques minutes, et n'empêche pas de relire ensuite", async () => {
    await depots().publications.enregistrer(rap("zr_a"));
    const f = img();
    let ips = ["10.0.0.1"];
    const resoudre = async () => ips;
    expect(await m.lireMiniatureDiffuseur("zr_a", deps(f, resoudre))).toBeNull();
    ips = ["93.184.216.34"];
    expect(await m.lireMiniatureDiffuseur("zr_a", deps(f, resoudre))).toBeNull(); // encore dans la fenêtre courte
    expect(f).not.toHaveBeenCalled();
    t += 5 * 60_000 + 1;
    expect(await m.lireMiniatureDiffuseur("zr_a", deps(f, resoudre))).not.toBeNull();
  });
  it("les échecs ordinaires (réseau, type) ne sont pas gardés", async () => {
    await depots().publications.enregistrer(rap("zr_a"));
    const ko = vi.fn(async () => { throw new Error("réseau"); });
    expect(await m.lireMiniatureDiffuseur("zr_a", deps(ko))).toBeNull();
    const f = img();
    expect(await m.lireMiniatureDiffuseur("zr_a", deps(f))).not.toBeNull();
  });
  it("une publication retirée n'est jamais servie depuis le cache", async () => {
    await depots().publications.enregistrer(rap("zr_a"));
    const f = img();
    await m.lireMiniatureDiffuseur("zr_a", deps(f));
    await depots().publications.modifier("zr_a", { retireeLe: "2026-11-20T11:00:00.000Z" } as never);
    expect(await m.lireMiniatureDiffuseur("zr_a", deps(f))).toBeNull();
  });
});
