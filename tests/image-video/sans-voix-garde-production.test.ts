/**
 * IV-SV : la garde de production de `outilsImageVideo` (src/services/image-video.ts) assouplie pour `sansVoix`.
 * Doubles seulement : rien n'est dépensé. Seule la voix HeyGen peut être simulée sans bloquer, et SEULEMENT sans voix.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
const etat = vi.hoisted(() => ({ voix: "simulation" as "simulation" | "reel", stockage: "reel" as "simulation" | "reel", rendu: false }));
vi.mock("@/fournisseurs", async (orig) => ({
  ...(await orig<typeof import("@/fournisseurs")>()),
  resoudreFournisseur: (type: string) => {
    if (type === "stockage") return { type, id: "r2-double", mode: etat.stockage, capacites: {}, urlLecture: async () => "https://stockage.test/l", urlLectureDuree: async () => "https://stockage.test/l", urlDepotDuree: async () => "https://stockage.test/d" };
    if (type === "voix") return { type, id: "heygen", mode: etat.voix, capacites: { audioSeul: true, horodatageMots: true }, lire: async () => { throw new Error("la voix ne doit pas être lue"); } };
    return { type, id: `${type}-double`, mode: "reel", capacites: {} };
  },
}));
vi.mock("@/fournisseurs/rendu/client", async (orig) => ({
  ...(await orig<typeof import("@/fournisseurs/rendu/client")>()),
  obtenirServiceRendu: () => ({ soumettre: async () => ({ idRendu: "r" }), etat: async () => ({ statut: "inconnu" }) }),
  renduSimule: () => etat.rendu,
}));
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const credits = await import("@/services/credits");
const { outilsImageVideo, STUDIO_NON_RELIE_IV } = await import("@/services/image-video");

type Dep = Parameters<typeof outilsImageVideo>[0];
const base: Dep = { videoId: "v1", travailId: "t1", production: true };
const refus = (dep: Dep) => outilsImageVideo(dep).then(() => null, (e: Error) => e.message);

beforeEach(() => {
  reinitialiserDepots();
  etat.voix = "simulation";
  etat.stockage = "reel";
  etat.rendu = false;
});
afterEach(() => vi.restoreAllMocks());

describe("outilsImageVideo, production : la voix simulée ne bloque que si la voix existe", () => {
  it("voix HeyGen simulée, sansVoix: true : n'est plus refusée", async () => {
    await expect(outilsImageVideo({ ...base, sansVoix: true })).resolves.toBeDefined();
  });

  it.each([
    ["absent", undefined],
    ["false", false],
  ])("voix HeyGen simulée, sansVoix %s : STUDIO_NON_RELIE_IV (avec voix, la garde bloque toujours)", async (_n, valeur) => {
    const reserver = vi.spyOn(credits, "verifierEtReserver");
    expect(await refus({ ...base, ...(valeur === undefined ? {} : { sansVoix: valeur }) })).toBe(STUDIO_NON_RELIE_IV);
    expect(reserver).not.toHaveBeenCalled();
  });

  it("le stockage simulé bloque TOUJOURS, même sansVoix: true, avec 0 réservation", async () => {
    etat.stockage = "simulation";
    const reserver = vi.spyOn(credits, "verifierEtReserver");
    const reserverOrigine = vi.spyOn(credits, "verifierEtReserverSelonOrigine");
    expect(await refus({ ...base, sansVoix: true })).toBe(STUDIO_NON_RELIE_IV);
    expect(reserver).not.toHaveBeenCalled();
    expect(reserverOrigine).not.toHaveBeenCalled();
  });

  it("le rendu simulé bloque TOUJOURS, même sansVoix: true, avec 0 réservation", async () => {
    etat.rendu = true;
    const reserver = vi.spyOn(credits, "verifierEtReserver");
    const reserverOrigine = vi.spyOn(credits, "verifierEtReserverSelonOrigine");
    expect(await refus({ ...base, sansVoix: true })).toBe(STUDIO_NON_RELIE_IV);
    expect(reserver).not.toHaveBeenCalled();
    expect(reserverOrigine).not.toHaveBeenCalled();
  });

  it("stockage et rendu simulés avec voix reliée, sansVoix: true : bloque encore", async () => {
    etat.voix = "reel";
    etat.stockage = "simulation";
    etat.rendu = true;
    expect(await refus({ ...base, sansVoix: true })).toBe(STUDIO_NON_RELIE_IV);
  });
});
