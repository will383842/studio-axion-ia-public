/**
 * E2E-1 · routage par réseau, Zernio seul outil d'envoi (L0-13a) (simulation : aucune vraie clé, aucun appel réseau).
 * Défaut {} = Zernio partout ; Buffer refusé (OUTIL_RETIRE) ; retour au défaut possible.
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

  it("choisir Buffer pour un réseau est refusé (OUTIL_RETIRE) : rien n'est écrit, les autres réseaux restent chez Zernio", async () => {
    await expect(definirRoutage("instagram", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(await lireRoutage()).toEqual({});
    expect(await tous()).toEqual({ instagram: "zernio", facebook: "zernio", linkedin: "zernio", tiktok: "zernio" });
    expect(await outilDeEnvoi("instagram", "exemple-compte")).toBe("zernio");
  });

  it("retour au défaut : en retirant la clé, puis en choisissant « zernio » explicitement ; « buffer » refusé à chaque fois", async () => {
    await definirRoutage("instagram", "zernio");
    await definirRoutage("instagram", null);
    expect(await lireRoutage()).toEqual({});
    expect(await tous()).toEqual({ instagram: "zernio", facebook: "zernio", linkedin: "zernio", tiktok: "zernio" });

    await expect(definirRoutage("instagram", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    await definirRoutage("instagram", "zernio");
    expect(await lireRoutage()).toEqual({ instagram: "zernio" });
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
  });

  it("bascule aller-retour : Zernio puis défaut, Buffer refusé à chaque tour, sans effet sur les autres réseaux", async () => {
    for (let i = 0; i < 3; i++) {
      await definirRoutage("instagram", "zernio");
      await expect(definirRoutage("instagram", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
      expect(await outilDeEnvoi("instagram")).toBe("zernio");
      expect(await outilDeEnvoi("linkedin")).toBe("zernio");
      await definirRoutage("instagram", null);
      expect(await outilDeEnvoi("instagram")).toBe("zernio");
    }
  });

  it("le choix d'un compte précis chez Buffer est refusé ; chez Zernio il n'affecte ni les autres comptes ni les autres réseaux", async () => {
    await expect(definirRoutage("instagram:exemple", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(await lireRoutage()).toEqual({});
    await definirRoutage("instagram:exemple", "zernio");
    expect(await lireRoutage()).toEqual({ "instagram:exemple": "zernio" });
    expect(await outilDeEnvoi("instagram", "exemple")).toBe("zernio");
    expect(await outilDeEnvoi("instagram", "autre")).toBe("zernio");
    expect(await outilDeEnvoi("facebook", "exemple")).toBe("zernio");
  });

  it("une valeur illisible en base est ignorée : défaut Zernio, jamais Buffer par accident", async () => {
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("publication.routage", { instagram: "inconnu", facebook: 3, linkedin: "buffer" });
    expect(await lireRoutage()).toEqual({ linkedin: "buffer" });
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
    expect(await outilDeEnvoi("facebook")).toBe("zernio");
  });

  it("Zernio sans clé : refus clair à la bascule ET à l'envoi ; un « buffer » déjà en base part par Zernio, clé exigée (aucun repli vers Buffer)", async () => {
    await definirRoutage("instagram", "zernio");
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("publication.routage", { instagram: "zernio", facebook: "buffer" });
    injecterClientZernio(null);
    delete process.env.ZERNIO_API_KEY;
    await expect(outilDeEnvoi("instagram")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    await expect(outilDeEnvoi("facebook")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    await expect(definirRoutage("linkedin", "zernio")).rejects.toMatchObject({ code: "ZERNIO_NON_RELIE" });
    // L'ancienne valeur reste en base, jamais réécrite.
    expect(await lireRoutage()).toEqual({ instagram: "zernio", facebook: "buffer" });
    injecterClientZernio(creerFauxClientZernio().client);
    expect(await outilDeEnvoi("facebook")).toBe("zernio");
  });

  it("réseau, compte ou outil inconnus refusés sans rien écrire", async () => {
    await expect(definirRoutage("inconnu", "zernio")).rejects.toMatchObject({ code: "RESEAU_INCONNU" });
    await expect(definirRoutage("instagram:a:b", "zernio")).rejects.toMatchObject({ code: "RESEAU_INCONNU" });
    await expect(definirRoutage("instagram", "autre" as never)).rejects.toMatchObject({ code: "OUTIL_INCONNU" });
    expect(await lireRoutage()).toEqual({});
  });
});
