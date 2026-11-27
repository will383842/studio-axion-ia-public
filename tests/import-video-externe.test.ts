/**
 * IMPORT-VIDEO-EXTERNE : importer une vidéo déjà faite dans « À publier ».
 * Dépôts en mémoire, aucun envoi, aucun fournisseur appelé.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
const { listerAPublier, videoEnEssai } = await import("@/services/publications");
const { vueAPublier } = await import("@/services/a-publier");
const { lancerRetouche, reexporter, lancerFabrication, estimerReexport } = await import("@/services/fabrication");
const { proposerModification, exemplesModification } = await import("@/services/modifications");
const { DUREE_MIN_IMPORT_SEC } = await import("@/domaine/import-video-externe");
const { importerVideoExterne, ratioDeLaTaille } = await import("@/services/import-video-externe");
const { commandeEnEssai } = await import("@/moteurs");
const auth = await import("@/services/auth");
const MDP_TEST = "essai-import-123";

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

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

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

  it("la vidéo importée apparaît dans listerAPublier (une carte par vidéo)", async () => {
    const { videoId } = await creerVideoImportee(BASE, fichier());
    const liste = await listerAPublier();
    expect(liste.map((c) => c.id)).toContain(videoId);
    expect(liste.find((c) => c.id === videoId)).toMatchObject({ titre: "Ma vidéo", etapeEditoriale: "validee" });
  });

  it("chaque réseau coché a sa ligne dans À publier", async () => {
    await auth.seConnecter(MDP_TEST, false);
    const coches = ["instagram", "linkedin", "tiktok"];
    const { videoId } = await creerVideoImportee({ ...BASE, reseaux: coches }, fichier());
    expect((await depots().videos.obtenir(videoId))?.reseau).toBeUndefined();
    const lignes = (await vueAPublier()).lignes.filter((l) => l.videoId === videoId);
    expect(lignes.map((l) => l.reseau).sort()).toEqual([...coches].sort());
    for (const l of lignes) expect([...(l.reseauxVideo ?? [])].sort()).toEqual([...coches].sort());
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

describe("la vidéo importée n'est pas un essai", () => {
  it("la ligne À publier d'une vidéo importée n'a aucun blocage (ni essai, ni exemple) et n'est pas d'origine usine", async () => {
    await auth.seConnecter(MDP_TEST, false);
    const { videoId } = await creerVideoImportee(BASE, fichier());
    const lignes = (await vueAPublier()).lignes.filter((l) => l.videoId === videoId);
    expect(lignes.length).toBeGreaterThan(0);
    for (const l of lignes) {
      expect(l.blocage).toBeUndefined();
      expect(l.blocageVideo).toBeUndefined();
      expect(l.origineUsine).toBeUndefined();
    }
  });

  it("la vidéo importée n'est pas un essai (commande et vidéo)", async () => {
    const { videoId } = await creerVideoImportee(BASE, fichier());
    const video = (await depots().videos.obtenir(videoId))!;
    const version = (await depots().versions.obtenir(video.versionChoisieId!))!;
    expect(commandeEnEssai(version.commande)).toBe(false);
    expect(await videoEnEssai(video)).toBe(false);
    // et une vidéo de simulation reste bien un essai (le garde-fou n'est pas levé pour tout le monde)
    expect(commandeEnEssai({ moteurId: "simulation", formatId: "video-importee" })).toBe(true);
    expect(commandeEnEssai({ moteurId: "inconnu", formatId: "video-importee" })).toBe(true);
  });

  it("l'origine « importée » suffit à écarter l'essai, même si la commande est illisible", async () => {
    const { videoId } = await creerVideoImportee(BASE, fichier());
    const video = (await depots().videos.obtenir(videoId))!;
    const version = (await depots().versions.obtenir(video.versionChoisieId!))!;
    await depots().versions.enregistrer({ ...version, commande: { ...version.commande, moteurId: "simulation" } });
    expect(await videoEnEssai({ versionChoisieId: video.versionChoisieId })).toBe(true);
    expect(await videoEnEssai({ versionChoisieId: video.versionChoisieId, origineVideo: "importee" })).toBe(false);
  });
});

describe("règles du domaine", () => {
  const ok = { nom: "a.mp4", mime: "video/mp4", taille: MO, dureeSec: 30, titre: "T", reseaux: ["instagram"], valide: true };
  it("refuse un fichier vide", () => {
    expect(controlerImportVideo({ ...ok, taille: 0 })).toMatchObject({ ok: false, code: "TAILLE" });
  });
  it("refuse un titre vide ou fait d'espaces", () => {
    expect(controlerImportVideo({ ...ok, titre: "" })).toMatchObject({ ok: false, code: "TITRE" });
    expect(controlerImportVideo({ ...ok, titre: "   " })).toMatchObject({ ok: false, code: "TITRE" });
  });
  it("un réseau inconnu est ignoré, et sans réseau connu rien n'est créé", async () => {
    expect(controlerImportVideo({ ...ok, reseaux: ["instagram", "myspace"] })).toMatchObject({ ok: true, reseaux: ["instagram"] });
    expect(controlerImportVideo({ ...ok, reseaux: [] })).toMatchObject({ ok: false, code: "RESEAUX" });
    expect(controlerImportVideo({ ...ok, reseaux: ["myspace"] })).toMatchObject({ ok: false, code: "RESEAUX" });
    const avant = await compte();
    await expect(creerVideoImportee({ ...BASE, reseaux: ["myspace"] }, fichier())).rejects.toMatchObject({ code: "RESEAUX" });
    expect(await compte()).toEqual(avant);
  });
  it("tolère un type MIME vide et video/x-m4v pour un mp4, pas pour un mov", () => {
    expect(controlerImportVideo({ ...ok, mime: "" }).ok).toBe(true);
    expect(controlerImportVideo({ ...ok, mime: "video/x-m4v" }).ok).toBe(true);
    expect(controlerImportVideo({ ...ok, nom: "a.mov", mime: "video/x-m4v" })).toMatchObject({ ok: false, code: "FORMAT" });
  });
  it("coupe le titre à 120 caractères et fusionne les réseaux en double", () => {
    const r = controlerImportVideo({ ...ok, titre: "x".repeat(200), reseaux: ["instagram", "instagram", "linkedin"] });
    expect(r).toMatchObject({ ok: true, reseaux: ["instagram", "linkedin"] });
    expect(r.ok && r.titre.length).toBe(120);
  });
});

describe("ratio déduit de la taille", () => {
  it("16:9, 1:1, 4:5, 9:16 ; taille absente, nulle ou négative → 9:16", () => {
    expect(ratioDeLaTaille(1920, 1080)).toBe("16:9");
    expect(ratioDeLaTaille(1080, 1080)).toBe("1:1");
    expect(ratioDeLaTaille(1080, 1350)).toBe("4:5");
    expect(ratioDeLaTaille(1080, 1920)).toBe("9:16");
    expect(ratioDeLaTaille()).toBe("9:16");
    expect(ratioDeLaTaille(0, 1080)).toBe("9:16");
    expect(ratioDeLaTaille(1920, 0)).toBe("9:16");
    expect(ratioDeLaTaille(-1920, -1080)).toBe("9:16");
  });
  it("la sortie crée porte le ratio et la résolution lus", async () => {
    const { videoId } = await creerVideoImportee({ ...BASE, largeur: 1920, hauteur: 1080 }, fichier());
    expect((await depots().videos.obtenir(videoId))?.ratios).toEqual(["16:9"]);
    expect((await depots().sorties.lister((x) => x.videoId === videoId))[0]).toMatchObject({ ratio: "16:9", resolution: "1920x1080" });
  });
});

describe("importerVideoExterne : session et fichier réellement arrivé", () => {
  async function deposer(p: Partial<Fichier> = {}) {
    await depots().fichiers.enregistrer(fichier(p));
  }
  it("l'import exige une session", async () => {
    await deposer();
    const avant = await compte();
    await expect(importerVideoExterne(BASE)).rejects.toThrow(/REDIRECT/);
    expect(await compte()).toEqual(avant);
  });
  it("sans case cochée, le fichier n'est même pas lu (NON_VALIDEE avant tout)", async () => {
    await auth.seConnecter(MDP_TEST, false);
    const avant = await compte();
    // fichier inexistant : si le fichier était lu d'abord, le code serait FICHIER_INCONNU
    await expect(importerVideoExterne({ ...BASE, fichierId: "f-absent", valide: false })).rejects.toMatchObject({ code: "NON_VALIDEE" });
    expect(await compte()).toEqual(avant);
  });
  it("refuse un fichier envoyé pour une autre vidéo, une autre destination ou pas encore arrivé", async () => {
    await auth.seConnecter(MDP_TEST, false);
    const avant = await compte();
    await deposer();
    await expect(importerVideoExterne({ ...BASE, entiteId: "autre" })).rejects.toMatchObject({ code: "FICHIER_INCONNU" });
    reinitialiserDepots();
    await deposer({ cleStockage: "studio/dev/image/imp-1/f-essai1.mp4" });
    await expect(importerVideoExterne(BASE)).rejects.toMatchObject({ code: "FICHIER_INCONNU" });
    reinitialiserDepots();
    await deposer({ origine: "demo" as Fichier["origine"] });
    await expect(importerVideoExterne(BASE)).rejects.toMatchObject({ code: "FICHIER_INCONNU" });
    reinitialiserDepots();
    await deposer({ statut: "en-cours" as Fichier["statut"] });
    await expect(importerVideoExterne(BASE)).rejects.toMatchObject({ code: "ENVOI_INCOMPLET" });
    await expect(importerVideoExterne({ ...BASE, fichierId: "pas-un-id" })).rejects.toMatchObject({ code: "FICHIER_INCONNU" });
    expect((await compte()).slice(0, 3)).toEqual(avant.slice(0, 3));
  });
  it("cas nominal : vidéo créée et ligne de journal écrite", async () => {
    await auth.seConnecter(MDP_TEST, false);
    await deposer();
    const avant = await compte();
    const journalAvant = await depots().evenements.compter((e) => e.type === "videos");
    const { videoId } = await importerVideoExterne(BASE);
    expect(await depots().videos.obtenir(videoId)).toMatchObject({ origineVideo: "importee" });
    expect(await compte()).toEqual([avant[0] + 1, avant[1] + 1, avant[2] + 1, avant[3]]);
    expect(await depots().evenements.compter((e) => e.type === "videos" && e.entiteId === videoId)).toBe(1);
    expect(await depots().evenements.compter((e) => e.type === "videos")).toBe(journalAvant + 1);
  });
});

describe("bornes exactes (incluses)", () => {
  it("3 s et 600 s sont acceptées, juste en dessous / au-dessus refusées", async () => {
    expect((await creerVideoImportee({ ...BASE, dureeSec: DUREE_MIN_IMPORT_SEC }, fichier())).videoId).toBeTruthy();
    expect((await creerVideoImportee({ ...BASE, dureeSec: DUREE_MAX_IMPORT_SEC }, fichier())).videoId).toBeTruthy();
    await expect(creerVideoImportee({ ...BASE, dureeSec: DUREE_MIN_IMPORT_SEC - 0.5 }, fichier())).rejects.toMatchObject({ code: "TROP_COURTE" });
    await expect(creerVideoImportee({ ...BASE, dureeSec: DUREE_MAX_IMPORT_SEC + 0.5 }, fichier())).rejects.toMatchObject({ code: "TROP_LONGUE" });
  });
  it("1 Go pile est accepté, 1 octet de plus refusé", async () => {
    expect((await creerVideoImportee(BASE, fichier({ taille: TAILLE_MAX_IMPORT_OCTETS }))).videoId).toBeTruthy();
    await expect(creerVideoImportee(BASE, fichier({ taille: TAILLE_MAX_IMPORT_OCTETS + 1 }))).rejects.toMatchObject({ code: "TROP_LOURD" });
  });
});

describe("une vidéo importée ne peut être ni retouchée ni refabriquée", () => {
  it("retouche, modification, nouveau format et fabrication refusés, sans version ni travail ni fournisseur", async () => {
    await auth.seConnecter(MDP_TEST, false);
    const { videoId } = await creerVideoImportee(BASE, fichier());
    const d = depots();
    const avant = [await d.versions.compter(() => true), await d.travaux.compter(() => true), await d.retouches.compter(() => true)];
    sondes.fournisseurs.length = 0;
    await expect(lancerRetouche(videoId, [], "Demande : coupe")).rejects.toMatchObject({ code: "RETOUCHE_INDISPONIBLE" });
    await expect(proposerModification(videoId, "coupe le début")).rejects.toMatchObject({ code: "RETOUCHE_INDISPONIBLE" });
    await expect(reexporter(videoId, "1:1")).rejects.toMatchObject({ code: "REEXPORT_INDISPONIBLE" });
    await expect(lancerFabrication(videoId)).rejects.toMatchObject({ code: "FABRICATION_INDISPONIBLE" });
    expect((await estimerReexport(videoId, "1:1")).centimes).toBe(0);
    expect(await exemplesModification(videoId)).toMatchObject({ exemples: [] });
    expect([await d.versions.compter(() => true), await d.travaux.compter(() => true), await d.retouches.compter(() => true)]).toEqual(avant);
    expect(sondes.fournisseurs).toEqual([]);
    expect((await d.videos.obtenir(videoId))?.statut).toBe("prete");
  });
});
