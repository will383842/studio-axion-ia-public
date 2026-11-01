/** Z2-S · corbeille : les brouillons des DEUX outils sont comptés. */
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

const { mettreALaCorbeille } = await import("@/services/corbeille");
const T0 = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("fetch interdit")));
  await auth.seConnecter(MDP, false);
  for (const p of await depots().publications.lister()) await depots().publications.supprimer(p.id);
  await depots().videos.modifier("v-03", { statut: "brouillon" } as never);
});

const pub = (id: string, via: string, extra: Record<string, unknown> = {}) =>
  depots().publications.enregistrer({ id, videoId: "v-03", reseau: "instagram", statut: "brouillon", via, date: iso(T0), texte: "Exemple", idExterne: `exemple-${id}`, creeLe: iso(T0), modifieLe: iso(T0), ...extra } as never);

describe("z2s · corbeille", () => {
  it("compte les brouillons Buffer et Zernio, pas les manuels ni les programmés", async () => {
    await pub("a", "buffer");
    await pub("b", "zernio");
    await pub("c", "manuel");
    await pub("d", "zernio", { idExterne: undefined });
    const r = await mettreALaCorbeille(["v-03"]);
    expect(r.mises).toBe(1);
    expect(r.brouillonsBuffer).toBe(2);
  }, 60_000);
});
