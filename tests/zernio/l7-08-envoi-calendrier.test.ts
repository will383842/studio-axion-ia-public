/** L7-08 · interrupteur SÉPARÉ de l'envoi du calendrier : fermé par défaut, le parcours GUIDE ne lit que l'ancien. */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-l708-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const Z = await import("@/services/zernio");
const { ecrireParametre } = await import("@/services/_commun");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");
const { promouvoirBrouillons } = await import("@/services/import-buffer/promotion");
const { creerFauxClientZernio } = await import("./aides/faux-zernio");

const ANCIEN = "zernio.envoi_autorise";
const NOUVEAU = "zernio.envoi_calendrier_autorise";

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  Z.injecterClientZernio(null);
  await auth.seConnecter(MDP, false);
});
afterEach(() => Z.injecterClientZernio(null));

const reglages = async (ancien: boolean | undefined, nouveau: boolean | undefined) => {
  if (ancien !== undefined) await ecrireParametre(ANCIEN, ancien);
  if (nouveau !== undefined) await ecrireParametre(NOUVEAU, nouveau);
};

describe("L7-08 · deux réglages, deux portes", () => {
  it("le nom du réglage est celui de la fiche", () => {
    expect(Z.PARAM_ENVOI_CALENDRIER).toBe(NOUVEAU);
    expect(Z.PARAM_ARRET_ZERNIO).toBe(ANCIEN);
  });

  it.each([
    ["nouveau absent, ancien absent", undefined, undefined, true, false, false],
    ["nouveau absent, ancien ouvert", true, undefined, true, false, false],
    ["nouveau ouvert + ancien fermé", false, true, false, true, false],
    ["les deux ouverts", true, true, true, true, true],
    ["nouveau fermé + ancien ouvert", true, false, true, false, false],
  ] as const)("%s", async (_n, ancien, nouveau, guide, calendrier, publication) => {
    await reglages(ancien, nouveau);
    expect(await Z.envoiZernioAutorise()).toBe(guide); // le GUIDE ne lit que l'ancien
    expect(await Z.envoiCalendrierAutorise()).toBe(calendrier);
    expect(await Z.envoiPublicationCalendrierAutorise()).toBe(publication);
  });

  it("ancien ouvert seul : le client partagé (GUIDE) écrit, le fournisseur de publication non", async () => {
    await reglages(true, undefined);
    const fetchFaux = vi.fn(async () => new Response(JSON.stringify({ post: { _id: "exemple-post-1", status: "draft", platforms: [] } }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchFaux);
    process.env.ZERNIO_API_KEY = "exemple-cle-fictive-ne-pas-utiliser-0001";
    const corps = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };
    const cle = `studio-${"c".repeat(64)}`;
    try {
      await expect(Z.clientZernio().requete({ methode: "POST", chemin: "/v1/posts", corps, idempotence: cle })).resolves.toBeDefined();
      expect(fetchFaux).toHaveBeenCalledTimes(1);
      const { creerClientZernio } = await import("@/fournisseurs/publication/zernio-client");
      const { envoiAutoriseCalendrierClient } = await import("@/fournisseurs/publication/inscription");
      const client = creerClientZernio({ cle: "exemple-cle-fictive-ne-pas-utiliser-0001", envoiAutorise: envoiAutoriseCalendrierClient });
      await expect(client.requete({ methode: "POST", chemin: "/v1/posts", corps, idempotence: cle })).rejects.toMatchObject({ code: "envoi-coupe" });
      expect(fetchFaux).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      delete process.env.ZERNIO_API_KEY;
    }
  });

  it("envoi du calendrier (écran À publier) : refusé par le nouveau réglage quand l'ancien est ouvert et le nouveau absent ou fermé", async () => {
    for (const nouveau of [undefined, false] as const) {
      await reglages(true, nouveau);
      const { client, faux } = creerFauxClientZernio([]);
      Z.injecterClientZernio(client);
      const r = await envoyerParOutilAction("video-exemple", "instagram", "2030-01-01T10:00:00Z", { outil: "zernio" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("ENVOI_CALENDRIER_FERME");
      expect(faux.appels).toHaveLength(0);
    }
  });

  it("« Tout arrêter » (ancien fermé) : rien ne part, et le refus n'est PAS celui du nouveau réglage (comportement d'avant conservé)", async () => {
    for (const nouveau of [undefined, true] as const) {
      await reglages(false, nouveau);
      const { client, faux } = creerFauxClientZernio([]);
      Z.injecterClientZernio(client);
      const r = await envoyerParOutilAction("video-exemple", "instagram", "2030-01-01T10:00:00Z", { outil: "zernio" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).not.toBe("ENVOI_CALENDRIER_FERME");
      expect(faux.appels.filter((a) => a.methode !== "GET")).toHaveLength(0);
    }
  });

  it("envoi du calendrier, les deux ouverts : la porte s'ouvre (le refus suivant n'est plus celui du réglage)", async () => {
    await reglages(true, true);
    const r = await envoyerParOutilAction("video-exemple", "instagram", "2030-01-01T10:00:00Z", { outil: "zernio" });
    // La vidéo « video-exemple » n'existe pas dans ce test : l'issue attendue est un refus d'un autre ordre, jamais celui du réglage.
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).not.toBe("ENVOI_CALENDRIER_FERME");
      expect(r.code).toBe("PAS_PRETE");
    }
  });

  it("promotion brouillon → programmé : refusée sans un seul appel tant que les deux ne sont pas ouverts", async () => {
    const { client, faux } = creerFauxClientZernio([]);
    await reglages(true, undefined);
    const r = await promouvoirBrouillons({ client, postsBuffer: [], aBlanc: false, maintenant: () => Date.parse("2026-11-11T10:00:00Z") });
    expect(r.refusLot).toMatch(/calendrier/);
    expect(faux.appels).toHaveLength(0);
  });
});
