/**
 * E2E-1 · routage par réseau Buffer → Zernio (simulation : aucune vraie clé, aucun appel réseau).
 * Défaut {} = Buffer partout ; basculer UN réseau ne change pas les autres ; retour à Buffer possible.
 */
import { hash } from "@node-rs/argon2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

// Clé Buffer FICTIVE posée avant l'inscription des fournisseurs : Buffer est « relié » (comme en production).
const cleInitiale = process.env.BUFFER_API_KEY;
process.env.BUFFER_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0101";
const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-e2e-routage";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});
afterAll(() => {
  if (cleInitiale === undefined) delete process.env.BUFFER_API_KEY;
  else process.env.BUFFER_API_KEY = cleInitiale;
});

const { definirRoutage, lireRoutage, outilDeEnvoi } = await import("@/services/routage-publication");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("./aides/faux-zernio");

const RESEAUX = ["instagram", "facebook", "linkedin", "tiktok"] as const;
const tous = async () => Object.fromEntries(await Promise.all(RESEAUX.map(async (r) => [r, await outilDeEnvoi(r)])));

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(creerFauxClientZernio().client);
  await auth.seConnecter(MDP, false);
});

describe("e2e-1 · routage par réseau", () => {
  it("défaut {} : Buffer partout, y compris pour un compte précis", async () => {
    expect(await lireRoutage()).toEqual({});
    expect(await tous()).toEqual({ instagram: "buffer", facebook: "buffer", linkedin: "buffer", tiktok: "buffer" });
    expect(await outilDeEnvoi("instagram", "exemple-compte")).toBe("buffer");
  });

  it("basculer UN réseau (Instagram) sur Zernio ne change pas les autres", async () => {
    await definirRoutage("instagram", "zernio");
    expect(await lireRoutage()).toEqual({ instagram: "zernio" });
    expect(await tous()).toEqual({ instagram: "zernio", facebook: "buffer", linkedin: "buffer", tiktok: "buffer" });
    // Aussi pour un compte précis d'Instagram (la clé « instagram » s'applique), jamais pour un autre réseau.
    expect(await outilDeEnvoi("instagram", "exemple-compte")).toBe("zernio");
    expect(await outilDeEnvoi("facebook", "exemple-compte")).toBe("buffer");
  });

  it("retour à Buffer : en retirant la clé, puis en choisissant « buffer » explicitement", async () => {
    await definirRoutage("instagram", "zernio");
    await definirRoutage("instagram", null);
    expect(await lireRoutage()).toEqual({});
    expect(await tous()).toEqual({ instagram: "buffer", facebook: "buffer", linkedin: "buffer", tiktok: "buffer" });

    await definirRoutage("instagram", "zernio");
    await definirRoutage("instagram", "buffer");
    expect(await lireRoutage()).toEqual({ instagram: "buffer" });
    expect(await outilDeEnvoi("instagram")).toBe("buffer");
  });

  it("bascule possible aller-retour plusieurs fois, sans effet sur les autres réseaux", async () => {
    for (let i = 0; i < 3; i++) {
      await definirRoutage("instagram", "zernio");
      expect(await outilDeEnvoi("instagram")).toBe("zernio");
      expect(await outilDeEnvoi("linkedin")).toBe("buffer");
      await definirRoutage("instagram", null);
      expect(await outilDeEnvoi("instagram")).toBe("buffer");
    }
  });

  it("la bascule d'un compte précis n'affecte ni les autres comptes ni les autres réseaux", async () => {
    await definirRoutage("instagram:exemple", "zernio");
    expect(await outilDeEnvoi("instagram", "exemple")).toBe("zernio");
    expect(await outilDeEnvoi("instagram", "autre")).toBe("buffer");
    expect(await outilDeEnvoi("instagram")).toBe("buffer");
    expect(await outilDeEnvoi("facebook", "exemple")).toBe("buffer");
  });

  it("une valeur illisible en base est ignorée : défaut Buffer, jamais Zernio par accident", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("publication.routage", { instagram: "inconnu", facebook: 3, linkedin: "zernio" });
    expect(await lireRoutage()).toEqual({ linkedin: "zernio" });
    expect(await outilDeEnvoi("instagram")).toBe("buffer");
    expect(await outilDeEnvoi("facebook")).toBe("buffer");
  });

  it("Zernio sans clé : refus clair à la bascule ET à l'envoi, jamais un repli silencieux vers Buffer", async () => {
    await definirRoutage("instagram", "zernio");
    injecterClientZernio(null);
    delete process.env.ZERNIO_API_KEY;
    await expect(outilDeEnvoi("instagram")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    // Les autres réseaux restent chez Buffer, sans erreur.
    expect(await outilDeEnvoi("facebook")).toBe("buffer");
    await expect(definirRoutage("facebook", "zernio")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    expect(await lireRoutage()).toEqual({ instagram: "zernio" });
  });

  it("réseau, compte ou outil inconnus refusés sans rien écrire", async () => {
    await expect(definirRoutage("inconnu", "zernio")).rejects.toMatchObject({ code: "RESEAU_INCONNU" });
    await expect(definirRoutage("instagram:a:b", "zernio")).rejects.toMatchObject({ code: "RESEAU_INCONNU" });
    await expect(definirRoutage("instagram", "autre" as never)).rejects.toMatchObject({ code: "OUTIL_INCONNU" });
    expect(await lireRoutage()).toEqual({});
  });
});
