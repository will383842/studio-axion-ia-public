/**
 * Panne du 15/10 (studio 13eb58c0, vidéo v-dd3049053f88) : la fabrication s'arrêtait aussitôt sur `IV_NON_RELIE` parce que
 * `brancherServicesImageVideo` n'était jamais exécuté dans le processus du serveur (la boucle n'importait pas le raccord).
 * Les autres tests branchent eux-mêmes des doubles : ils ne voyaient pas l'oubli.
 *
 * Ici, SEUL `src/services/boucle.ts` est importé, comme le fait le serveur : le moteur du format doit avoir ses outils.
 * Aucun appel réseau (`fetch` espionné), aucune dépense : on ne fait que lire le raccord posé au chargement.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

describe("Image → vidéo : la boucle charge le branchement du format", () => {
  it("après l'import de la boucle seule, la fabrique d'outils et le numéro de version sont branchés", async () => {
    const reseau = vi.spyOn(globalThis, "fetch");
    const moteur = await import("@/moteurs/montage-image-video");
    expect(moteur.servicesImageVideo().outils).toBeUndefined();
    await import("@/services/boucle");
    const s = moteur.servicesImageVideo();
    expect(typeof s.outils).toBe("function");
    expect(typeof s.numeroVersion).toBe("function");
    expect(reseau).not.toHaveBeenCalled();
    reseau.mockRestore();
  });
});
