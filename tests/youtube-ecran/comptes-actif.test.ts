/** « Tester » enregistre aussi si le compte est actif chez le fournisseur ; l'écran YouTube en déduit « déconnecté ». */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { injecterClientZernio, testerZernio, comptesZernioEnregistres } = await import("@/services/zernio");
const { etatChaineYoutube } = await import("@/domaine/chaine-youtube");
const MDP = "essai-yt-actif-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

const clientAvec = (comptes: unknown[]) => ({ listerComptes: async () => comptes }) as never;

describe("isActive enregistré", () => {
  it("compte déconnecté chez le fournisseur : actif=false enregistré, l'écran dit « deconnecte »", async () => {
    injecterClientZernio(clientAvec([{ _id: "exemple-yt", platform: "youtube", displayName: "Ma chaîne", isActive: false }]));
    await testerZernio();
    const lus = await comptesZernioEnregistres();
    expect(lus?.comptes[0]).toEqual({ id: "exemple-yt", reseau: "youtube", nom: "Ma chaîne", actif: false });
    expect(etatChaineYoutube(lus)).toEqual({ etat: "deconnecte", nom: "Ma chaîne" });
  });
  it("compte actif : actif=true, « relie »", async () => {
    injecterClientZernio(clientAvec([{ _id: "exemple-yt", platform: "youtube", displayName: "Ma chaîne", isActive: true }]));
    await testerZernio();
    const lus = await comptesZernioEnregistres();
    expect(lus?.comptes[0].actif).toBe(true);
    expect(etatChaineYoutube(lus)).toEqual({ etat: "relie", nom: "Ma chaîne" });
  });
  it("isActive absent chez le fournisseur : rien d'enregistré (inconnu), « relie »", async () => {
    injecterClientZernio(clientAvec([{ _id: "exemple-yt", platform: "youtube", displayName: "Ma chaîne" }]));
    await testerZernio();
    const lus = await comptesZernioEnregistres();
    expect(lus?.comptes[0]).not.toHaveProperty("actif");
    expect(etatChaineYoutube(lus).etat).toBe("relie");
  });
});
