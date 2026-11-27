/**
 * IMPORT-VIDEO-EXTERNE : importer une vidéo déjà faite dans « À publier ».
 * Dépôts en mémoire, aucun envoi, aucun fournisseur appelé.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { Fichier } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/** Compte les fournisseurs demandés : l'import ne doit en demander AUCUN. */
const sondes = vi.hoisted(() => ({ fournisseurs: [] as string[] }));
vi.mock("@/services/_commun", async (original) => {
  const reel = await original<typeof import("@/services/_commun")>();
  return { ...reel, fournisseur: async (t: string) => (sondes.fournisseurs.push(t), (reel.fournisseur as (t: string) => Promise<unknown>)(t)) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerVideoImportee } = await import("@/services/import-video-externe");
const { controlerImportVideo, TAILLE_MAX_IMPORT_OCTETS, DUREE_MAX_IMPORT_SEC } = await import("@/domaine/import-video-externe");
const { listerAPublier } = await import("@/services/publications");

const MO = 1024 * 1024;
function fichier(p: Partial<Fichier> = {}): Fichier {
  return { id: "f-essai1", cleStockage: "studio/dev/video/imp-1/f-essai1.mp4", nom: "ma-video.mp4", mime: "video/mp4", taille: 20 * MO, origine: "depot", statut: "pret", creeLe: "2026-11-27T10:00:00.000Z", modifieLe: "2026-11-27T10:00:00.000Z", ...p };
}
const BASE = { fichierId: "f-essai1", entiteId: "imp-1", titre: "Ma vidéo", reseaux: ["instagram", "linkedin"], valide: true, dureeSec: 30, largeur: 1080, hauteur: 1920 };

/** Les dépôts en mémoire portent le jeu de démonstration : on compare avant / après. */
async function compte() {
  const d = depots();
  return [await d.videos.compter(() => true), await d.versions.compter(() => true), await d.sorties.compter(() => true), await d.publications.compter(() => true)];
}

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
  sondes.fournisseurs.length = 0;
});

describe("import d'une vidéo déjà faite", () => {
  it("refuse un format inconnu", async () => {
    const avant = await compte();
    for (const f of [fichier({ nom: "film.avi", mime: "video/x-msvideo" }), fichier({ nom: "doc.pdf", mime: "application/pdf" }), fichier({ nom: "faux.mp4", mime: "image/png" })]) {
      await expect(creerVideoImportee(BASE, f)).rejects.toMatchObject({ code: "FORMAT", message: expect.stringContaining("mp4, mov ou webm") });
    }
    expect(await compte()).toEqual(avant);
  });

  it("accepte mp4, mov et webm", () => {
    for (const [nom, mime] of [["a.mp4", "video/mp4"], ["a.MOV", "video/quicktime"], ["a.webm", "video/webm"]]) {
      expect(controlerImportVideo({ ...BASE, nom, mime, taille: MO }).ok).toBe(true);
    }
  });

  it("refuse un fichier trop lourd ou trop long (et trop court), avec un message simple", async () => {
    const avant = await compte();
    await expect(creerVideoImportee(BASE, fichier({ taille: TAILLE_MAX_IMPORT_OCTETS + 1 }))).rejects.toMatchObject({ code: "TROP_LOURD", message: expect.stringContaining("trop lourde") });
    await expect(creerVideoImportee({ ...BASE, dureeSec: DUREE_MAX_IMPORT_SEC + 1 }, fichier())).rejects.toMatchObject({ code: "TROP_LONGUE" });
    await expect(creerVideoImportee({ ...BASE, dureeSec: 1 }, fichier())).rejects.toMatchObject({ code: "TROP_COURTE" });
    await expect(creerVideoImportee({ ...BASE, dureeSec: 0 }, fichier())).rejects.toMatchObject({ code: "DUREE_INCONNUE" });
    expect(await compte()).toEqual(avant);
  });

  it("crée une vidéo prête et validée marquée importée, sans mention IA", async () => {
    const avant = await compte();
    const { videoId } = await creerVideoImportee(BASE, fichier());
    const v = await depots().videos.obtenir(videoId);
    expect(v).toMatchObject({ statut: "prete", etapeEditoriale: "validee", origineVideo: "importee", titre: "Ma vidéo", ratios: ["9:16"] });
    expect(v?.mentionIA.incrustee).toBe(false);
    expect(v?.briquesAllumees).toBeUndefined();
    const sorties = await depots().sorties.lister((s) => s.videoId === videoId);
    expect(sorties).toHaveLength(1);
    expect(sorties[0]).toMatchObject({ fichierId: "f-essai1", reseaux: ["instagram", "linkedin"], versionId: v?.versionChoisieId });
    expect(await compte()).toEqual([avant[0] + 1, avant[1] + 1, avant[2] + 1, avant[3]]);
  });

  it("la vidéo importée apparaît dans listerAPublier", async () => {
    const { videoId } = await creerVideoImportee(BASE, fichier());
    const liste = await listerAPublier();
    expect(liste.map((c) => c.id)).toContain(videoId);
    expect(liste.find((c) => c.id === videoId)).toMatchObject({ titre: "Ma vidéo", etapeEditoriale: "validee" });
  });

  it("sans case cochée rien n'est créé", async () => {
    const avant = await compte();
    await expect(creerVideoImportee({ ...BASE, valide: false }, fichier())).rejects.toMatchObject({ code: "NON_VALIDEE" });
    expect(await compte()).toEqual(avant);
  });

  it("aucun fournisseur payant n'est appelé", async () => {
    await creerVideoImportee(BASE, fichier());
    await listerAPublier();
    expect(sondes.fournisseurs.filter((t) => t !== "stockage")).toEqual([]);
  });
});
