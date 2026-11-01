/** Z2-S · synchronisation Zernio : états, lien, absence de 30 min = « À vérifier ». Faux fetch, aucune clé réelle. */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-z2s-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { injecterClientZernio, synchroniserEtatsZernio, statutDepuisZernio, testerZernio } = await import("@/services/zernio");
const { creerFauxClientZernio, postExemple } = await import("./aides/faux-zernio");

const T0 = Date.parse("2026-11-01T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const reponse = (corps: unknown, statut = 200) => ({ statut, corps }) as never;

async function publication(id: string, extra: Record<string, unknown> = {}) {
  await depots().publications.enregistrer({ id, videoId: "v-03", reseau: "instagram", statut: "brouillon", via: "zernio", date: iso(T0), texte: "Texte d'exemple", idExterne: `exemple-${id}`, canalId: "exemple-compte-1", etatEnvoi: "envoye", envoiCommenceLe: iso(T0 - 3600_000), creeLe: iso(T0), modifieLe: iso(T0), ...extra } as never);
}

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
});

describe("z2s · correspondance des statuts", () => {
  it.each([
    ["draft", "brouillon"], ["pending_approval", "brouillon"], ["scheduled", "programmee"], ["publishing", "programmee"],
    ["published", "publiee"], ["failed", "echec"], ["partial", "echec"], ["cancelled", "echec"],
  ])("%s → %s", (zernio, studio) => expect(statutDepuisZernio(zernio)).toBe(studio));
});

describe("z2s · synchronisation", () => {
  const cas: [string, Record<string, unknown>, string][] = [
    ["scheduled", { scheduledFor: "2026-11-02T10:00:00Z" }, "programmee"],
    ["published", { platforms: [{ platform: "instagram", accountId: "exemple-compte-1", status: "published", platformPostUrl: "https://exemple.invalid/p/1" }] }, "publiee"],
    ["failed", { platforms: [{ platform: "instagram", accountId: "exemple-compte-1", status: "failed", errorMessage: "Exemple d'échec" }] }, "echec"],
    ["partial", {}, "echec"],
    ["cancelled", {}, "echec"],
    ["draft", {}, "brouillon"],
  ];
  it.each(cas)("post %s → publication %s", async (status, extra, attendu) => {
    await publication("p1");
    const { client } = creerFauxClientZernio(() => reponse({ post: postExemple({ status, ...extra }) }));
    injecterClientZernio(client);
    const r = await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect(r.lues).toBe(1);
    const p = (await depots().publications.obtenir("p1"))!;
    expect(p.statut).toBe(attendu);
    expect(p.etatLuLe).toBe(iso(T0));
    if (status === "published") expect(p.urlPubliee).toBe("https://exemple.invalid/p/1");
  });

  it("au plus toutes les 15 minutes", async () => {
    await publication("p1");
    const { client, faux } = creerFauxClientZernio(() => reponse({ post: postExemple() }));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    const n = faux.appels.length;
    expect(await synchroniserEtatsZernio({ instant: T0 + 60_000 })).toEqual({ lues: 0, changees: 0 });
    expect(faux.appels.length).toBe(n);
  });

  it("introuvable depuis 30 min ou plus → « À vérifier » ; avant, rien ne change", async () => {
    await publication("tard", { envoiCommenceLe: iso(T0 - 31 * 60_000) });
    await publication("tot", { envoiCommenceLe: iso(T0 - 5 * 60_000) });
    const { client } = creerFauxClientZernio(() => reponse({ error: "Not found" }, 404));
    injecterClientZernio(client);
    await synchroniserEtatsZernio({ force: true, instant: T0 });
    expect((await depots().publications.obtenir("tard"))!.etatEnvoi).toBe("a-verifier");
    expect((await depots().publications.obtenir("tot"))!.etatEnvoi).toBe("envoye");
  });

  it("une publication Buffer n'est jamais lue chez Zernio", async () => {
    await publication("b1", { via: "buffer" });
    const { client, faux } = creerFauxClientZernio(() => reponse({ post: postExemple() }));
    injecterClientZernio(client);
    expect((await synchroniserEtatsZernio({ force: true, instant: T0 })).lues).toBe(0);
    expect(faux.appels.length).toBe(0);
  });

  it("tester les comptes : lecture, copie en base, sans clé dans le journal", async () => {
    const { client } = creerFauxClientZernio(() => reponse({ accounts: [{ _id: "exemple-compte-1", platform: "instagram", displayName: "Exemple" }] }));
    injecterClientZernio(client);
    const r = await testerZernio();
    expect(r.comptes).toBe(1);
    expect((await depots().evenements.lister()).map((e) => e.message).join("\n")).toContain("Zernio testé");
  });
});
