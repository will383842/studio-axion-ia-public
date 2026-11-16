/**
 * LOT A1 puis L0-13a (accord L0-13 du fondateur) — routage : Buffer ne peut plus être CHOISI (`OUTIL_RETIRE`) ni porter un envoi,
 * qu'il soit gelé ou non ; un « buffer » déjà en base est lu comme absent (Zernio) et jamais réécrit.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import { fauxBuffer } from "../helpers/r1-buffer";
import { CLE_FICTIVE } from "../zernio/aides/faux-zernio";

process.env.BUFFER_API_KEY = "cle-buffer-de-test-gel-0002";
process.env.ZERNIO_API_KEY = CLE_FICTIVE;
process.env.FOURNISSEUR_PUBLICATION = "buffer";
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const { ecrireParametre } = await import("@/services/_commun");
const { definirRoutage, lireRoutage, outilDeEnvoi, PARAM_ROUTAGE } = await import("@/services/routage-publication");
const { envoyerParOutilAction } = await import("@/services/a-publier-zernio");

const MDP = "essai-a1-routage";
const VIDEO = "v-15";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
let buffer: ReturnType<typeof fauxBuffer>;

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.stubEnv("STUDIO_BUFFER_GEL_DEFAUT", "");
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  buffer = fauxBuffer();
  vi.stubGlobal("fetch", buffer.appeler);
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
});
afterEach(() => vi.unstubAllEnvs());

describe("A1 · routage, Buffer gelé", () => {
  it("choisir Buffer est refusé (`OUTIL_RETIRE`) et le routage reste inchangé", async () => {
    await expect(definirRoutage("instagram", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(await lireRoutage()).toEqual({});
  });

  it("choisir Zernio ou retirer une clé reste libre", async () => {
    expect(await definirRoutage("instagram", "zernio")).toEqual({ instagram: "zernio" });
    expect(await definirRoutage("instagram", null)).toEqual({});
  });

  it("un routage « buffer » déjà enregistré : lu comme Zernio, jamais réécrit, un autre réseau reste sur Zernio", async () => {
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "buffer" });
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
    expect(await lireRoutage()).toEqual({ instagram: "buffer" });
    expect(await outilDeEnvoi("linkedin")).toBe("zernio");
  });

  it("`envoyerVersBuffer` (alias de l'envoi commun) : 0 appel Buffer, aucune publication créée via Buffer", async () => {
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "buffer" });
    await pub.envoyerVersBuffer(VIDEO, ["instagram"], DEMAIN).catch(() => undefined);
    expect(buffer.appels.length).toBe(0);
    expect((await depots().publications.lister()).filter((p) => p.via === "buffer")).toEqual([]);
  });

  it("`envoyerParOutilAction(…, {outil:\"buffer\"})` : refus `OUTIL_REFUSE`, 0 appel", async () => {
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "buffer" });
    const r = await envoyerParOutilAction(VIDEO, "instagram", DEMAIN, { outil: "buffer" });
    expect(r).toMatchObject({ ok: false, code: "OUTIL_REFUSE" });
    expect(buffer.appels.length).toBe(0);
  });

  it("CONTRÔLE : même dégelé (`buffer.gele=false`), Buffer ne peut pas être choisi", async () => {
    await ecrireParametre("buffer.gele", false);
    await expect(definirRoutage("instagram", "buffer")).rejects.toMatchObject({ code: "OUTIL_RETIRE" });
    expect(await lireRoutage()).toEqual({});
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
  });
});
