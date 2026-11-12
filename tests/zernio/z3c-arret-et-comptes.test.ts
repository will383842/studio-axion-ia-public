/** Z3-C · l'arrêt d'urgence coupe vraiment le client de production ; un geste sur un compte ne touche que ce compte. */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-z3c-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const actions = await import("@/app/(studio)/reglages/actions-zernio");
const { clientZernio, injecterClientZernio, PARAM_ARRET_ZERNIO, PARAM_COMPTES_ZERNIO } = await import("@/services/zernio");
const { publicationZernio } = await import("@/fournisseurs/publication/inscription");
const { lireRoutage } = await import("@/services/routage-publication");
const { ecrireParametre } = await import("@/services/_commun");
const { CLE_FICTIVE } = await import("./aides/faux-zernio");

const BROUILLON = { content: "Bonjour", isDraft: true, platforms: [{ platform: "instagram", accountId: "exemple-compte-1" }] };
const CLE_IDEMPOTENCE = `studio-${"c".repeat(64)}`;

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  injecterClientZernio(null);
  process.env.ZERNIO_API_KEY = CLE_FICTIVE;
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ZERNIO_API_KEY;
});

describe("z3c · « Tout arrêter » coupe le client de production", () => {
  it("écriture refusée (envoi-coupe) après l'arrêt, acceptée après la reprise ; aucun appel réseau tant que c'est coupé", async () => {
    const fetchFaux = vi.fn(async () => new Response(JSON.stringify({ post: { _id: "exemple-post-1", status: "draft", platforms: [] } }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchFaux);
    const client = clientZernio();
    const ecrire = () => client.requete({ methode: "POST", chemin: "/v1/posts", corps: BROUILLON, idempotence: CLE_IDEMPOTENCE });

    expect((await actions.arreterToutAction()).ok).toBe(true);
    await expect(ecrire()).rejects.toMatchObject({ code: "envoi-coupe" });
    expect(fetchFaux).not.toHaveBeenCalled();

    expect((await actions.reprendreToutAction()).ok).toBe(true);
    await expect(ecrire()).resolves.toBeDefined();
    expect(fetchFaux).toHaveBeenCalledTimes(1);
  });

  it("le fournisseur inscrit existe et l'interrupteur est relu à chaque lecture (arrêt puis reprise)", async () => {
    const fetchFaux = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchFaux);
    await actions.arreterToutAction();
    const fournisseur = publicationZernio({ ZERNIO_API_KEY: CLE_FICTIVE }).zernio;
    expect(fournisseur).toBeDefined();
    const { lireParametre } = await import("@/services/_commun");
    expect(await lireParametre(PARAM_ARRET_ZERNIO, true)).toBe(false);
    await actions.reprendreToutAction();
    expect(await lireParametre(PARAM_ARRET_ZERNIO, false)).toBe(true);
  });
});

describe("z3c · un geste sur un compte ne touche que ce compte", () => {
  it("la page Facebook 2 change, la page 1 reste", async () => {
    await ecrireParametre(PARAM_COMPTES_ZERNIO, {
      lusLe: "2026-11-01T08:00:00Z",
      comptes: [
        { id: "exemple-page-1", reseau: "facebook", nom: "Page exemple 1" },
        { id: "exemple-page-2", reseau: "facebook", nom: "Page exemple 2" },
      ],
    });
    const avant = await actions.lireConnexionsZernioAction();
    if (!avant.ok) throw new Error("lecture");
    const [p1, p2] = avant.donnees.comptes;
    expect(p1.cle).not.toBe(p2.cle);
    expect(JSON.stringify(avant.donnees)).not.toContain("exemple-page");

    expect((await actions.changerRoutageZernioAction(p2.cle, "zernio")).ok).toBe(true);
    expect((await actions.changerModeZernioAction(p2.cle, "programmer")).ok).toBe(true);

    const apres = await actions.lireConnexionsZernioAction();
    if (!apres.ok) throw new Error("lecture");
    const a1 = apres.donnees.comptes.find((c) => c.cle === p1.cle)!;
    const a2 = apres.donnees.comptes.find((c) => c.cle === p2.cle)!;
    expect([a2.outil, a2.mode]).toEqual(["zernio", "programmer"]);
    expect([a1.outil, a1.mode]).toEqual(["buffer", "brouillon"]);
    expect(a1.basculeLe).toBeNull();
    expect(Object.keys(await lireRoutage())).toEqual([p2.cle]);
  });

  it("le code d'un compte ne change pas quand un autre compte s'ajoute", async () => {
    const un = { id: "exemple-page-2", reseau: "facebook", nom: "Page exemple 2" };
    await ecrireParametre(PARAM_COMPTES_ZERNIO, { lusLe: "x", comptes: [un] });
    const seul = await actions.lireConnexionsZernioAction();
    await ecrireParametre(PARAM_COMPTES_ZERNIO, { lusLe: "x", comptes: [{ id: "exemple-ig-0", reseau: "instagram", nom: "Compte exemple" }, un] });
    const deux = await actions.lireConnexionsZernioAction();
    if (!seul.ok || !deux.ok) throw new Error("lecture");
    expect(deux.donnees.comptes.find((c) => c.reseau === "facebook")!.code).toBe(seul.donnees.comptes[0].code);
  });

  it("réseau ou compte invalide : refus, rien n'est écrit", async () => {
    expect((await actions.changerRoutageZernioAction("myspace:abc", "zernio")).ok).toBe(false);
    expect((await actions.changerRoutageZernioAction("facebook:a:b", "zernio")).ok).toBe(false);
    expect((await actions.changerModeZernioAction("facebook:../x", "programmer")).ok).toBe(false);
    expect(await lireRoutage()).toEqual({});
  });
});
