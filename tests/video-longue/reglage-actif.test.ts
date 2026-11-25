/** UI-2 : réglage videoLongue.actif. Éteint par défaut, seul `true` allume, session exigée, aucun réseau. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { lireVideoLongueActif, ecrireVideoLongueActif } = await import("@/services/reglage-video-longue");
const { definirVideoLongueActiveAction } = await import("@/app/(studio)/reglages/actions-video-longue");
const { PARAM_VIDEO_LONGUE_ACTIF } = await import("@/services/video-longue-branchements");

const MDP = "essai-video-longue-actif";
const appelsReseau: string[] = [];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  appelsReseau.length = 0;
  vi.stubGlobal("fetch", (async (u: string | URL | Request) => {
    appelsReseau.push(String(u));
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.unstubAllGlobals();
  expect(appelsReseau).toEqual([]);
});

const lignes = async () => (await depots().evenements.lister()).filter((e) => e.type === "reglages");

describe("lecture", () => {
  it("éteint par défaut (clé absente)", async () => {
    expect(await lireVideoLongueActif()).toBe(false);
  });
  it('"true" et 1 sont lus éteints', async () => {
    await ecrireParametre(PARAM_VIDEO_LONGUE_ACTIF, "true");
    expect(await lireVideoLongueActif()).toBe(false);
    await ecrireParametre(PARAM_VIDEO_LONGUE_ACTIF, 1);
    expect(await lireVideoLongueActif()).toBe(false);
  });
});

describe("écriture", () => {
  it("bascule true puis false", async () => {
    await ecrireVideoLongueActif(true);
    expect(await lireVideoLongueActif()).toBe(true);
    await ecrireVideoLongueActif(false);
    expect(await lireVideoLongueActif()).toBe(false);
  });
  it("le service refuse une valeur non booléenne sans écrire", async () => {
    await expect(ecrireVideoLongueActif("true" as unknown as boolean)).rejects.toThrow();
    expect(await lireParametre(PARAM_VIDEO_LONGUE_ACTIF, "absent")).toBe("absent");
  });
});

describe("action", () => {
  it("allume et éteint, journalise sans montant", async () => {
    expect((await definirVideoLongueActiveAction(true)).ok).toBe(true);
    expect(await lireVideoLongueActif()).toBe(true);
    expect((await definirVideoLongueActiveAction(false)).ok).toBe(true);
    expect(await lireVideoLongueActif()).toBe(false);
    const textes = (await lignes()).map((e) => JSON.stringify(e));
    expect(textes.some((t) => t.includes("Vidéo longue allumée"))).toBe(true);
    expect(textes.some((t) => t.includes("Vidéo longue éteinte"))).toBe(true);
  });
  it.each([["true"], [1], [null], [undefined], [{}]])("refuse %j sans écriture", async (v) => {
    const r = await definirVideoLongueActiveAction(v);
    expect(r.ok).toBe(false);
    expect(await lireParametre(PARAM_VIDEO_LONGUE_ACTIF, "absent")).toBe("absent");
    expect(await lignes()).toHaveLength(0);
  });
  it("sans session : refusé, rien écrit", async () => {
    reinitialiserRequete();
    await expect(definirVideoLongueActiveAction(true)).rejects.toBeTruthy();
    expect(await lireParametre(PARAM_VIDEO_LONGUE_ACTIF, "absent")).toBe("absent");
  });
});
