/** Test de bout en bout contre le SITE FACTICE (plan § 9.1) : publier, rejouer sans doublon, mettre à jour, éteindre un générateur, supprimer. */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const videos = await import("@/services/videos");
const { lireParametre } = await import("@/services/_commun");
const { listerFormatsActifs } = await import("@/formats");
const { lectureImmediate } = await import("@/domaine/site-videos/mp4");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
let publics = creerStockagePublicFactice();
let journal: string[] = [];
let AVOCAT = "";
let TABLEAU = "";
let fetchAppele = 0;
const T0 = Date.UTC(2026, 9, 18, 10, 0, 0);
let horloge = T0;

beforeEach(async () => {
  await preparerBase();
  journal = [];
  horloge = T0;
  fetchAppele = 0;
  factice = creerSiteFactice({ secret: "secret-bout-en-bout", maintenant: () => horloge });
  const traiter = factice.traiter.bind(factice);
  factice.traiter = async (r) => {
    if (r.methode === "DELETE") journal.push(`DELETE:${(await depots().videos.obtenir(decodeURIComponent(r.chemin.split("/").pop()!))) ? "video-presente" : "video-absente"}`);
    return traiter(r);
  };
  publics = creerStockagePublicFactice({ lireSource: async () => mp4Test(true) });
  const efface = publics.supprimer.bind(publics);
  publics.supprimer = async (c) => {
    journal.push("efface");
    return efface(c);
  };
  injecterSiteFactice(factice);
  site.injecterStockagesSite({ public: publics, prive: { lireDebut: async () => mp4Test(true) } });
  site.injecterAttenteSite(async () => undefined);
  // Le `fetch` global lève s'il est appelé : l'envoi réel est impossible.
  vi.stubGlobal("fetch", async () => {
    fetchAppele++;
    throw new Error("réseau interdit");
  });
  // Une vidéo avocat et une autre (devenue « tableau animé »), prêtes, sans licence en défaut.
  const { obtenirVideo } = await import("@/services/videos");
  const libres: { id: string; formatId: string }[] = [];
  for (const v of await depots().videos.lister((x) => x.statut === "prete" && !!x.scriptId)) if (!(await obtenirVideo(v.id))!.licencesABloquer.length) libres.push({ id: v.id, formatId: v.formatId });
  AVOCAT = libres.find((v) => v.formatId === "avocat")!.id;
  TABLEAU = libres.find((v) => v.id !== AVOCAT && v.formatId === "avocat")!.id;
  await depots().videos.modifier(TABLEAU, { formatId: "tableau-anime" });
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
  site.injecterAttenteSite(null);
  vi.unstubAllGlobals();
});

const etat = async (id: string) => (await depots().kits.trouver((k) => k.videoId === id))!.site!;
const mp4s = () => [...publics.objets.values()].filter((o) => o.cle.endsWith(".mp4"));

describe("bout en bout contre le site factice", () => {
  it("parcours complet : sans rien toucher, rien ne se voit ni ne part ; puis publier, rejouer, mettre à jour, éteindre, supprimer", async () => {
    /* 1-2. Rien n'est allumé : aucun bloc, aucun appel, tous les réglages à faux. */
    for (const v of await depots().videos.lister((x) => x.statut === "prete")) expect(await site.vueSurLeSite(v.id), v.id).toEqual({ visible: false });
    for (const ligne of await site.lireReglagesSite()) expect(ligne, ligne.formatId).toMatchObject({ generateur: false, auto: false });
    for (const cle of ["site.passeportParClaude", "site.lienDansYoutube"]) expect(await lireParametre(cle, false), cle).toBe(false);
    for (const f of listerFormatsActifs()) {
      expect(await lireParametre(`siteGenerateurs.${f.id}`, false), f.id).toBe(false);
      expect(await lireParametre(`siteAuto.${f.id}`, false), f.id).toBe(false);
    }
    expect(await lireParametre("fournisseur.site", null)).toBeNull();
    expect(factice.appels).toEqual({ reglages: 0, publier: 0, retirer: 0 });
    expect(publics.objets.size).toBe(0);

    /* 3. On allume « avocat » et « tableau animé » (dans le test seulement), on remplit et on publie une vidéo de chacun. */
    await preparerVideoPublicable(AVOCAT);
    await preparerVideoPublicable(TABLEAU);
    await site.modifierPasseport(AVOCAT, { lienService: "/fr/services/automatisation" });
    expect((await site.publierSurLeSite(AVOCAT)).etat).toBe("en-ligne");
    expect((await site.publierSurLeSite(TABLEAU)).etat).toBe("en-ligne");

    /* 4. Chez le site : 2 pages, corps conformes à l'exemple du contrat ; 6 objets publics ; moov avant mdat. */
    expect(factice.pages.size).toBe(2);
    const exemple = JSON.parse(readFileSync("docs/site-videos/contrat/passeport.exemple.json", "utf8")) as Record<string, unknown>;
    expect(Object.keys(factice.pages.get(AVOCAT)!.corps)).toEqual(Object.keys(exemple));
    expect(Object.keys(factice.pages.get(TABLEAU)!.corps)).toEqual(Object.keys(exemple).filter((k) => k !== "lienService"));
    expect(publics.objets.size).toBe(6);
    expect(mp4s()).toHaveLength(2);
    for (const o of mp4s()) expect(lectureImmediate(o.octets!), o.cle).toBe("oui");
    expect([...publics.objets.values()].every((o) => o.cacheControl === "public, max-age=31536000, immutable")).toBe(true);
    const urlAvocat = factice.pages.get(AVOCAT)!;

    /* 5. Republier sans changement : pas une page de plus, pas un objet de plus. */
    const cles = [...publics.objets.keys()].sort();
    await site.publierSurLeSite(AVOCAT);
    expect(factice.pages.size).toBe(2);
    expect([...publics.objets.keys()].sort()).toEqual(cles);

    /* 6. Retoucher : version suivante, même adresse, objets précédents gardés, nouveaux ajoutés. */
    horloge += 60_000;
    const avant = (await depots().kits.trouver((k) => k.videoId === AVOCAT))!.passeportWeb!.version;
    await site.modifierPasseport(AVOCAT, { resume: "Un résumé retouché pour la seconde version de la page, toujours clair." });
    const e2 = await site.publierSurLeSite(AVOCAT);
    expect(factice.pages.get(AVOCAT)!.version).toBe(avant + 1);
    expect(factice.pages.get(AVOCAT)!.slug).toBe(urlAvocat.slug);
    expect(e2.url).toBe((await etat(AVOCAT)).url);
    expect(publics.objets.size).toBe(6 + 3);
    for (const c of cles.filter((x) => x.startsWith(`medias/videos/${AVOCAT}/`))) expect(publics.objets.has(c), c).toBe(true);

    /* 7. Éteindre « tableau animé » : sa page est retirée (410), ses objets effacés ; « avocat » intact. */
    const r = await site.definirSiteGenerateur("tableau-anime", false);
    expect(r.retirees).toBe(1);
    expect(factice.statutPage(TABLEAU)).toBe(410);
    expect([...publics.objets.keys()].some((c) => c.startsWith(`medias/videos/${TABLEAU}/`))).toBe(false);
    expect(factice.statutPage(AVOCAT)).toBe(200);
    expect((await etat(AVOCAT)).etat).toBe("en-ligne");
    expect(publics.objets.size).toBe(6);

    /* 8. Supprimer définitivement la vidéo avocat : DELETE avant l'effacement, 410, plus aucun objet, kit et vidéo effacés, dépenses gardées. */
    await depots().depenses.enregistrer({ id: "dep-e2e", videoId: AVOCAT, lignes: [], total: { centimes: 250, devise: "EUR" }, date: "2026-10-18T10:00:00.000Z", creeLe: "2026-10-18T10:00:00.000Z", modifieLe: "2026-10-18T10:00:00.000Z" });
    journal.length = 0;
    expect(await videos.supprimerVideoDefinitivement(AVOCAT)).toBe(true);
    expect(journal[0]).toBe("DELETE:video-presente");
    expect(factice.statutPage(AVOCAT)).toBe(410);
    expect(publics.objets.size).toBe(0);
    expect(await depots().videos.obtenir(AVOCAT)).toBeFalsy();
    expect(await depots().kits.trouver((k) => k.videoId === AVOCAT)).toBeFalsy();
    expect(await depots().depenses.obtenir("dep-e2e")).toMatchObject({ total: { centimes: 250 } });

    /* 9. Aucun appel réel : le `fetch` global n'a jamais été appelé. */
    expect(fetchAppele).toBe(0);
  });

  it("un site qui ne répond pas ne casse rien et n'efface rien de la vidéo en ligne", async () => {
    await preparerVideoPublicable(AVOCAT);
    await site.publierSurLeSite(AVOCAT);
    factice.panne = "injoignable";
    await expect(videos.supprimerVideoDefinitivement(AVOCAT)).rejects.toMatchObject({ code: "SITE_INJOIGNABLE" });
    expect(await depots().videos.obtenir(AVOCAT)).toBeTruthy();
    expect(publics.objets.size).toBe(3);
    factice.panne = null;
    expect(await videos.supprimerVideoDefinitivement(AVOCAT)).toBe(true);
    expect(publics.objets.size).toBe(0);
    expect(fetchAppele).toBe(0);
  });
});
