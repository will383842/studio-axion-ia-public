/** Encart vidéo, PR 4 : archiver une vidéo en ligne la retire aussi du site (comme la suppression et la corbeille). */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const videos = await import("@/services/videos");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

const VIDEO = "v-01";
beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
let publics = creerStockagePublicFactice();

beforeEach(async () => {
  await preparerBase();
  factice = creerSiteFactice({ secret: "secret-archivage" });
  publics = creerStockagePublicFactice();
  injecterSiteFactice(factice);
  site.injecterStockagesSite({ public: publics, prive: { lireDebut: async () => mp4Test(true) } });
  site.injecterAttenteSite(async () => undefined);
  await preparerVideoPublicable(VIDEO);
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
  site.injecterAttenteSite(null);
});

describe("encart PR 4 : archivage et site", () => {
  it("archiver une vidéo en ligne : la page est retirée (410), les fichiers publics partent, la vidéo est archivée et reste dans le Studio", async () => {
    await site.publierSurLeSite(VIDEO);
    expect(factice.statutPage(VIDEO)).toBe(200);
    await videos.archiverVideos([VIDEO]);
    expect(factice.appels.retirer).toBe(1);
    expect(factice.statutPage(VIDEO)).toBe(410);
    expect(publics.objets.size).toBe(0);
    expect((await depots().videos.obtenir(VIDEO))?.statut).toBe("archivee");
  });

  it("une vidéo jamais publiée : aucun appel au site", async () => {
    await videos.archiverVideos([VIDEO]);
    expect(factice.appels.retirer).toBe(0);
    expect((await depots().videos.obtenir(VIDEO))?.statut).toBe("archivee");
  });

  it("site injoignable : rien n'est archivé, erreur claire (la vidéo ne reste pas en ligne sans que personne le sache)", async () => {
    await site.publierSurLeSite(VIDEO);
    factice.panne = "injoignable";
    await expect(videos.archiverVideos([VIDEO])).rejects.toMatchObject({ code: "SITE_INJOIGNABLE" });
    expect((await depots().videos.obtenir(VIDEO))?.statut).not.toBe("archivee");
  });
});
