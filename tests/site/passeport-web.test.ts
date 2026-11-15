/** L8-13 — mise en service du passeport web (actions de la fiche vidéo) : retrait cohérent (410) et aucune publication sans case cochée. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "../site-videos/helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "../site-videos/helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const actions = await import("@/app/(studio)/videos/[id]/actions-site");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

const VIDEO = "v-01";
let factice = creerSiteFactice({ secret: "x" });
let publics = creerStockagePublicFactice();
let envois = 0;
let retraits = 0;

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});
beforeEach(async () => {
  await preparerBase();
  envois = 0;
  retraits = 0;
  factice = creerSiteFactice({ secret: "secret-passeport" });
  const traiter = factice.traiter.bind(factice);
  factice.traiter = async (r) => {
    if (r.methode === "DELETE") retraits++;
    else envois++;
    return traiter(r);
  };
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

const etat = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))?.site;

describe("L8-13 retrait depuis la fiche vidéo", () => {
  it("retirer appelle le fournisseur « site » : état « retirée », page en 410, fichiers publics effacés", async () => {
    const pub = await actions.publierSurLeSiteAction(VIDEO);
    expect(pub).toMatchObject({ ok: true, donnees: { etat: "en-ligne" } });
    expect(factice.statutPage(VIDEO)).toBe(200);
    retraits = 0;
    expect((await actions.retirerDuSiteAction(VIDEO)).ok).toBe(true);
    expect(retraits).toBe(1);
    expect((await etat())?.etat).toBe("retiree");
    expect(factice.statutPage(VIDEO)).toBe(410);
    expect(publics.objets.size).toBe(0);
  });
});

describe("L8-13 aucune publication sans case cochée", () => {
  it("case non cochée : refus, aucun envoi, aucun fichier public", async () => {
    await actions.cocherSurLeSiteAction(VIDEO, false); // la vidéo d'essai est préparée avec la case cochée
    const r = await actions.publierSurLeSiteAction(VIDEO);
    expect(r.ok).toBe(false);
    expect(envois).toBe(0);
    expect(publics.objets.size).toBe(0);
    expect(factice.statutPage(VIDEO)).toBe(404);
  });

  it("case décochée après coup : de nouveau refus", async () => {
    await actions.cocherSurLeSiteAction(VIDEO, false);
    await actions.cocherSurLeSiteAction(VIDEO, true);
    await actions.cocherSurLeSiteAction(VIDEO, false);
    const r = await actions.publierSurLeSiteAction(VIDEO);
    expect(r.ok).toBe(false);
    expect(envois).toBe(0);
  });
});
