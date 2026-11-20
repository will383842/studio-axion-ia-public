/** RAP-3 finitions · la connexion réelle de la miniature refait la vérification d'adresse. Adresses fictives. */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ sessionApi: vi.fn(), exigerSession: vi.fn() }));
const { creerLookupSur, fetchMiniatureSur } = await import("@/services/miniature-diffuseur");

type Cb = (err: Error | null, a?: unknown, f?: number) => void;
const faux = (ips: string[]) => ((_h: string, _o: unknown, cb: Cb) => cb(null, ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })))) as never;
const appeler = (lookup: ReturnType<typeof creerLookupSur>, all: boolean) => new Promise<{ err: Error | null; a: unknown }>((ok) => lookup("medias.exemple.test", { all }, ((err: Error | null, a: unknown) => ok({ err, a })) as never));

describe("RAP-3 finitions · lookup de connexion", () => {
  it.each([["127.0.0.1"], ["10.0.0.1"], ["169.254.169.254"], ["::1"], ["64:ff9b::7f00:1"], ["2002:c0a8:101::1"]])("refuse %s (all et non all)", async (ip) => {
    expect((await appeler(creerLookupSur(faux([ip])), true)).err).toBeTruthy();
    expect((await appeler(creerLookupSur(faux([ip])), false)).err).toBeTruthy();
  });
  it("refuse un mélange public + privé", async () => {
    expect((await appeler(creerLookupSur(faux(["93.184.216.34", "192.168.1.5"])), true)).err).toBeTruthy();
  });
  it("laisse passer une adresse publique", async () => {
    const r = await appeler(creerLookupSur(faux(["93.184.216.34"])), true);
    expect(r.err).toBeNull();
    expect(r.a).toEqual([{ address: "93.184.216.34", family: 4 }]);
    const u = await appeler(creerLookupSur(faux(["93.184.216.34"])), false);
    expect(u.a).toBe("93.184.216.34");
  });
  it("une erreur de résolution reste une erreur", async () => {
    const l = creerLookupSur(((_h: string, _o: unknown, cb: Cb) => cb(new Error("dns"))) as never);
    expect((await appeler(l, true)).err).toBeTruthy();
  });
  it("la vraie connexion refuse un nom qui se résout en boucle locale", async () => {
    await expect(fetchMiniatureSur("https://localhost/a.jpg", { signal: AbortSignal.timeout(3000) })).rejects.toBeTruthy();
  });
});
