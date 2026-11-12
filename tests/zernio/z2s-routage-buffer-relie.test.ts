/** Z2-S · routage : avec la clé Buffer présente (posée avant l'inscription des fournisseurs), choisir Buffer est accepté. */
import { hash } from "@node-rs/argon2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const cleInitiale = process.env.BUFFER_API_KEY;
process.env.BUFFER_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0003";
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-z2s-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const { definirRoutage, lireRoutage } = await import("@/services/routage-publication");

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

afterAll(() => {
  if (cleInitiale === undefined) delete process.env.BUFFER_API_KEY;
  else process.env.BUFFER_API_KEY = cleInitiale;
});

describe("z2s · routage avec la clé Buffer", () => {
  it("Buffer relié : le choix de Buffer est accepté", async () => {
    await definirRoutage("instagram:exemple", "buffer");
    expect(await lireRoutage()).toEqual({ "instagram:exemple": "buffer" });
  });
});
