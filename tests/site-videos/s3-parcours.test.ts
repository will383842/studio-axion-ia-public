/** S3.3 — parcours complet contre le SITE FACTICE (étapes 5 à 11 du plan § 5.3) : publier, republier, mettre à jour, refuser, retirer, panne, double envoi. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { preparerBase, preparerMotDePasse, MDP_SITE } from "./helpers";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { depots } = await import("@/donnees/memoire");
const site = await import("@/services/site-videos");
const pub = await import("@/services/publications");
const { ErreurStudio } = await import("@/services/_commun");
const { creerSiteFactice, injecterSiteFactice } = await import("@/fournisseurs/site/simulation");

beforeAll(async () => {
  await preparerMotDePasse(MDP_SITE);
});

const VIDEO = "v-01";
const T0 = Date.UTC(2026, 9, 18, 10, 0, 0);
let horloge = T0;
let factice = creerSiteFactice({ secret: "x" });

/** Une vidéo prête dont tous les contrôles passent (passeport rempli, cases cochées, affiche 16:9). */
async function preparerVideoPublicable() {
  await site.definirSiteGenerateur("avocat", true);
  await depots().miniatures.modifier("v-01-mini-1", { ratio: "16:9" });
  await pub.obtenirKit(VIDEO);
  await site.modifierPasseport(VIDEO, {
    titreWeb: "Automatiser ses devis en dix minutes",
    aRetenir: ["Un modèle suffit.", "Dix minutes par devis.", "Aucun outil à payer."],
    questions: [
      { question: "Faut-il un logiciel ?", reponse: "Non, un modèle suffit." },
      { question: "Combien de temps ?", reponse: "Dix minutes." },
    ],
    rubrique: "Automatisation",
    motsCles: ["devis"],
  });
  for (const k of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, k, true);
  await site.cocherSurLeSite(VIDEO, true);
  await site.cocherAucunClient(VIDEO, true);
}

beforeEach(async () => {
  await preparerBase();
  horloge = T0;
  factice = creerSiteFactice({ secret: "secret-parcours", maintenant: () => horloge });
  injecterSiteFactice(factice);
  vi.stubGlobal("fetch", async () => {
    throw new Error("réseau interdit");
  });
  await preparerVideoPublicable();
});
afterEach(() => {
  injecterSiteFactice(null);
  vi.unstubAllGlobals();
});

/** La vue, avec le bloc visible. */
async function vue() {
  const v = await site.vueSurLeSite(VIDEO);
  if (!v.visible) throw new Error("bloc invisible");
  return v;
}
const etat = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))!.site!;
const passeport = async () => (await depots().kits.trouver((k) => k.videoId === VIDEO))!.passeportWeb!;

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ErreurStudio) return e.code;
    throw e;
  }
  return "AUCUN_REFUS";
}

describe("S3.3 parcours contre le site factice", () => {
  it("les contrôles passent avant le premier envoi (préparation du test)", async () => {
    const r = await site.controlesDeLaVideo(VIDEO);
    expect(r.controles.filter((c) => !c.ok && c.gravite === "bloquant")).toEqual([]);
    expect(r.publiable).toBe(true);
  });

  it("5. publier : une publication reçue, signature valable, état « en ligne » avec l'adresse du site", async () => {
    const e = await site.publierSurLeSite(VIDEO);
    expect(factice.appels.publier).toBe(1);
    expect(factice.pages.size).toBe(1);
    const p = await passeport();
    expect(e).toMatchObject({ choisie: true, etat: "en-ligne", versionEnLigne: p.version });
    expect(e.url).toBe(`https://site-factice.invalid/fr/videos/${factice.pages.get(VIDEO)!.slug}`);
    expect(e.url).toContain("automatiser-ses-devis-en-dix-minutes");
    const recu = factice.pages.get(VIDEO)!.corps;
    expect(recu).toMatchObject({ idStudio: VIDEO, versionPasseport: p.version, titre: "Automatiser ses devis en dix minutes", generateur: "avocat", langue: "fr", rubrique: "Automatisation", versionContrat: 1 });
    expect(recu.aRetenir).toHaveLength(3);
    expect(recu.largeurVignette).toBe(1280);
    expect(recu.urlVideo).toMatch(/^https:\/\/axion-ia\.com\/medias\/videos\//);
    const v = await site.vueSurLeSite(VIDEO);
    expect(v.visible && v.enLigne && v.url === e.url && !v.aMettreAJour && v.simulation).toBe(true);
  });

  it("6. republier sans changement : le site répond « inchangé », toujours une seule page", async () => {
    await site.publierSurLeSite(VIDEO);
    const avant = factice.pages.get(VIDEO)!.modifieLe;
    horloge += 60_000;
    const e = await site.publierSurLeSite(VIDEO);
    expect(factice.appels.publier).toBe(2);
    expect(factice.pages.size).toBe(1);
    expect(factice.pages.get(VIDEO)!.modifieLe).toBe(avant);
    expect(e.etat).toBe("en-ligne");
  });

  it("7. retoucher le résumé : « Mettre à jour » → version 2 chez le site, même adresse, date changée", async () => {
    const premier = await site.publierSurLeSite(VIDEO);
    const avant = factice.pages.get(VIDEO)!.modifieLe;
    horloge += 60_000;
    const p = await site.modifierPasseport(VIDEO, { resume: "Un résumé retouché, toujours clair et court pour la page." });
    const v = await site.vueSurLeSite(VIDEO);
    expect(v.visible && v.aMettreAJour).toBe(true);
    const e = await site.publierSurLeSite(VIDEO);
    expect(factice.pages.size).toBe(1);
    expect(factice.pages.get(VIDEO)!.version).toBe(p.version);
    expect(factice.pages.get(VIDEO)!.modifieLe).not.toBe(avant);
    expect(e.url).toBe(premier.url);
    expect(e.versionEnLigne).toBe(p.version);
    expect((await vue()).aMettreAJour).toBe(false);
  });

  it("8. un mot interdit dans le titre : refus (CONTROLES), la page en ligne reste telle quelle", async () => {
    await site.publierSurLeSite(VIDEO);
    const enLigne = factice.pages.get(VIDEO)!.version;
    await site.modifierPasseport(VIDEO, { titreWeb: "Devis pour Villeexemple" });
    expect(await code(site.publierSurLeSite(VIDEO))).toBe("CONTROLES");
    expect(factice.pages.get(VIDEO)!.version).toBe(enLigne);
    expect(factice.appels.publier).toBe(1);
    expect((await etat()).etat).toBe("en-ligne");
  });

  it("9. retirer : le site répond 410, état « retirée » ; republier ensuite est possible, même adresse", async () => {
    const premier = await site.publierSurLeSite(VIDEO);
    const r = await site.retirerDuSite(VIDEO);
    expect(factice.statutPage(VIDEO)).toBe(410);
    expect(factice.appels.retirer).toBe(1);
    expect(r).toMatchObject({ etat: "retiree" });
    expect(r.versionEnLigne).toBeUndefined();
    expect((await vue()).enLigne).toBe(false);
    const encore = await site.publierSurLeSite(VIDEO);
    expect(encore.url).toBe(premier.url);
    expect(factice.statutPage(VIDEO)).toBe(200);
  });

  it("retirer une vidéo jamais publiée : aucun appel au site", async () => {
    const r = await site.retirerDuSite(VIDEO);
    expect(factice.appels.retirer).toBe(0);
    expect(r.etat).toBe("hors-ligne");
  });

  it("10. le site tombe en panne pendant l'envoi : état « échec » lisible, aucune exception, la fiche s'affiche", async () => {
    factice.panne = "injoignable";
    const e = await site.publierSurLeSite(VIDEO);
    expect(e.etat).toBe("echec");
    expect(e.derniereErreur).toMatch(/site/i);
    expect(e.versionEnLigne).toBeUndefined();
    const v = await site.vueSurLeSite(VIDEO);
    expect(v.visible && v.etat).toBe("echec");
    expect(v.visible && v.derniereErreur).toBe(e.derniereErreur);
    // Le site revient : on peut réessayer.
    factice.panne = null;
    expect((await site.publierSurLeSite(VIDEO)).etat).toBe("en-ligne");
    expect((await etat()).derniereErreur).toBeUndefined();
  });

  it("10 bis. une réponse 500 du site : « échec » aussi", async () => {
    factice.panne = "500";
    const e = await site.publierSurLeSite(VIDEO);
    expect(e.etat).toBe("echec");
  });

  it("11. deux envois simultanés : un seul part (état « envoi en cours » sous le verrou du kit)", async () => {
    const original = factice.traiter.bind(factice);
    factice.traiter = async (r) => {
      await new Promise((ok) => setTimeout(ok, 60));
      return original(r);
    };
    const resultats = await Promise.allSettled([site.publierSurLeSite(VIDEO), site.publierSurLeSite(VIDEO)]);
    expect(factice.appels.publier).toBe(1);
    expect(resultats.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refus = resultats.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((refus.reason as InstanceType<typeof ErreurStudio>).code).toBe("ENVOI_EN_COURS");
    expect((await etat()).etat).toBe("en-ligne");
  });

  it("un envoi « en cours » oublié depuis plus de 5 minutes (studio arrêté) ne bloque plus", async () => {
    const kit = (await depots().kits.trouver((k) => k.videoId === VIDEO))!;
    await depots().kits.modifier(kit.id, { site: { ...kit.site!, etat: "envoi-en-cours", modifieLe: new Date(Date.now() - 10 * 60_000).toISOString() } });
    expect((await site.publierSurLeSite(VIDEO)).etat).toBe("en-ligne");
  });

  it("la feuille de relecture rend la page, les contrôles et le prix (aucune écriture, aucun envoi)", async () => {
    const f = await site.feuilleSurLeSite(VIDEO);
    expect(f.controles.publiable).toBe(true);
    expect(f.aucunClient).toBe(true);
    expect(f.prixClaude).toBeNull();
    expect(f.simulation).toBe(true);
    expect(f.enLigne).toBe(false);
    expect(f.passeport.aRetenir).toHaveLength(3);
    expect(factice.appels.publier).toBe(0);
  });

  it("aucun fetch réel n'a été appelé pendant tout le parcours", async () => {
    await site.publierSurLeSite(VIDEO);
    await site.retirerDuSite(VIDEO);
    // Le double de fetch lève s'il est appelé : le parcours est allé au bout, donc il ne l'a pas été.
    expect(factice.appels).toEqual({ reglages: expect.any(Number), publier: 1, retirer: 1 });
  });
});
