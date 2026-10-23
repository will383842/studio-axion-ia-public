/**
 * Correctifs de la vérification complète du 01/10 : rien n'est purgé (Bibliothèque, prononciations),
 * restauration d'une vidéo archivée, textes de publication selon format et durée, sous-titres.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const biblio = await import("@/services/bibliotheque");
const videos = await import("@/services/videos");
const { motsSousTitres } = await import("@/domaine/derivations");
const { phraseDuree, motsDiesePour, composerLegende } = await import("@/domaine/textes-publication");

const MDP_TEST = "essai-correctifs-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "y".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP_TEST, false);
});

describe("rien n'est purgé", () => {
  it("un élément rangé quitte la liste mais reste en base, et se remet", async () => {
    const [premier] = await biblio.listerElements({ type: "musique" });
    const avant = (await biblio.listerElements({ type: "musique" })).length;
    await biblio.rangerElement(premier.id);
    expect((await biblio.listerElements({ type: "musique" })).length).toBe(avant - 1);
    expect(await depots().elements.obtenir(premier.id)).not.toBeNull();
    expect((await biblio.listerElements({ type: "musique", ranges: true })).map((e) => e.id)).toContain(premier.id);
    await biblio.remettreElement(premier.id);
    expect((await biblio.listerElements({ type: "musique" })).length).toBe(avant);
  });

  it("une prononciation rangée n'est plus appliquée mais reste en base", async () => {
    const [p] = await biblio.listerPrononciations();
    await biblio.rangerPrononciation(p.id);
    expect((await biblio.listerPrononciations()).map((x) => x.id)).not.toContain(p.id);
    expect(await depots().prononciations.obtenir(p.id)).not.toBeNull();
    await biblio.remettrePrononciation(p.id);
    expect((await biblio.listerPrononciations()).map((x) => x.id)).toContain(p.id);
  });
});

describe("archivage d'une vidéo", () => {
  it("la restauration remet le statut d'avant (pas « Prête » d'office)", async () => {
    const v = (await depots().videos.lister((x) => x.statut === "echec"))[0] ?? (await depots().videos.lister((x) => x.statut === "brouillon"))[0];
    expect(v).toBeTruthy();
    await videos.archiverVideos([v.id]);
    expect((await depots().videos.obtenir(v.id))?.statut).toBe("archivee");
    await videos.desarchiverVideo(v.id);
    expect((await depots().videos.obtenir(v.id))?.statut).toBe(v.statut);
  });

  it("une vidéo en fabrication ne s'archive pas", async () => {
    const v = (await depots().videos.lister((x) => x.statut === "en_fabrication" || x.statut === "en_file"))[0];
    expect(v).toBeTruthy();
    await expect(videos.archiverVideos([v.id])).rejects.toMatchObject({ code: "EN_FABRICATION" });
  });
});

describe("textes de publication", () => {
  it("« moins d'une minute » seulement si c'est vrai", () => {
    expect(phraseDuree(45)).toContain("moins d'une minute");
    expect(phraseDuree(600)).toBe("Je vous explique tout en 10 min.");
    expect(phraseDuree(90)).toBe("Je vous explique tout en 1 min 30.");
  });

  it("mots-dièse selon le format", () => {
    expect(motsDiesePour("podcast", "linkedin", 3)).not.toContain("#DroitDuTravail");
    expect(motsDiesePour("ecran-partage", "linkedin", 3)).toContain("#Productivité");
  });

  it("la mention IA n'est jamais coupée par la limite du réseau", () => {
    const t = composerLegende("x".repeat(200), ["Réalisé avec l'IA."], 100);
    expect(t.length).toBeLessThanOrEqual(100);
    expect(t.endsWith("Réalisé avec l'IA.")).toBe(true);
  });
});

describe("sous-titres", () => {
  it("la ponctuation reste collée au mot précédent", () => {
    const mots = motsSousTitres("Créer un devis en 2 minutes ? On me le demande.");
    expect(mots.some((m) => m.startsWith("?"))).toBe(false);
    expect(mots).toContain("minutes ?");
  });
});
