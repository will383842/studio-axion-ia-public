/** S4.9 — envoi automatique après les finitions d'une nouvelle vidéo (plan § 6.5) : jamais sans passeport complet. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const pub = await import("@/services/publications");
const travaux = await import("@/services/travaux");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

const VIDEO = "v-01";
beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
let publics = creerStockagePublicFactice();

beforeEach(async () => {
  await preparerBase();
  factice = creerSiteFactice({ secret: "secret-auto" });
  publics = creerStockagePublicFactice();
  injecterSiteFactice(factice);
  site.injecterStockagesSite({ public: publics, prive: { lireDebut: async () => mp4Test(true) } });
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit");
  });
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
  vi.unstubAllGlobals();
});

const notifs = async () => (await depots().notifications.lister((n) => n.titre.includes("À relire avant le site"))).length;
const etat = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))?.site;

/** Générateur autorisé, envoi automatique allumé, vidéo sans passeport rempli (passeport d'essai). */
async function allumerAutoSansPasseport() {
  await site.definirSiteGenerateur("avocat", true);
  await site.definirSiteAuto("avocat", true);
  await pub.obtenirKit(VIDEO);
}

describe("S4.9 publicationAuto", () => {
  it("envoi automatique éteint : rien ne se passe", async () => {
    await site.definirSiteGenerateur("avocat", true);
    await pub.obtenirKit(VIDEO);
    const r = await site.publicationAuto(VIDEO);
    expect(r).toBe("rien");
    expect(await etat()).toBeUndefined();
    expect(factice.appels.publier).toBe(0);
    expect(await notifs()).toBe(0);
  });

  it("générateur éteint : rien ne se passe, même avec l'ancien réglage d'envoi automatique", async () => {
    await pub.obtenirKit(VIDEO);
    await depots().parametres.enregistrer({ id: "siteAuto.avocat", valeur: true, creeLe: "2026-01-01T00:00:00.000Z", modifieLe: "2026-01-01T00:00:00.000Z" });
    expect(await site.publicationAuto(VIDEO)).toBe("rien");
    expect(factice.appels.publier).toBe(0);
  });

  it("allumé + passeport d'essai (page pauvre) : une notification « À relire avant le site », la case cochée, AUCUN envoi", async () => {
    await allumerAutoSansPasseport();
    const r = await site.publicationAuto(VIDEO);
    expect(r).toBe("a-relire");
    expect(await notifs()).toBe(1);
    expect((await etat())?.choisie).toBe(true);
    expect((await etat())?.etat).toBe("hors-ligne");
    expect(factice.appels.publier).toBe(0);
    expect(factice.appels.retirer).toBe(0);
    expect(publics.objets.size).toBe(0);
    const n = (await depots().notifications.lister((x) => x.titre.includes("À relire avant le site")))[0];
    expect(n.lien).toBe(`/videos/${VIDEO}`);
  });

  it("deux passages de suite ne font pas deux notifications", async () => {
    await allumerAutoSansPasseport();
    await site.publicationAuto(VIDEO);
    await site.publicationAuto(VIDEO);
    expect(await notifs()).toBe(1);
  });

  it("allumé + passeport complet : un seul envoi, la vidéo est en ligne", async () => {
    await preparerVideoPublicable(VIDEO);
    await site.definirSiteAuto("avocat", true);
    await site.cocherSurLeSite(VIDEO, false);
    const r = await site.publicationAuto(VIDEO);
    expect(r).toBe("publiee");
    expect(factice.appels.publier).toBe(1);
    expect((await etat())?.etat).toBe("en-ligne");
    expect(await notifs()).toBe(0);
  });

  it("elle tourne sans session (boucle de fond) : la finition n'a pas de cookie", async () => {
    await preparerVideoPublicable(VIDEO);
    await site.definirSiteAuto("avocat", true);
    await site.cocherSurLeSite(VIDEO, false);
    reinitialiserRequete();
    expect(await site.publicationAuto(VIDEO)).toBe("publiee");
    expect((await etat())?.etat).toBe("en-ligne");
  });

  it("une vidéo déjà en ligne n'est pas renvoyée", async () => {
    await preparerVideoPublicable(VIDEO);
    await site.definirSiteAuto("avocat", true);
    await site.publierSurLeSite(VIDEO);
    const avant = factice.appels.publier;
    expect(await site.publicationAuto(VIDEO)).toBe("rien");
    expect(factice.appels.publier).toBe(avant);
  });

  it("le site en panne ne casse rien : l'état passe à « échec », aucune exception", async () => {
    await preparerVideoPublicable(VIDEO);
    await site.definirSiteAuto("avocat", true);
    await site.cocherSurLeSite(VIDEO, false);
    factice.panne = "injoignable";
    await expect(site.publicationAuto(VIDEO)).resolves.toBe("publiee");
    expect((await etat())?.etat).toBe("echec");
  });
});

describe("S4.9 branchement dans les finitions", () => {
  const finition = async (textes: boolean) => {
    const v = (await depots().videos.obtenir(VIDEO))!;
    await travaux.executerSuites([{ type: "finition", videoId: v.id, titre: v.titre, ratio: v.ratios[0], textes }]);
  };

  it("après la première fabrication (textes), la finition appelle l'envoi automatique", async () => {
    await allumerAutoSansPasseport();
    await finition(true);
    expect(await notifs()).toBe(1);
  });

  it("après une retouche (sans textes), rien : l'envoi automatique ne concerne que les nouvelles vidéos", async () => {
    await allumerAutoSansPasseport();
    await finition(false);
    expect(await notifs()).toBe(0);
    expect(await etat()).toBeUndefined();
  });

  it("tout éteint : la finition ne touche pas au site", async () => {
    await pub.obtenirKit(VIDEO);
    await finition(true);
    expect(await etat()).toBeUndefined();
    expect(factice.appels).toEqual({ reglages: 0, publier: 0, retirer: 0 });
  });
});
