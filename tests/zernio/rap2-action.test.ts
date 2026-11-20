/** RAP-2 · geste « Relire le diffuseur » : exige la session, relit dans le processus du serveur, n'écrit jamais chez le diffuseur. */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { ClientZernio, PostZernio } from "@/fournisseurs/publication/zernio-client";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { injecterClientZernio } = await import("@/services/zernio");
const MDP = "essai-rap2-act-1";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const post: PostZernio = { _id: "p-act-1", content: "t", status: "scheduled", scheduledFor: "2026-12-01T09:00:00.000Z", platforms: [{ platform: "instagram", accountId: "compte-fictif", status: "pending" }], metadata: { origine: "import-buffer", studioCle: "imp-act-1" } };
const ecritures: string[] = [];
const client = new Proxy(
  { listerComptes: async () => [], listerPosts: async (q?: Record<string, unknown>) => (q?.status === "scheduled" && Number(q?.page ?? 1) === 1 ? [post] : []), lirePost: async () => post },
  { get: (c, k) => (k in c ? (c as never)[k] : () => { ecritures.push(String(k)); throw new Error(`écriture interdite : ${String(k)}`); }) },
) as unknown as ClientZernio;

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
  ecritures.length = 0;
  (globalThis as Record<symbol, unknown>)[Symbol.for("studio-axion-ia.relire-diffuseur")] = undefined;
  injecterClientZernio(client);
});

describe("RAP-2 · relireDiffuseurAction", () => {
  it("sans session : refus (redirection), rien n'est lu ni créé", async () => {
    const { relireDiffuseurAction } = await import("@/app/(studio)/calendrier/actions/relire-diffuseur");
    await expect(relireDiffuseurAction()).rejects.toBeDefined();
    expect(await depots().publications.compter((p) => !!p.rapatrieeLe)).toBe(0);
  });

  it("avec session : un passage forcé et complet rapatrie, sans aucune écriture chez le diffuseur", async () => {
    await auth.seConnecter(MDP, false);
    const { relireDiffuseurAction } = await import("@/app/(studio)/calendrier/actions/relire-diffuseur");
    const r = await relireDiffuseurAction();
    expect(r.ok).toBe(true);
    expect(await depots().publications.compter((p) => !!p.rapatrieeLe)).toBe(1);
    expect(ecritures).toEqual([]);
  });

  it("anti-rebond : un second clic dans la minute est refusé sans relire le diffuseur ; il repasse après la minute", async () => {
    await auth.seConnecter(MDP, false);
    const { relireDiffuseurAction } = await import("@/app/(studio)/calendrier/actions/relire-diffuseur");
    let listes = 0;
    const compte = new Proxy(client, { get: (c, k) => (k === "listerPosts" ? async (q?: Record<string, unknown>) => { listes++; return (c as never as ClientZernio).listerPosts(q as never); } : (c as never)[k]) }) as ClientZernio;
    injecterClientZernio(compte);
    expect((await relireDiffuseurAction()).ok).toBe(true);
    const apresPremier = listes;
    expect(apresPremier).toBeGreaterThan(0);
    const second = await relireDiffuseurAction();
    expect(second.ok).toBe(false);
    expect(listes).toBe(apresPremier);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61_000);
    try {
      expect((await relireDiffuseurAction()).ok).toBe(true);
    } finally {
      vi.useRealTimers();
    }
    expect(listes).toBeGreaterThan(apresPremier);
  });
});
