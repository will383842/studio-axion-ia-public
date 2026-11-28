/** PR 6 : chaque action de l'import exige une session AVANT de lire le corps du formulaire. */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => { throw new Error("SESSION_REQUISE"); } }));

const actions = await import("@/app/(studio)/calendrier/importer-epingles/actions");

describe("PR 6 · actions sans session", () => {
  it("refus avant toute lecture du formulaire", async () => {
    const f = { get: vi.fn(() => { throw new Error("corps lu"); }), getAll: vi.fn() } as unknown as FormData;
    for (const a of [actions.analyserLotAction, actions.importerLotAction, actions.validerLotAction]) await expect(a({}, f)).rejects.toThrow("SESSION_REQUISE");
    await expect(actions.preparerDepotImageAction("a.png", "image/png", 10, "x")).rejects.toThrow("SESSION_REQUISE");
    expect(f.get).not.toHaveBeenCalled();
  });
});
