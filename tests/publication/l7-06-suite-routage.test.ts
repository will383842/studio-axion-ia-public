/**
 * L7-06 suite, point 4.6 : `outilDeEnvoi` lit le routage UNE seule fois (avant : deux lectures sur le chemin « buffer »,
 * donc deux instantanés possibles d'un réglage qui peut changer entre les deux).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
const lectures = vi.hoisted(() => ({ routage: 0 }));
vi.mock("@/services/_commun", async (original) => {
  const m = await original<typeof import("@/services/_commun")>();
  return { ...m, lireParametre: (cle: string, defaut: unknown) => ((lectures.routage += cle === "publication.routage" ? 1 : 0), m.lireParametre(cle, defaut)) };
});

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { outilDeEnvoi, PARAM_ROUTAGE } = await import("@/services/routage-publication");

beforeAll(() => {
  delete process.env.BUFFER_API_KEY;
  process.env.ZERNIO_API_KEY = "cle-factice-essai";
});
beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
  lectures.routage = 0;
});

describe("L7-06 suite · 4.6 une seule lecture du routage", () => {
  it("chemin « buffer » (refus, sans clé Buffer) : une seule lecture", async () => {
    await ecrireParametre(PARAM_ROUTAGE, { instagram: "buffer" });
    lectures.routage = 0;
    await expect(outilDeEnvoi("instagram")).rejects.toMatchObject({ code: "BUFFER_NON_RELIE" });
    expect(lectures.routage).toBe(1);
  });
  it("chemin « zernio » : une seule lecture, comportement inchangé", async () => {
    lectures.routage = 0;
    expect(await outilDeEnvoi("instagram")).toBe("zernio");
    expect(lectures.routage).toBe(1);
  });
});
