/**
 * E2E-1 · routage par réseau Buffer → Zernio (simulation : aucune vraie clé, aucun appel réseau).
 * Défaut {} = Zernio partout ; garder UN réseau chez Buffer ne change pas les autres ; retour au défaut possible.
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
  it("défaut {} : Zernio partout, y compris pour un compte précis", async () => {
    expect(await lireRoutage()).toEqual({});
    expect(await tous()).toEqual({ instagram: "zernio", facebook: "zernio", linkedin: "zernio", tiktok: "zernio" });
    expect(await outilDeEnvoi("instagram", "exemple-compte")).toBe("zernio");
  });

  it("garder UN réseau (Instagram) chez Buffer ne change pas les autres", async () => {
    await definirRoutage("instagram", "buffer");
    expect(await lireRoutage()).toEqual({ instagram: "buffer" });
    expect(await tous()).toEqual({ instagram: "buffer", facebook: "zernio", linkedin: "zernio", tiktok: "zernio" });
    // Aussi pour un compte précis d'Instagram (la clé « instagram » s'applique), jamais pour un autre réseau.
    expect(await outilDeEnvoi("instagram", "exemple-compte")).toBe("buffer");
    expect(await outilDeEnvoi("facebook", "exemple-compte")).toBe("zernio");
  });

  it("retour au défaut : en retirant la clé, puis en choisissant « zernio » explicitement", async () => {
    await definirRoutage("instagram", "buffer");
    await definirRoutage("instagram", null);
    expect(await lireRoutage()).toEqual({});
    expect(await tous()).toEqual({ instagram: "zernio", facebook: "zernio", linkedin: "zernio", tiktok: "zernio" });

    await definirRoutage("instagram", "buffer");
    await definirRoutage("instagram", "zernio");
    expect(await lireRoutage()).toEqual({ instagram: "zernio" });
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
  });

  it("bascule possible aller-retour plusieurs fois, sans effet sur les autres réseaux", async () => {
    for (let i = 0; i < 3; i++) {
      await definirRoutage("instagram", "buffer");
      expect(await outilDeEnvoi("instagram")).toBe("buffer");
      expect(await outilDeEnvoi("linkedin")).toBe("zernio");
      await definirRoutage("instagram", null);
      expect(await outilDeEnvoi("instagram")).toBe("zernio");
    }
  });

  it("le choix d'un compte précis n'affecte ni les autres comptes ni les autres réseaux", async () => {
    await definirRoutage("instagram:exemple", "buffer");
    expect(await outilDeEnvoi("instagram", "exemple")).toBe("buffer");
    expect(await outilDeEnvoi("instagram", "autre")).toBe("zernio");
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
    expect(await outilDeEnvoi("facebook", "exemple")).toBe("zernio");
  });

  it("une valeur illisible en base est ignorée : défaut Zernio, jamais Buffer par accident", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("publication.routage", { instagram: "inconnu", facebook: 3, linkedin: "buffer" });
    expect(await lireRoutage()).toEqual({ linkedin: "buffer" });
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
    expect(await outilDeEnvoi("facebook")).toBe("zernio");
  });

  it("Zernio sans clé : refus clair à la bascule ET à l'envoi, jamais un repli silencieux vers Buffer", async () => {
    await definirRoutage("instagram", "zernio");
    await definirRoutage("facebook", "buffer");
    injecterClientZernio(null);
    delete process.env.ZERNIO_API_KEY;
    await expect(outilDeEnvoi("instagram")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    // Le réseau explicitement chez Buffer reste chez Buffer, sans erreur.
    expect(await outilDeEnvoi("facebook")).toBe("buffer");
    await expect(definirRoutage("linkedin", "zernio")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    expect(await lireRoutage()).toEqual({ instagram: "zernio", facebook: "buffer" });
  });

  it("réseau, compte ou outil inconnus refusés sans rien écrire", async () => {
    await expect(definirRoutage("inconnu", "zernio")).rejects.toMatchObject({ code: "RESEAU_INCONNU" });
    await expect(definirRoutage("instagram:a:b", "zernio")).rejects.toMatchObject({ code: "RESEAU_INCONNU" });
    await expect(definirRoutage("instagram", "autre" as never)).rejects.toMatchObject({ code: "OUTIL_INCONNU" });
    expect(await lireRoutage()).toEqual({});
  });
});
