/**
 * KIT-CC-IV · les textes rangés dans la version d'un cas concret ou d'une image → vidéo entrent dans le kit
 * (source « variante »), le rédacteur « texte-reseaux » n'est jamais appelé pour ces formats, l'envoi sans textes est refusé.
 * Aucun appel réel : doublure de l'envoi (simulation), données fictives.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const iv = vi.hoisted(() => ({ travail: null as unknown }));
vi.mock("@/services/image-video-carte", () => ({ travailImageVideo: async () => iv.travail }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const pub = await import("@/services/publications");
const pc = await import("@/services/premier-commentaire");
const { ID_MOTEUR_CAS_CONCRET } = await import("@/moteurs/montage-cas-concret");
const fournisseurs = await import("@/fournisseurs");

const MDP = "essai-kit-cc-iv";
const VIDEO = "v-15";
const JOUR = 24 * 3600_000;
const demain = () => new Date(Date.now() + JOUR).toISOString();

const CAS = [
  { reseau: "instagram", texte: "Le texte du cas pour Instagram.", motsDiese: ["#devis", "#relance"], premierCommentaire: "Le diagnostic : https://exemple.fr/d" },
  { reseau: "linkedin", texte: "Le texte du cas pour LinkedIn.", hashtags: ["#artisan"], premierCommentaire: "Lien en commentaire" },
];
const IV = { parametres: { imageVideo: { version: "fabrication-iv/1", livraison: [
  { reseau: "instagram", version: "longue", texte: "Le texte image pour Instagram.", premierCommentaire: "Commentaire image" },
  { reseau: "linkedin", version: "aucune", texte: "ne doit pas entrer" },
] } } };

async function poserCasConcret(publication: unknown, essai = false) {
  const ver = (await depots().versions.obtenir("v-15-ver-1"))!;
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, moteurId: ID_MOTEUR_CAS_CONCRET, entrees: { casConcret: { essai } } }, projetMontage: { casConcret: { publication } } } as never);
}
async function poserImageVideo(travail: unknown) {
  iv.travail = travail;
  await depots().videos.modifier(VIDEO, { formatId: "image-video" } as never);
}
async function cocherTout() {
  for (const c of ["image", "son", "sousTitres", "mentionIA", "droits"] as const) await pub.cocherAvantDePublier(VIDEO, c, true);
}
const kitInstagram = async () => (await pub.obtenirKit(VIDEO))!.reseaux.find((r) => r.reseau === "instagram")!;

let redacteur: ReturnType<typeof vi.spyOn>;
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.restoreAllMocks();
  iv.travail = null;
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  redacteur = vi.spyOn(fournisseurs.resoudreFournisseur("texte-reseaux", null), "ecrire");
});

describe("KIT-CC-IV · cas concret", () => {
  it("(1) le kit porte le texte, les mots-dièse et l'origine « version » de chaque réseau ; le premier commentaire se lit au même endroit", async () => {
    await poserCasConcret(CAS);
    const insta = await kitInstagram();
    expect(insta.texte).toBe("Le texte du cas pour Instagram.");
    expect(insta.motsDiese).toEqual(["#devis", "#relance"]);
    expect(insta.origine).toBe("version");
    const linkedin = (await pub.obtenirKit(VIDEO))!.reseaux.find((r) => r.reseau === "linkedin")!;
    expect(linkedin.texte).toBe("Le texte du cas pour LinkedIn.");
    expect(linkedin.motsDiese).toEqual(["#artisan"]);
    expect(await pc.premierCommentaireDeVideo(VIDEO, "instagram")).toBe("Le diagnostic : https://exemple.fr/d");
  });

  it("(4) aucun appel au rédacteur « texte-reseaux », ni à l'affichage, ni à la création du kit, ni à la réécriture", async () => {
    await poserCasConcret(CAS);
    await pub.obtenirKit(VIDEO);
    await pub.genererKit(VIDEO, { autoriserDepense: true });
    await expect(pub.regenererTexteKit(VIDEO, "instagram")).rejects.toThrow();
    expect(redacteur).not.toHaveBeenCalled();
  });

  it("(3) sans textes dans la version : jamais de texte d'essai, l'envoi est refusé avec un message clair", async () => {
    await poserCasConcret([]);
    const insta = await kitInstagram();
    expect(insta.texte).toBe("");
    expect(insta.origine).not.toBe("essai");
    await cocherTout();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], demain())).rejects.toThrow(/texte/i);
    expect(redacteur).not.toHaveBeenCalled();
  });

  it("(3) vidéo d'essai : ses textes ne sont pas repris, l'envoi est refusé", async () => {
    await poserCasConcret(CAS, true);
    expect((await kitInstagram()).texte).toBe("");
    await cocherTout();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], demain())).rejects.toThrow(/texte/i);
  });

  it("(3) texte vide ou blanc dans la version : compté comme manquant", async () => {
    await poserCasConcret([{ reseau: "instagram", texte: "   " }]);
    expect((await kitInstagram()).texte).toBe("");
    await cocherTout();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], demain())).rejects.toThrow(/texte/i);
  });

  it("(5) l'envoi reste un brouillon et exige les cases cochées", async () => {
    await poserCasConcret(CAS);
    expect((await pub.obtenirKit(VIDEO))!.publiable).toBe(false);
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], demain())).rejects.toThrow();
    await cocherTout();
    expect((await pub.obtenirKit(VIDEO))!.publiable).toBe(true);
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], demain());
    expect(r.simulation).toBe(true);
    expect(r.publications.length).toBeGreaterThan(0);
    for (const p of r.publications) expect(p.statut).toBe("brouillon");
    expect(redacteur).not.toHaveBeenCalled();
  });

  it("un texte retouché à la main n'est jamais écrasé ; un rejeu ne change rien", async () => {
    await poserCasConcret(CAS);
    await pub.obtenirKit(VIDEO);
    await pub.modifierTexteKit(VIDEO, "instagram", "Ma retouche", ["#moi"]);
    expect((await kitInstagram()).texte).toBe("Ma retouche");
    expect((await kitInstagram()).texte).toBe("Ma retouche");
  });

  it("un texte d'essai déjà rangé dans un ancien kit est remplacé par celui de la version, et effacé pour un réseau sans texte", async () => {
    await pub.genererKit(VIDEO);
    await poserCasConcret([CAS[0]]);
    expect((await kitInstagram()).texte).toBe("Le texte du cas pour Instagram.");
    const linkedin = (await pub.obtenirKit(VIDEO))!.reseaux.find((r) => r.reseau === "linkedin")!;
    expect(linkedin.texte).toBe("");
  });
});

describe("KIT-CC-IV · image → vidéo", () => {
  it("(2) le kit reprend le texte de la livraison du réseau ; un réseau « aucune » n'a pas de texte", async () => {
    await poserImageVideo(IV);
    const insta = await kitInstagram();
    expect(insta.texte).toBe("Le texte image pour Instagram.");
    expect(insta.origine).toBe("version");
    expect((await pub.obtenirKit(VIDEO))!.reseaux.find((r) => r.reseau === "linkedin")!.texte).toBe("");
    expect(await pc.premierCommentaireDeVideo(VIDEO, "instagram")).toBe("Commentaire image");
    expect(redacteur).not.toHaveBeenCalled();
  });

  it("(3) travail illisible ou sans livraison : envoi refusé, aucun texte d'essai", async () => {
    for (const travail of [null, { parametres: {} }, { parametres: { imageVideo: { version: "autre/9", livraison: [] } } }, { parametres: { imageVideo: { version: "fabrication-iv/1", livraison: "x" } } }]) {
      await poserImageVideo(travail);
      expect((await kitInstagram()).texte).toBe("");
    }
    await cocherTout();
    await expect(pub.envoyerVersBuffer(VIDEO, ["instagram"], demain())).rejects.toThrow(/texte/i);
  });

  it("(5) avec ses textes, l'envoi part en brouillon simulé", async () => {
    await poserImageVideo(IV);
    await cocherTout();
    const r = await pub.envoyerVersBuffer(VIDEO, ["instagram"], demain());
    expect(r.simulation).toBe(true);
    for (const p of r.publications) expect(p.statut).toBe("brouillon");
    expect(redacteur).not.toHaveBeenCalled();
  });
});

describe("KIT-CC-IV · autres formats", () => {
  it("un format ordinaire garde son texte d'essai du rédacteur (rien ne change)", async () => {
    const insta = await kitInstagram();
    expect(insta.texte.length).toBeGreaterThan(0);
    expect(insta.origine).not.toBe("version");
  });
});

describe("KIT-CC-IV · toutes les voies d'envoi refusent des textes manquants", () => {
  // Doublure du diffuseur : tout appel serait une faute, le refus doit venir avant.
  const faux = () => {
    const appels = vi.fn();
    const service = new Proxy({}, { get: () => appels }) as never;
    return { appels, service };
  };
  const vue = async () => (await pub.obtenirKit(VIDEO))!;

  it("(3) envoyerReel par l'outil « zernio » : texte du réseau absent → TEXTES_MANQUANTS, rien n'est appelé", async () => {
    await poserCasConcret([CAS[1]]);
    await cocherTout();
    const { appels, service } = faux();
    await expect(pub.envoyerReel("zernio", service, await vue(), ["instagram"], demain(), {}, {}, true)).rejects.toMatchObject({ code: "TEXTES_MANQUANTS" });
    expect(appels).not.toHaveBeenCalled();
    expect(redacteur).not.toHaveBeenCalled();
  });

  it("(3) envoyerReel par l'outil « buffer » : même refus", async () => {
    await poserCasConcret([]);
    await cocherTout();
    const { appels, service } = faux();
    await expect(pub.envoyerReel("buffer", service, await vue(), ["instagram"], demain(), {}, {}, true)).rejects.toMatchObject({ code: "TEXTES_MANQUANTS" });
    expect(appels).not.toHaveBeenCalled();
  });

  it("(3) image → vidéo, outil « zernio » : texte en blanc → refus", async () => {
    await poserImageVideo({ parametres: { imageVideo: { version: "fabrication-iv/1", livraison: [{ reseau: "instagram", version: "longue", texte: "  " }] } } });
    await cocherTout();
    const { appels, service } = faux();
    await expect(pub.envoyerReel("zernio", service, await vue(), ["instagram"], demain(), {}, {}, true)).rejects.toMatchObject({ code: "TEXTES_MANQUANTS" });
    expect(appels).not.toHaveBeenCalled();
  });

  it("un format ordinaire n'est pas touché par ce refus (le code du refus n'est pas TEXTES_MANQUANTS)", async () => {
    await cocherTout();
    const { service } = faux();
    const r = await pub.envoyerReel("zernio", service, await vue(), ["instagram"], demain(), {}, {}, true).then(() => null, (e) => e);
    expect(r?.code).not.toBe("TEXTES_MANQUANTS");
  });
});
