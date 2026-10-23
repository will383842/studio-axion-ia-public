/** S4.6 — retrait (plan § 6.3) : DELETE signé, puis les fichiers publics ; 404 = succès ; 3 nouveaux essais puis SITE_INJOIGNABLE. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const { ErreurStudio } = await import("@/services/_commun");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

const VIDEO = "v-01";
beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
let publics = creerStockagePublicFactice();
let journal: string[] = [];
let attentes: number[] = [];
let tentatives = 0;

beforeEach(async () => {
  await preparerBase();
  journal = [];
  attentes = [];
  tentatives = 0;
  factice = creerSiteFactice({ secret: "secret-retrait" });
  const traiter = factice.traiter.bind(factice);
  factice.traiter = async (r) => {
    if (r.methode === "DELETE") {
      tentatives++;
      journal.push("DELETE");
    }
    return traiter(r);
  };
  publics = creerStockagePublicFactice();
  const efface = publics.supprimer.bind(publics);
  publics.supprimer = async (c) => {
    journal.push(`efface:${c}`);
    return efface(c);
  };
  injecterSiteFactice(factice);
  site.injecterStockagesSite({ public: publics, prive: { lireDebut: async () => mp4Test(true) } });
  site.injecterAttenteSite(async (ms) => void attentes.push(ms));
  await preparerVideoPublicable(VIDEO);
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
  site.injecterAttenteSite(null);
});

const etat = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))!.site!;

describe("S4.6 retirerDuSite", () => {
  it("DELETE d'abord, puis tous les fichiers publics sont effacés ; état « retirée », liste vide", async () => {
    await site.publierSurLeSite(VIDEO);
    expect(publics.objets.size).toBe(3);
    journal.length = 0;
    const e = await site.retirerDuSite(VIDEO);
    expect(e.etat).toBe("retiree");
    expect(e.fichiersPublics).toEqual([]);
    expect(publics.objets.size).toBe(0);
    expect(journal[0]).toBe("DELETE");
    expect(journal.filter((x) => x.startsWith("efface:"))).toHaveLength(3);
    expect(factice.statutPage(VIDEO)).toBe(410);
  });

  it("le site ne connaît pas la vidéo (404) : c'est un succès, les fichiers partent quand même", async () => {
    await site.publierSurLeSite(VIDEO);
    factice.pages.clear();
    const e = await site.retirerDuSite(VIDEO);
    expect(e.etat).toBe("retiree");
    expect(publics.objets.size).toBe(0);
    expect(tentatives).toBe(1);
  });

  it("site injoignable : 3 nouveaux essais (1 s, 2 s, 4 s), puis SITE_INJOIGNABLE ; rien n'est effacé, l'état est « échec » et la version en ligne reste connue", async () => {
    const publiee = await site.publierSurLeSite(VIDEO);
    factice.panne = "injoignable";
    journal.length = 0;
    let code = "";
    try {
      await site.retirerDuSite(VIDEO);
    } catch (e) {
      code = (e as InstanceType<typeof ErreurStudio>).code;
    }
    expect(code).toBe("SITE_INJOIGNABLE");
    expect(attentes).toEqual([1000, 2000, 4000]);
    expect(publics.objets.size).toBe(3);
    expect(journal.some((x) => x.startsWith("efface:"))).toBe(false);
    const e = await etat();
    expect(e.etat).toBe("echec");
    expect(e.versionEnLigne).toBe(publiee.versionEnLigne);
    expect(e.fichiersPublics).toHaveLength(3);
    expect(e.derniereErreur).toBeTruthy();
  });

  it("le site revient pendant les essais : le retrait aboutit", async () => {
    await site.publierSurLeSite(VIDEO);
    const traiter = factice.traiter.bind(factice);
    let n = 0;
    factice.traiter = async (r) => {
      if (r.methode === "DELETE" && ++n <= 2) throw new Error("site injoignable");
      return traiter(r);
    };
    const e = await site.retirerDuSite(VIDEO);
    expect(e.etat).toBe("retiree");
    expect(attentes).toEqual([1000, 2000]);
    expect(publics.objets.size).toBe(0);
  });

  it("un refus du site qui ne se répare pas en réessayant (signature) n'est pas répété", async () => {
    await site.publierSurLeSite(VIDEO);
    const traiter = factice.traiter.bind(factice);
    factice.traiter = async (r) => {
      if (r.methode === "DELETE") return { statut: 401, corps: { erreur: "signature refusée" } };
      return traiter(r);
    };
    await expect(site.retirerDuSite(VIDEO)).rejects.toBeInstanceOf(ErreurStudio);
    expect(attentes).toEqual([]);
    expect((await etat()).etat).toBe("echec");
  });

  it("des fichiers qu'on n'arrive pas à effacer restent notés (effacés au prochain passage), sans faire échouer le retrait", async () => {
    await site.publierSurLeSite(VIDEO);
    const cles = [...publics.objets.keys()];
    const efface = publics.supprimer.bind(publics);
    publics.supprimer = async (c) => {
      if (c === cles[0]) throw new Error("stockage en panne");
      return efface(c);
    };
    const e = await site.retirerDuSite(VIDEO);
    expect(e.etat).toBe("retiree");
    expect(e.fichiersPublics).toEqual([cles[0]]);
  });

  it("jamais publiée : aucun appel au site, aucun effacement", async () => {
    const e = await site.retirerDuSite(VIDEO);
    expect(tentatives).toBe(0);
    expect(e.etat).toBe("hors-ligne");
    expect(journal).toEqual([]);
  });
});
