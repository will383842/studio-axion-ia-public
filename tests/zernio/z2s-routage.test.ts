/** Z2-S · routage : défaut Buffer, clé la plus précise, refus sans clé, aucun repli silencieux. */
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

describe("z2s · routage", () => {
  it("défaut {} = Buffer partout", async () => {
    expect(await lireRoutage()).toEqual({});
    expect(await outilDeEnvoi("instagram")).toBe("buffer");
  });
  it("Zernio sans clé : refus clair, jamais un repli vers Buffer", async () => {
    await expect(definirRoutage("instagram", "zernio")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    expect(await lireRoutage()).toEqual({});
  });
  it("la clé la plus précise gagne ; retour à Buffer en un geste", async () => {
    injecterClientZernio(creerFauxClientZernio().client);
    await definirRoutage("instagram", "zernio");
    await definirRoutage("instagram:exemple", "buffer");
    expect(await outilDeEnvoi("instagram", "autre")).toBe("zernio");
    // Choix explicite de Buffer sans sa clé : refus clair, pas de repli vers Zernio.
    await expect(outilDeEnvoi("instagram", "exemple")).rejects.toMatchObject({ code: "BUFFER_NON_RELIE" });
    expect(await outilDeEnvoi("tiktok")).toBe("buffer");
    await definirRoutage("instagram", null);
    expect(await outilDeEnvoi("instagram", "autre")).toBe("buffer");
  });
  it("routé vers Zernio, la clé disparaît : refus à l'envoi", async () => {
    injecterClientZernio(creerFauxClientZernio().client);
    await definirRoutage("instagram", "zernio");
    injecterClientZernio(null);
    await expect(outilDeEnvoi("instagram")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
  });
  it("réseau, compte ou outil inconnus refusés", async () => {
    await expect(definirRoutage("inconnu", "buffer")).rejects.toMatchObject({ code: "RESEAU_INCONNU" });
    await expect(definirRoutage("instagram", "autre" as never)).rejects.toMatchObject({ code: "OUTIL_INCONNU" });
  });
});
