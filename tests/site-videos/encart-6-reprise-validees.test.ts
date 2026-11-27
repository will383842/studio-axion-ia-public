/** Encart vidéo, PR 6 : une vidéo qui devient « validée » part au site (interrupteur éteint par défaut), garde-fous respectés. */
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
  factice = creerSiteFactice({ secret: "secret-reprise" });
  publics = creerStockagePublicFactice();
  injecterSiteFactice(factice);
  site.injecterStockagesSite({ public: publics, prive: { lireDebut: async () => mp4Test(true) } });
  await preparerVideoPublicable(VIDEO);
  await site.definirSiteAuto("avocat", true);
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
});

const etat = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))?.site;
const etape = (e: "a_relire" | "validee" | "programmee" | "publiee") => depots().videos.modifier(VIDEO, { etapeEditoriale: e });

describe("encart PR 6 : reprise des vidéos validées", () => {
  it("interrupteur éteint (défaut) : valider n'envoie rien", async () => {
    expect(await site.repriseValideesAllumee()).toBe(false);
    await videos.changerEtapeEditoriale(VIDEO, "validee");
    expect(factice.appels.publier).toBe(0);
  });

  it("interrupteur allumé : valider envoie la vidéo (une seule fois)", async () => {
    await site.definirRepriseValidees(true);
    await videos.changerEtapeEditoriale(VIDEO, "validee");
    expect(factice.appels.publier).toBe(1);
    expect((await etat())?.etat).toBe("en-ligne");
    await videos.changerEtapeEditoriale(VIDEO, "validee");
    expect(factice.appels.publier).toBe(1);
  });

  it("une étape « à relire » n'envoie rien", async () => {
    await site.definirRepriseValidees(true);
    await videos.changerEtapeEditoriale(VIDEO, "a_relire");
    expect(factice.appels.publier).toBe(0);
  });

  it("une vidéo décochée par le fondateur n'est pas reprise", async () => {
    await site.definirRepriseValidees(true);
    await site.cocherSurLeSite(VIDEO, false);
    await videos.changerEtapeEditoriale(VIDEO, "validee");
    expect(factice.appels.publier).toBe(0);
    expect((await etat())?.etat).toBe("hors-ligne");
  });

  it("une vidéo retirée n'est pas reprise", async () => {
    await site.publierSurLeSite(VIDEO);
    await site.retirerDuSite(VIDEO);
    await site.definirRepriseValidees(true);
    await videos.changerEtapeEditoriale(VIDEO, "validee");
    expect(factice.appels.publier).toBe(1);
    expect((await etat())?.etat).toBe("retiree");
  });

  it("la reprise ne lève jamais : un site en panne laisse l'étape posée", async () => {
    await site.definirRepriseValidees(true);
    factice.panne = "injoignable";
    await expect(videos.changerEtapeEditoriale(VIDEO, "validee")).resolves.toBeUndefined();
    expect((await depots().videos.obtenir(VIDEO))?.etapeEditoriale).toBe("validee");
  });
});

describe("encart PR 6 : rattrapage manuel", () => {
  it("éteint : rien ; allumé : n'envoie que la vidéo prête et validée, publiée ou programmée", async () => {
    await etape("publiee");
    expect(await site.rattraperVideosValidees()).toEqual({ examinees: 0, envoyees: 0 });
    await site.definirRepriseValidees(true);
    const r = await site.rattraperVideosValidees();
    expect(r.envoyees).toBe(1);
    expect(factice.appels.publier).toBe(1);
    expect((await etat())?.etat).toBe("en-ligne");
  });

  it("une vidéo « à relire » n'est jamais reprise", async () => {
    await etape("a_relire");
    await site.definirRepriseValidees(true);
    expect((await site.rattraperVideosValidees()).envoyees).toBe(0);
    expect(factice.appels.publier).toBe(0);
  });
});
