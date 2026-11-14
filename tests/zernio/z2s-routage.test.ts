/** Z2-S · routage : défaut Zernio, clé la plus précise, refus sans clé, aucun repli silencieux. */
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
  it("défaut {} = Zernio partout (clé posée) ; sans clé, refus clair", async () => {
    expect(await lireRoutage()).toEqual({});
    await expect(outilDeEnvoi("instagram")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    injecterClientZernio(creerFauxClientZernio().client);
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
  });
  it("Zernio sans clé : refus clair, jamais un repli vers Buffer", async () => {
    await expect(definirRoutage("instagram", "zernio")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    expect(await lireRoutage()).toEqual({});
  });
  it("la clé la plus précise gagne ; retour au défaut en un geste", async () => {
    injecterClientZernio(creerFauxClientZernio().client);
    await definirRoutage("instagram", "zernio");
    // Finitions : choisir Buffer sans sa clé est refusé comme pour Zernio ; le cas permis (clé présente) est dans z2s-routage-buffer-relie.test.ts.
    const cleInitiale = process.env.BUFFER_API_KEY;
    delete process.env.BUFFER_API_KEY;
    await expect(definirRoutage("instagram:exemple", "buffer")).rejects.toMatchObject({ code: "BUFFER_NON_RELIE" });
    expect(await lireRoutage()).toEqual({ instagram: "zernio" });
    if (cleInitiale === undefined) delete process.env.BUFFER_API_KEY;
    else process.env.BUFFER_API_KEY = cleInitiale;
    // Choix explicite déjà en base (clé retirée depuis) : écrit à la main pour la suite du scénario.
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("publication.routage", { instagram: "zernio", "instagram:exemple": "buffer" });
    expect(await outilDeEnvoi("instagram", "autre")).toBe("zernio");
    // Choix explicite de Buffer sans sa clé : refus clair, pas de repli vers Zernio.
    await expect(outilDeEnvoi("instagram", "exemple")).rejects.toMatchObject({ code: "BUFFER_NON_RELIE" });
    expect(await outilDeEnvoi("tiktok")).toBe("zernio");
    await definirRoutage("instagram", null);
    expect(await outilDeEnvoi("instagram", "autre")).toBe("zernio");
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
