/** S4.8 — interrupteur d'un générateur : l'éteindre retire ses vidéos du site, le rallumer les republie (plan § 6.5). */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const { lireParametre } = await import("@/services/_commun");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

let AVOCATS: string[] = [];
let TABLEAU = "";
beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
let publics = creerStockagePublicFactice();

beforeEach(async () => {
  await preparerBase();
  factice = creerSiteFactice({ secret: "secret-generateur" });
  publics = creerStockagePublicFactice();
  injecterSiteFactice(factice);
  site.injecterStockagesSite({ public: publics, prive: { lireDebut: async () => mp4Test(true) } });
  site.injecterAttenteSite(async () => undefined);
  // Trois vidéos prêtes de la démo sans licence en défaut : deux « avocat », une autre devenue « tableau animé ».
  const { obtenirVideo } = await import("@/services/videos");
  const libres: { id: string; formatId: string }[] = [];
  for (const v of await depots().videos.lister((x) => x.statut === "prete" && !!x.scriptId)) if (!(await obtenirVideo(v.id))!.licencesABloquer.length) libres.push({ id: v.id, formatId: v.formatId });
  AVOCATS = libres.filter((v) => v.formatId === "avocat").slice(0, 2).map((v) => v.id);
  TABLEAU = libres.find((v) => !AVOCATS.includes(v.id))!.id;
  expect(AVOCATS).toHaveLength(2);
  await depots().videos.modifier(TABLEAU, { formatId: "tableau-anime" });
  for (const id of [...AVOCATS, TABLEAU]) await preparerVideoPublicable(id);
  for (const id of [...AVOCATS, TABLEAU]) expect((await site.publierSurLeSite(id)).etat, id).toBe("en-ligne");
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
  site.injecterAttenteSite(null);
});

const etat = async (id: string) => (await depots().kits.trouver((k) => k.videoId === id))!.site!;

describe("S4.8 éteindre un générateur", () => {
  it("retire ses 2 vidéos en ligne (410, fichiers effacés), pas celle du tableau ; rien n'est effacé dans le studio", async () => {
    expect(factice.pages.size).toBe(3);
    const r = await site.definirSiteGenerateur("avocat", false);
    for (const id of AVOCATS) {
      expect(factice.statutPage(id), id).toBe(410);
      expect(await etat(id)).toMatchObject({ etat: "retiree", retireeParGenerateur: true, fichiersPublics: [] });
      expect(await depots().videos.obtenir(id)).toBeTruthy();
    }
    expect(factice.statutPage(TABLEAU)).toBe(200);
    expect((await etat(TABLEAU)).etat).toBe("en-ligne");
    expect([...publics.objets.keys()].every((c) => c.startsWith(`medias/videos/${TABLEAU}/`))).toBe(true);
    expect(publics.objets.size).toBe(3);
    expect(r).toMatchObject({ retirees: 2, echecs: [] });
    expect(await lireParametre("siteGenerateurs.avocat", true)).toBe(false);
  });

  it("une vidéo qui ne répond pas reste « échec » avec sa phrase, et la page « Sur le site » la liste", async () => {
    factice.panne = "injoignable";
    const r = await site.definirSiteGenerateur("avocat", false);
    expect(r.retirees).toBe(0);
    expect(r.echecs.map((e) => e.videoId).sort()).toEqual([...AVOCATS].sort());
    for (const id of AVOCATS) {
      const e = await etat(id);
      expect(e.etat).toBe("echec");
      expect(e.versionEnLigne).toBeDefined();
      expect(e.retireeParGenerateur).toBeUndefined();
    }
    const liste = await site.listerEnLigne();
    expect(liste.find((g) => g.formatId === "avocat")!.videos.map((v) => v.etat)).toEqual(["echec", "echec"]);
    // Le site revient : « Réessayer » (retirer) fonctionne.
    factice.panne = null;
    await site.retirerDuSite(AVOCATS[0]);
    expect(factice.statutPage(AVOCATS[0])).toBe(410);
  });

  it("éteint aussi l'envoi automatique, sans rien envoyer d'autre", async () => {
    await site.definirSiteAuto("avocat", true);
    await site.definirSiteGenerateur("avocat", false);
    expect(await lireParametre("siteAuto.avocat", true)).toBe(false);
  });

  it("un générateur sans vidéo en ligne : aucun appel au site", async () => {
    factice.appels.retirer = 0;
    const r = await site.definirSiteGenerateur("facecam", false);
    expect(r).toMatchObject({ retirees: 0, echecs: [], republiees: 0, refusees: [] });
    expect(factice.appels.retirer).toBe(0);
  });
});

describe("S4.8 rallumer un générateur", () => {
  beforeEach(async () => {
    await site.definirSiteGenerateur("avocat", false);
  });

  it("republie les vidéos qu'il a retirées (contrôles refaits), à la même adresse", async () => {
    const r = await site.definirSiteGenerateur("avocat", true);
    expect(r).toMatchObject({ republiees: 2, refusees: [] });
    for (const id of AVOCATS) {
      expect(factice.statutPage(id), id).toBe(200);
      const e = await etat(id);
      expect(e.etat).toBe("en-ligne");
      expect(e.retireeParGenerateur).toBeUndefined();
      expect(e.fichiersPublics).toHaveLength(3);
    }
    expect(factice.pages.size).toBe(3);
  });

  it("un refus des contrôles laisse la vidéo hors ligne, avec sa raison ; elle sera reprise au prochain rallumage", async () => {
    await site.modifierPasseport(AVOCATS[0], { titreWeb: "Devis pour Villeexemple" });
    const r = await site.definirSiteGenerateur("avocat", true);
    expect(r.republiees).toBe(1);
    expect(r.refusees.map((x) => x.videoId)).toEqual([AVOCATS[0]]);
    const e = await etat(AVOCATS[0]);
    expect(e.etat).toBe("retiree");
    expect(e.retireeParGenerateur).toBe(true);
    expect(e.derniereErreur).toBeTruthy();
    expect(factice.statutPage(AVOCATS[0])).toBe(410);
    // On corrige, on éteint puis on rallume : elle repart.
    await site.modifierPasseport(AVOCATS[0], { titreWeb: "Devis en dix minutes" });
    await site.definirSiteGenerateur("avocat", false);
    expect((await site.definirSiteGenerateur("avocat", true)).republiees).toBe(2);
  });

  it("une vidéo que Will a retirée lui-même n'est pas republiée", async () => {
    await site.definirSiteGenerateur("avocat", true);
    await site.retirerDuSite(AVOCATS[1]);
    await site.definirSiteGenerateur("avocat", false);
    await site.definirSiteGenerateur("avocat", true);
    expect((await etat(AVOCATS[1])).etat).toBe("retiree");
    expect(factice.statutPage(AVOCATS[1])).toBe(410);
  });
});
