/** S4.5 — ordre d'une publication (plan § 6.2) : fichiers publics déposés AVANT l'envoi, en-têtes exacts, nettoyage, versions. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { mp4Test, preparerVideoPublicable } from "./helpers-publiable";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const { creerSiteFactice, creerStockagePublicFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");
const { adressePublique } = await import("@/domaine/site-videos/contrat");
const { ErreurStudio } = await import("@/services/_commun");

const VIDEO = "v-01";
beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

let factice = creerSiteFactice({ secret: "x" });
let publics = creerStockagePublicFactice();
let journal: string[] = [];
let mp4 = mp4Test(true);

beforeEach(async () => {
  await preparerBase();
  journal = [];
  mp4 = mp4Test(true);
  factice = creerSiteFactice({ secret: "secret-publication" });
  // Le site factice écrit « POST » dans le même journal que le stockage public : on voit l'ordre réel des gestes.
  const traiter = factice.traiter.bind(factice);
  factice.traiter = async (r) => {
    if (r.methode === "POST") journal.push("POST");
    if (r.methode === "DELETE") journal.push("DELETE");
    return traiter(r);
  };
  publics = creerStockagePublicFactice();
  const copier = publics.copierDepuisPrive.bind(publics);
  publics.copierDepuisPrive = async (...a) => {
    await copier(...a);
    journal.push(`copie:${a[1]}`);
  };
  const texte = publics.deposerTexte.bind(publics);
  publics.deposerTexte = async (...a) => {
    await texte(...a);
    journal.push(`texte:${a[0]}`);
  };
  const efface = publics.supprimer.bind(publics);
  publics.supprimer = async (c) => {
    await efface(c);
    journal.push(`efface:${c}`);
  };
  injecterSiteFactice(factice);
  site.injecterStockagesSite({ public: publics, prive: { lireDebut: async () => mp4 } });
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit");
  });
  await preparerVideoPublicable(VIDEO);
});
afterEach(() => {
  injecterSiteFactice(null);
  site.injecterStockagesSite(null);
  vi.unstubAllGlobals();
});

const etat = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))!.site!;
const objets = () => [...publics.objets.values()];
const parType = (ext: string) => objets().filter((o) => o.cle.endsWith(`.${ext}`));

describe("S4.5 ordre d'une publication", () => {
  it("3 objets déposés AVANT le POST, avec les en-têtes exacts", async () => {
    const e = await site.publierSurLeSite(VIDEO);
    expect(e.etat).toBe("en-ligne");
    const iPost = journal.indexOf("POST");
    expect(iPost).toBe(3);
    expect(journal.slice(0, 3).map((x) => x.split(":")[0]).sort()).toEqual(["copie", "copie", "texte"]);
    expect(objets()).toHaveLength(3);
    for (const o of objets()) {
      expect(o.cacheControl).toBe("public, max-age=31536000, immutable");
      expect(o.cle).toMatch(/^medias\/videos\/v-01\/[a-z0-9-]+-v\d+-[0-9a-f]{8}\.(mp4|jpg|vtt)$/);
    }
    expect(parType("mp4")[0].contentType).toBe("video/mp4");
    expect(parType("jpg")[0].contentType).toBe("image/jpeg");
    expect(parType("vtt")[0].contentType).toBe("text/vtt; charset=utf-8");
  });

  it("le .vtt est fabriqué au moment de publier, depuis les sous-titres", async () => {
    await site.publierSurLeSite(VIDEO);
    const vtt = new TextDecoder().decode(parType("vtt")[0].octets);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("-->");
  });

  it("les clés sont gardées dans l'état AVANT l'envoi, et le corps du POST porte leurs adresses publiques", async () => {
    let cleSurLeSite: string[] = [];
    const traiter = factice.traiter.bind(factice);
    factice.traiter = async (r) => {
      if (r.methode === "POST") cleSurLeSite = (await etat()).fichiersPublics;
      return traiter(r);
    };
    const e = await site.publierSurLeSite(VIDEO);
    expect(cleSurLeSite).toHaveLength(3);
    expect([...e.fichiersPublics].sort()).toEqual(objets().map((o) => o.cle).sort());
    const corps = factice.pages.get(VIDEO)!.corps;
    expect(corps.urlVideo).toBe(adressePublique(parType("mp4")[0].cle));
    expect(corps.urlVignette).toBe(adressePublique(parType("jpg")[0].cle));
    expect(corps.urlVtt).toBe(adressePublique(parType("vtt")[0].cle));
  });

  it("une panne du site pendant le POST : les fichiers de CETTE version sont effacés, aucun orphelin", async () => {
    factice.panne = "500";
    const e = await site.publierSurLeSite(VIDEO);
    expect(e.etat).toBe("echec");
    expect(objets()).toHaveLength(0);
    expect(e.fichiersPublics).toEqual([]);
    // 3 dépôts puis 3 effacements.
    expect(journal.filter((x) => x.startsWith("efface:"))).toHaveLength(3);
  });

  it("une panne du stockage public : rien n'est envoyé au site, état « échec », rien ne reste", async () => {
    publics.panne = true;
    const e = await site.publierSurLeSite(VIDEO);
    expect(e.etat).toBe("echec");
    expect(factice.appels.publier).toBe(0);
    expect(objets()).toHaveLength(0);
    expect(e.derniereErreur).toBeTruthy();
  });

  it("republier sans changement : mêmes clés, aucun objet de plus, rien n'est effacé", async () => {
    await site.publierSurLeSite(VIDEO);
    const avant = objets().map((o) => o.cle).sort();
    journal.length = 0;
    await site.publierSurLeSite(VIDEO);
    expect(objets().map((o) => o.cle).sort()).toEqual(avant);
    expect(journal.some((x) => x.startsWith("efface:"))).toBe(false);
    expect(factice.pages.size).toBe(1);
  });

  it("une panne au republication de la même version n'efface pas les fichiers de la page en ligne", async () => {
    await site.publierSurLeSite(VIDEO);
    const avant = objets().map((o) => o.cle).sort();
    factice.panne = "500";
    const e = await site.publierSurLeSite(VIDEO);
    expect(e.etat).toBe("echec");
    expect(objets().map((o) => o.cle).sort()).toEqual(avant);
    expect(e.versionEnLigne).toBeDefined();
  });

  it("versions : la précédente est gardée, la suivante efface celle d'avant", async () => {
    const versions = async () => [...new Set(objets().map((o) => /-v(\d+)-/.exec(o.cle)![1]))].sort();
    const v1 = (await etat()) && (await site.publierSurLeSite(VIDEO));
    const n1 = String(v1.versionEnLigne);
    await site.modifierPasseport(VIDEO, { resume: "Premier résumé retouché, assez long pour la page du site." });
    await site.publierSurLeSite(VIDEO);
    const n2 = String(Number(n1) + 1);
    expect(await versions()).toEqual([n1, n2]);
    expect(objets()).toHaveLength(6);
    await site.modifierPasseport(VIDEO, { resume: "Second résumé retouché, assez long pour la page du site." });
    const e = await site.publierSurLeSite(VIDEO);
    const n3 = String(Number(n2) + 1);
    expect(await versions()).toEqual([n2, n3]);
    expect(objets()).toHaveLength(6);
    expect(e.fichiersPublics).toHaveLength(6);
    expect(e.fichiersPublics.every((c) => publics.objets.has(c))).toBe(true);
  });
});

describe("S4.5 lecture immédiate du fichier", () => {
  it("« moov » après « mdat » : refus clair, rien n'est copié ni envoyé, l'état reste « hors ligne »", async () => {
    mp4 = mp4Test(false);
    let code = "";
    let message = "";
    try {
      await site.publierSurLeSite(VIDEO);
    } catch (e) {
      code = (e as InstanceType<typeof ErreurStudio>).code;
      message = (e as Error).message;
    }
    expect(code).toBe("LECTURE_IMMEDIATE");
    expect(message).toBe("Le fichier ne se lit pas tout de suite en ligne : refaites l'export.");
    expect(objets()).toHaveLength(0);
    expect(factice.appels.publier).toBe(0);
    expect((await etat()).etat).toBe("hors-ligne");
  });

  it("stockage sans lecture partielle (simulation) : « inconnu » n'est qu'un avertissement, la publication a lieu", async () => {
    site.injecterStockagesSite({ public: publics });
    const e = await site.publierSurLeSite(VIDEO);
    expect(e.etat).toBe("en-ligne");
  });
});
