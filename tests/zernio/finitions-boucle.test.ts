/** Finitions · restes Z2-S : la boucle de fond lance la synchronisation Zernio injectée (jamais un envoi). */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const boucle = await import("@/services/boucle");

describe("finitions · boucle et synchro Zernio", () => {
  it("contenuDuTour appelle synchroZernio (et synchroBuffer) une fois par tour", async () => {
    const zernio = vi.fn(async () => undefined);
    const buffer = vi.fn(async () => undefined);
    await boucle.contenuDuTour({ synchroZernio: zernio, synchroBuffer: buffer, delai: () => 5_000 });
    await vi.waitFor(() => expect(zernio).toHaveBeenCalledTimes(1));
    expect(buffer).toHaveBeenCalledTimes(1);
  });

  it("une synchro Zernio qui échoue ne casse pas le tour", async () => {
    const zernio = vi.fn(async () => {
      throw new Error("panne exemple");
    });
    await expect(boucle.contenuDuTour({ synchroZernio: zernio, synchroBuffer: async () => undefined, delai: () => 5_000 })).resolves.toBeUndefined();
    await vi.waitFor(() => expect(zernio).toHaveBeenCalled());
  });
});
