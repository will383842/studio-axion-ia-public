/** S4.7 — supprimer définitivement une vidéo en ligne : retrait du site AVANT l'effacement, refus SUR_LE_SITE sous le verrou. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const videos = await import("@/services/videos");
const { refusSuppression } = await import("@/services/suppression-video");
const { ErreurStudio } = await import("@/services/_commun");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

const VIDEO = "v-01";
beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
let publics = creerStockagePublicFactice();
let journal: string[] = [];
let videoExistaitAuDelete: boolean[] = [];

beforeEach(async () => {
  await preparerBase();
  journal = [];
  videoExistaitAuDelete = [];
  factice = creerSiteFactice({ secret: "secret-suppression" });
  const traiter = factice.traiter.bind(factice);
  factice.traiter = async (r) => {
    if (r.methode === "DELETE") {
      journal.push("DELETE");
      videoExistaitAuDelete.push(!!(await depots().videos.obtenir(VIDEO)));
    }
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

const titre = async () => (await depots().videos.obtenir(VIDEO))!.titre;

describe("S4.7 suppression définitive d'une vidéo en ligne", () => {
  it("le DELETE part AVANT l'effacement, le site répond ensuite 410, les fichiers publics partent, les dépenses restent", async () => {
    await site.publierSurLeSite(VIDEO);
    expect(publics.objets.size).toBe(3);
    await depots().depenses.enregistrer({ id: "dep-s4", videoId: VIDEO, lignes: [], total: { centimes: 0, devise: "EUR" }, date: "2026-10-18T10:00:00.000Z", creeLe: "2026-10-18T10:00:00.000Z", modifieLe: "2026-10-18T10:00:00.000Z" });
    const r = await videos.supprimerVideoDefinitivement(VIDEO);
    expect(r).toBe(true);
    expect(videoExistaitAuDelete).toEqual([true]);
    expect(factice.statutPage(VIDEO)).toBe(410);
    expect(publics.objets.size).toBe(0);
    expect(await depots().videos.obtenir(VIDEO)).toBeFalsy();
    expect(await depots().kits.trouver((k) => k.videoId === VIDEO)).toBeFalsy();
    expect(await depots().depenses.obtenir("dep-s4")).toBeTruthy();
  });

  it("site injoignable : rien n'est effacé, erreur claire qui nomme la vidéo", async () => {
    await site.publierSurLeSite(VIDEO);
    factice.panne = "injoignable";
    let code = "";
    let message = "";
    try {
      await videos.supprimerVideoDefinitivement(VIDEO);
    } catch (e) {
      code = (e as InstanceType<typeof ErreurStudio>).code;
      message = (e as Error).message;
    }
    expect(code).toBe("SITE_INJOIGNABLE");
    expect(message).toContain(await titre());
    expect(message).toContain("est encore sur le site, qui ne répond pas");
    expect(await depots().videos.obtenir(VIDEO)).toBeTruthy();
    expect(await depots().kits.trouver((k) => k.videoId === VIDEO)).toBeTruthy();
    expect(publics.objets.size).toBe(3);
    expect(factice.statutPage(VIDEO)).toBe(200);
  });

  it("une publication lancée entre le retrait et le verrou : refus SUR_LE_SITE, la vidéo reste", async () => {
    await site.publierSurLeSite(VIDEO);
    // Course : juste après le retrait (premier accès à la vidéo sous le verrou), une autre publication remet la vidéo en ligne.
    const d = depots();
    const obtenir = d.videos.obtenir.bind(d.videos);
    let course = false;
    let retraitFini = false;
    const traiter = factice.traiter.bind(factice);
    factice.traiter = async (r) => {
      const rep = await traiter(r);
      if (r.methode === "DELETE") retraitFini = true;
      return rep;
    };
    d.videos.obtenir = async (id: string) => {
      if (retraitFini && !course) {
        course = true;
        const kit = (await d.kits.trouver((k) => k.videoId === VIDEO))!;
        await d.kits.modifier(kit.id, { site: { ...kit.site!, etat: "en-ligne", versionEnLigne: 9 } });
      }
      return obtenir(id);
    };
    let code = "";
    let message = "";
    try {
      await videos.supprimerVideoDefinitivement(VIDEO);
    } catch (e) {
      code = (e as InstanceType<typeof ErreurStudio>).code;
      message = (e as Error).message;
    }
    d.videos.obtenir = obtenir;
    expect(course).toBe(true);
    expect(code).toBe("SUR_LE_SITE");
    expect(message).toContain("vient d'être publiée sur le site : réessayez");
    expect(await d.videos.obtenir(VIDEO)).toBeTruthy();
  });

  it("une vidéo jamais publiée : aucun appel au site", async () => {
    await site.cocherSurLeSite(VIDEO, false);
    const r = await videos.supprimerVideoDefinitivement(VIDEO);
    expect(r).toBe(true);
    expect(factice.appels).toEqual({ reglages: 0, publier: 0, retirer: 0 });
    expect(journal).toEqual([]);
  });

  it("une vidéo retirée du site avant : aucun appel au site non plus, ses restes de fichiers publics sont effacés", async () => {
    await site.publierSurLeSite(VIDEO);
    await site.retirerDuSite(VIDEO);
    journal.length = 0;
    expect(await videos.supprimerVideoDefinitivement(VIDEO)).toBe(true);
    expect(journal).toEqual([]);
  });

  it("plusieurs vidéos : toutes sont retirées avant le moindre effacement", async () => {
    await site.publierSurLeSite(VIDEO);
    // Une autre vidéo prête, sans publication programmée.
    const programmees = new Set((await depots().publications.lister((p) => p.statut === "programmee")).map((p) => p.videoId));
    const autre = (await depots().videos.lister((v) => v.id !== VIDEO && v.statut === "prete" && !programmees.has(v.id)))[0];
    const r = await videos.supprimerVideosDefinitivement([VIDEO, autre.id]);
    expect(r.supprimees).toBe(2);
    expect(factice.appels.retirer).toBe(1);
  });
});

describe("S4.7 refusSuppression", () => {
  it.each(["en-ligne", "envoi-en-cours", "retrait-en-cours"] as const)("état « %s » → SUR_LE_SITE", async (etat) => {
    const kit = (await depots().kits.trouver((k) => k.videoId === VIDEO))!;
    await depots().kits.modifier(kit.id, { site: { ...kit.site!, etat } });
    const refus = await refusSuppression((await depots().videos.obtenir(VIDEO))!);
    expect(refus?.code).toBe("SUR_LE_SITE");
  });
  it.each(["hors-ligne", "retiree", "echec"] as const)("état « %s » → pas de refus", async (etat) => {
    const kit = (await depots().kits.trouver((k) => k.videoId === VIDEO))!;
    await depots().kits.modifier(kit.id, { site: { ...kit.site!, etat } });
    expect(await refusSuppression((await depots().videos.obtenir(VIDEO))!)).toBeNull();
  });
});
