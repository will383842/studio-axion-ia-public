/** RAP-3 · miniature d'une rapatriée : lue côté serveur, sans desserrer la CSP. Adresses et octets fictifs. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deciderRapatriement } from "@/domaine/rapatriement-zernio";

const session = vi.fn(async () => ({}) as object | null);
vi.mock("@/services/auth", () => ({ sessionApi: session, exigerSession: session }));
const { depots, reinitialiserDepots } = await import("@/donnees/memoire");
const { adresseMiniatureSure, lireMiniatureDiffuseur } = await import("@/services/miniature-diffuseur");

const vide = { idsExternes: new Set<string>(), clesEnvoi: new Set<string>(), clesCreneaux: new Set<string>() };
const post = (items: unknown[]) => ({ _id: "p1", status: "scheduled", scheduledFor: "2026-11-25T08:30:00Z", platforms: [{ platform: "instagram", accountId: "c1" }], content: "x", mediaItems: items }) as never;
const miniatureDe = (items: unknown[]) => deciderRapatriement([post(items)], vide, { instant: "2026-11-20T10:00:00.000Z" }).aCreer[0].mediaDiffuseur;

describe("RAP-3 · adresse gardée au rapatriement", () => {
  it("image https : gardée ; vidéo : sa vignette seulement ; http, document : rien", () => {
    expect(miniatureDe([{ type: "image", url: "https://medias.exemple.test/a.jpg" }])).toMatchObject({ type: "image", nombre: 1, miniature: "https://medias.exemple.test/a.jpg" });
    expect(miniatureDe([{ type: "video", url: "https://medias.exemple.test/v.mp4", thumbnail: "https://medias.exemple.test/v.jpg" }])?.miniature).toBe("https://medias.exemple.test/v.jpg");
    expect(miniatureDe([{ type: "video", url: "https://medias.exemple.test/v.mp4" }])?.miniature).toBeUndefined();
    expect(miniatureDe([{ type: "image", url: "http://medias.exemple.test/a.jpg" }])?.miniature).toBeUndefined();
    expect(miniatureDe([{ type: "document", url: "https://medias.exemple.test/d.pdf" }])?.miniature).toBeUndefined();
  });
});

describe("RAP-3 · adresse sûre", () => {
  it.each(["http://medias.exemple.test/a.jpg", "https://127.0.0.1/a.jpg", "https://10.0.0.4/a.jpg", "https://[::1]/a.jpg", "https://localhost/a.jpg", "https://u:p@medias.exemple.test/a.jpg", "https://machine.internal/a.jpg", "https://localhost./a.jpg", "https://machine.internal./a.jpg", "https://LOCALHOST./a.jpg", "https://2130706433/a.jpg", "javascript:alert(1)", "//medias.exemple.test/a.jpg", ""])("refuse %s", (u) => expect(adresseMiniatureSure(u)).toBe(false));
  it("accepte une adresse https publique", () => expect(adresseMiniatureSure("https://medias.exemple.test/a.jpg")).toBe(true));
});

describe("RAP-3 · lecture de la miniature", () => {
  const rap = { id: "zr_p1_c1", reseau: "instagram", statut: "programmee", via: "zernio", date: "2026-11-25T08:30:00.000Z", texte: "", creeLe: "x", modifieLe: "x", rapatrieeLe: "2026-11-20T10:00:00.000Z", mediaDiffuseur: { type: "image", nombre: 1, miniature: "https://medias.exemple.test/a.jpg" } };
  beforeEach(() => reinitialiserDepots());
  const publique = async () => ["93.184.216.34"];
  const rep = (type: string, octets = 10, statut = 200) => vi.fn(async () => new Response(new Uint8Array(octets), { status: statut, headers: { "content-type": type, "content-length": String(octets) } }));
  it("rend les octets et le type d'une image ; la requête ne suit aucune redirection ni ne porte d'identifiant", async () => {
    await depots().publications.enregistrer(rap as never);
    const f = rep("image/jpeg");
    const r = await lireMiniatureDiffuseur("zr_p1_c1", { resoudre: publique, fetch: f as never });
    expect(r).toMatchObject({ type: "image/jpeg" });
    const init = (f.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(JSON.stringify(init.headers ?? {})).not.toMatch(/authorization|cookie/i);
  });
  it("null : inconnue, non rapatriée, sans miniature, type non image, trop lourde, erreur réseau, statut ≠ 200", async () => {
    await depots().publications.enregistrer(rap as never);
    await depots().publications.enregistrer({ ...rap, id: "pub_s", visuelId: "v" } as never);
    await depots().publications.enregistrer({ ...rap, id: "zr_sans", mediaDiffuseur: { type: "image", nombre: 1 } } as never);
    expect(await lireMiniatureDiffuseur("inconnue", { resoudre: publique, fetch: rep("image/jpeg") as never })).toBeNull();
    expect(await lireMiniatureDiffuseur("pub_s", { resoudre: publique, fetch: rep("image/jpeg") as never })).toBeNull();
    expect(await lireMiniatureDiffuseur("zr_sans", { resoudre: publique, fetch: rep("image/jpeg") as never })).toBeNull();
    expect(await lireMiniatureDiffuseur("zr_p1_c1", { resoudre: publique, fetch: rep("text/html") as never })).toBeNull();
    expect(await lireMiniatureDiffuseur("zr_p1_c1", { resoudre: publique, fetch: rep("image/jpeg", 6_000_000) as never })).toBeNull();
    expect(await lireMiniatureDiffuseur("zr_p1_c1", { resoudre: publique, fetch: vi.fn(async () => { throw new Error("réseau"); }) as never })).toBeNull();
    expect(await lireMiniatureDiffuseur("zr_p1_c1", { resoudre: publique, fetch: rep("image/jpeg", 10, 302) as never })).toBeNull();
  });
  it.each([
    ["nom résolu en 127.0.0.1", "https://medias.exemple.test/a.jpg", ["127.0.0.1"]],
    ["nom résolu en 10.0.0.1", "https://medias.exemple.test/a.jpg", ["10.0.0.1"]],
    ["nom résolu en 169.254.169.254 (métadonnées)", "https://medias.exemple.test/a.jpg", ["169.254.169.254"]],
    ["nom résolu en IPv6 ::1", "https://medias.exemple.test/a.jpg", ["::1"]],
    ["une adresse publique et une privée", "https://medias.exemple.test/a.jpg", ["93.184.216.34", "192.168.1.5"]],
    ["aucune adresse", "https://medias.exemple.test/a.jpg", []],
    ["hôte « localhost. » (point final)", "https://localhost./a.jpg", ["93.184.216.34"]],
    ["IP littérale non publique", "https://10.0.0.1/a.jpg", ["93.184.216.34"]],
  ])("refuse sans rien lire : %s", async (_n, adresse, ips) => {
    await depots().publications.enregistrer({ ...rap, mediaDiffuseur: { type: "image", nombre: 1, miniature: adresse } } as never);
    const f = rep("image/jpeg");
    expect(await lireMiniatureDiffuseur("zr_p1_c1", { fetch: f as never, resoudre: async () => ips })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("résolution en échec : refus sans lecture ; hôte résolu après normalisation (minuscules, sans point final)", async () => {
    await depots().publications.enregistrer(rap as never);
    const f = rep("image/jpeg");
    expect(await lireMiniatureDiffuseur("zr_p1_c1", { fetch: f as never, resoudre: async () => { throw new Error("dns"); } })).toBeNull();
    expect(f).not.toHaveBeenCalled();
    await depots().publications.enregistrer({ ...rap, mediaDiffuseur: { type: "image", nombre: 1, miniature: "https://Medias.Exemple.Test./a.jpg" } } as never);
    const demandes: string[] = [];
    const ok = await lireMiniatureDiffuseur("zr_p1_c1", { fetch: f as never, resoudre: async (h) => { demandes.push(h); return ["93.184.216.34"]; } });
    expect(ok).not.toBeNull();
    expect(demandes).toEqual(["medias.exemple.test"]);
  });
  it("redirection (302 avec Location) : rien rendu ; https seulement", async () => {
    await depots().publications.enregistrer(rap as never);
    const redir = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://127.0.0.1/x.jpg", "content-type": "image/jpeg" } }));
    expect(await lireMiniatureDiffuseur("zr_p1_c1", { fetch: redir as never, resoudre: publique })).toBeNull();
    expect(((redir.mock.calls[0] as unknown[])[1] as RequestInit).redirect).toBe("manual");
    await depots().publications.enregistrer({ ...rap, mediaDiffuseur: { type: "image", nombre: 1, miniature: "http://medias.exemple.test/a.jpg" } } as never);
    const f = rep("image/jpeg");
    expect(await lireMiniatureDiffuseur("zr_p1_c1", { fetch: f as never, resoudre: publique })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
  it("route : 401 sans session ; 404 sans miniature", async () => {
    const { GET } = await import("@/app/api/calendrier/miniature/[id]/route");
    session.mockResolvedValueOnce(null);
    expect((await GET(new Request("http://x") as never, { params: Promise.resolve({ id: "zr_p1_c1" }) })).status).toBe(401);
    expect((await GET(new Request("http://x") as never, { params: Promise.resolve({ id: "inconnue" }) })).status).toBe(404);
  });
});
