/** S4.10 — lien de la page et chapitres dans la description YouTube, derrière `site.lienDansYoutube` (éteint). Aucun envoi Buffer. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const pub = await import("@/services/publications");
const { ecrireParametre } = await import("@/services/_commun");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");
const { descriptionAvecPage, horodatageChapitre, chapitresYoutube } = await import("@/domaine/site-videos/youtube");

const VIDEO = "v-01";
beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
let appelsFetch = 0;

beforeEach(async () => {
  await preparerBase();
  factice = creerSiteFactice({ secret: "secret-youtube" });
  injecterSiteFactice(factice);
  site.injecterStockagesSite({ public: creerStockagePublicFactice(), prive: { lireDebut: async () => mp4Test(true) } });
  appelsFetch = 0;
  vi.stubGlobal("fetch", async () => {
    appelsFetch++;
    throw new Error("réseau interdit");
  });
  await preparerVideoPublicable(VIDEO);
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
  vi.unstubAllGlobals();
});

const texteYoutube = async () => (await pub.obtenirKit(VIDEO))!.reseaux.find((r) => r.reseau === "youtube")!.texte;
const texteStocke = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))!.textes.youtube!.texte;

describe("S4.10 pur : horodatages et description", () => {
  it("m:ss, puis h:mm:ss au-delà d'une heure", () => {
    expect(horodatageChapitre(0)).toBe("0:00");
    expect(horodatageChapitre(6.4)).toBe("0:06");
    expect(horodatageChapitre(75)).toBe("1:15");
    expect(horodatageChapitre(3725)).toBe("1:02:05");
  });

  it("une ligne « 0:00 Accroche » par chapitre, le même découpage que le site", () => {
    const l = chapitresYoutube([
      { debutSec: 0, finSec: 6.4, libelle: "Accroche", blocRecette: "accroche" },
      { debutSec: 6.4, finSec: 30, libelle: "Cœur", blocRecette: "coeur" },
    ]);
    expect(l).toBe("0:00 Accroche\n0:06 Cœur");
  });

  it("la description reçoit le lien et les chapitres une seule fois (idempotent)", () => {
    const chapitres = [{ debutSec: 0, finSec: 10, libelle: "Accroche", blocRecette: "accroche" }];
    const une = descriptionAvecPage("Texte du kit.", { url: "https://x.invalid/fr/videos/a", chapitres });
    expect(une).toContain("Texte du kit.");
    expect(une).toContain("https://x.invalid/fr/videos/a");
    expect(une).toContain("0:00 Accroche");
    expect(descriptionAvecPage(une, { url: "https://x.invalid/fr/videos/a", chapitres })).toBe(une);
    expect(descriptionAvecPage("Texte.", { url: "https://x.invalid/fr/videos/a", chapitres: [] })).not.toMatch(/\d:\d\d/);
  });
});

describe("S4.10 dans le kit", () => {
  it("réglage éteint (défaut), même en ligne : le texte YouTube est inchangé", async () => {
    const avant = await texteYoutube();
    await site.publierSurLeSite(VIDEO);
    expect(await texteYoutube()).toBe(avant);
    expect(await texteStocke()).toBe(avant);
  });

  it("réglage allumé + vidéo en ligne : lien de la page et chapitres au bon format ; le texte enregistré ne change pas", async () => {
    const avant = await texteYoutube();
    const e = await site.publierSurLeSite(VIDEO);
    await ecrireParametre("site.lienDansYoutube", true);
    const t = await texteYoutube();
    expect(t.startsWith(avant)).toBe(true);
    expect(t).toContain(e.url!);
    const chapitres = (await depots().kits.trouver((k) => k.videoId === VIDEO))!.passeportWeb!.chapitres;
    if (chapitres.length) expect(t).toContain(`0:00 ${chapitres[0].libelle}`);
    expect(await texteStocke()).toBe(avant);
    // Un second affichage ne rajoute rien.
    expect(await texteYoutube()).toBe(t);
  });

  it("réglage allumé mais vidéo pas en ligne (jamais publiée, ou retirée) : inchangé", async () => {
    await ecrireParametre("site.lienDansYoutube", true);
    const avant = await texteStocke();
    expect(await texteYoutube()).toBe(avant);
    await site.publierSurLeSite(VIDEO);
    await site.retirerDuSite(VIDEO);
    expect(await texteYoutube()).toBe(avant);
  });

  it("les autres réseaux ne changent pas, et aucun envoi Buffer n'a lieu", async () => {
    const avant = (await pub.obtenirKit(VIDEO))!.reseaux.map((r) => [r.reseau, r.texte]);
    const publications = await depots().publications.compter();
    await site.publierSurLeSite(VIDEO);
    await ecrireParametre("site.lienDansYoutube", true);
    const apres = (await pub.obtenirKit(VIDEO))!.reseaux.map((r) => [r.reseau, r.texte]);
    for (const [reseau, texte] of avant) {
      if (reseau === "youtube" || reseau === "youtube-shorts") continue;
      expect(apres.find(([r]) => r === reseau)![1], String(reseau)).toBe(texte);
    }
    expect(await depots().publications.compter()).toBe(publications);
    expect(appelsFetch).toBe(0);
  });
});
