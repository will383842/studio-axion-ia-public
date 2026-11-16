/** Z2-S · routage : même avec la clé Buffer présente, choisir Buffer est refusé (OUTIL_RETIRE) ; un « buffer » déjà en base est lu comme Zernio. */
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

const { definirRoutage, lireRoutage, outilDeEnvoi } = await import("@/services/routage-publication");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("./aides/faux-zernio");

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  delete process.env.ZERNIO_API_KEY;
  await auth.seConnecter(MDP, false);
});

afterAll(() => {
  if (cleInitiale === undefined) delete process.env.BUFFER_API_KEY;
  else process.env.BUFFER_API_KEY = cleInitiale;
});

describe("z2s · routage avec la clé Buffer", () => {
  it("Buffer relié : le choix de Buffer est refusé (OUTIL_RETIRE), rien n'est écrit", async () => {
    await expect(definirRoutage("instagram:exemple", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(await lireRoutage()).toEqual({});
  });
  it("un « buffer » déjà en base reste lu, mais l'envoi part par Zernio (clé Zernio exigée)", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("publication.routage", { "instagram:exemple": "buffer" });
    expect(await lireRoutage()).toEqual({ "instagram:exemple": "buffer" });
    await expect(outilDeEnvoi("instagram", "exemple")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    injecterClientZernio(creerFauxClientZernio().client);
    expect(await outilDeEnvoi("instagram", "exemple")).toBe("zernio");
    expect(await lireRoutage()).toEqual({ "instagram:exemple": "buffer" });
    injecterClientZernio(null);
  });
});
