/**
 * Pinterest, PR 5 : envoi d'une épingle depuis le calendrier. Faux fournisseur, dépôts en mémoire, aucun appel réel.
 * Données fictives (exemple.test). Le tour général reste FERMÉ à Pinterest.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { creerFauxClientZernio } from "../zernio/aides/faux-zernio";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

const porte = vi.hoisted(() => ({ ouverte: false }));
vi.mock("@/domaine/reseaux-visuel-envoi", async (original) => {
  const reel = await original<typeof import("@/domaine/reseaux-visuel-envoi")>();
  const copie = { ...reel };
  Object.defineProperty(copie, "PINTEREST_TOUR_GENERAL", { get: () => porte.ouverte, enumerable: true });
  return copie;
});
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const pub = await import("@/services/publications");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
const { construireDepsEnvoiCalendrier, CREATIONS_PINTEREST_PAR_TOUR } = await import("@/services/branchement-envoi-calendrier");
const { identifiantsProgrammation } = await import("@/services/plan-editorial");
const { tableauDeLaCible } = await import("@/services/promotion-envois");
const { lireVisuelStocke } = await import("@/domaine/visuels/depot");

const VALIDEE = "2026-11-12T10:00:00Z";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const CIBLE = "compte-pin:pin:111";
const ALT_500 = "a".repeat(500);
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;

let appels: DemandePublication[] = [];
const faux = (): FournisseurPublication =>
  ({
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [
      { id: CIBLE, organisationId: "zernio", nom: "Compte · Idées", service: "pinterest", genre: "tableau", deconnecte: false },
      { id: "compte-2", organisationId: "zernio", nom: "Compte Instagram", service: "instagram", deconnecte: false },
    ],
    envoyer: async (d: DemandePublication) => {
      appels.push(d);
      return { idExterne: "ext-1", via: "zernio", statut: "brouillon" };
    },
  }) as unknown as FournisseurPublication;

const epingle = (p: Record<string, unknown> = {}) => ({
  titre: "Titre d'exemple", lien: "https://axion-ia.com/exemple", texteAlternatif: ALT_500, contenuIA: true, cle: "ep-1",
  image: { cle: "epingles/pinterest/2x3/ep-1.png", largeur: 1000, hauteur: 1500, mime: "image/png", sha256: "a".repeat(64), taille: 1234 }, ...p,
});
async function visuelEpingle(id = "vis_pin", p: Record<string, unknown> = {}): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id, famille: "epingle", titre: "Titre d'exemple", entree: { type: "session" }, statut: "valide", modeTexte: "import", reseaux: ["pinterest"],
    versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le, epingle: epingle(), ...p,
  } as never);
}
async function visuelCarrousel(): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_car", famille: "carrousel", titre: "Cinq erreurs", entree: { type: "sujet", sujet: "x" }, statut: "valide", modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le,
    rendu: { empreinte: "e1", pdfCle: "v/c.pdf", vignetteCle: "v/v.png", pages: [{ index: 1, x1Cle: "v/p1.png", x2Cle: "v/p1@2x.png" }], renduLe: le },
  } as never);
}
async function creneau(id: string, visuelId: string, reseau: string, heure = DEMAIN, cible = CIBLE): Promise<string> {
  await depots().creneauxEditoriaux.enregistrer({
    id, jourVise: heure.slice(0, 10), heuresParReseau: { [reseau]: heure }, compteCible: cible, visuelId,
    textes: { [reseau]: { texte: "Description d'exemple", premierCommentaire: "" } },
    statut: "valide", decalages: 0, valideeLe: VALIDEE, valideePar: "le fondateur",
  } as never);
  return id;
}
async function ouvrirTout(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
}

beforeEach(async () => {
  appels = [];
  porte.ouverte = false;
  vi.stubGlobal("fetch", () => Promise.reject(new Error("aucun appel réel dans ce test")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  reinitialiserDepots();
  await ouvrirTout();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Pinterest PR 5 · envoyerVisuel d'une épingle", () => {
  // Ces cas portent sur le contenu de l'envoi : le tour Pinterest y est ouvert (constante forcée). Le tour fermé a son bloc plus bas.
  beforeEach(() => {
    porte.ouverte = true;
  });
  it("demande : cible tableau, une image, alt de 500 sans suffixe de page, titre, lien, description, contenuIA, brouillon", async () => {
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    const r = await pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl });
    expect(r.deja).toBe(false);
    expect(appels).toHaveLength(1);
    expect(appels[0]).toMatchObject({
      reseau: "pinterest", cible: CIBLE, canalId: CIBLE, mode: "brouillon", texte: "Description d'exemple", contenuIA: true,
      epingle: { titre: "Titre d'exemple", lien: "https://axion-ia.com/exemple" },
      images: [{ url: "https://exemple.test/epingles/pinterest/2x3/ep-1.png", texteAlternatif: ALT_500 }],
    });
    expect(appels[0].images![0].texteAlternatif).not.toContain("page");
  });
  it("contenuIA faux est transmis tel quel (jamais déduit)", async () => {
    await visuelEpingle("vis_pin", { epingle: epingle({ contenuIA: false }) });
    await pub.envoyerVisuel(faux(), await creneau("cr-1", "vis_pin", "pinterest"), "pinterest", { lireUrl });
    expect(appels[0].contenuIA).toBe(false);
  });
  it("carrousel vers Pinterest refusé ; épingle vers Instagram refusé ; zéro appel", async () => {
    await visuelCarrousel();
    await visuelEpingle();
    await expect(pub.envoyerVisuel(faux(), await creneau("c1", "vis_car", "pinterest", DEMAIN, "compte-pin"), "pinterest", { lireUrl })).rejects.toMatchObject({ code: "VISUEL_REFUSE" });
    await expect(pub.envoyerVisuel(faux(), await creneau("c2", "vis_pin", "instagram", DEMAIN, "compte-2"), "instagram", { lireUrl, textesAlternatifs: ["alt"] })).rejects.toMatchObject({ code: "VISUEL_REFUSE" });
    expect(appels).toHaveLength(0);
  });
  it("anti-doublon : deux appels → une publication, deja: true, un seul appel", async () => {
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    await pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl });
    const r2 = await pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl });
    expect(r2.deja).toBe(true);
    expect(appels).toHaveLength(1);
    expect(await depots().publications.lister((p) => p.visuelId === "vis_pin")).toHaveLength(1);
  });
  it("porte fermée : refus avant toute lecture, zéro appel", async () => {
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, false);
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    await expect(pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
  });
  it("réglage site.domaine vide, ou lien hors domaine : refus, zéro appel, rien d'écrit", async () => {
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    const avant = await depots().publications.compter();
    await ecrireParametre("site.domaine", "");
    await expect(pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl })).rejects.toMatchObject({ code: "LIEN_HORS_DOMAINE" });
    await ecrireParametre("site.domaine", "autre.exemple");
    await expect(pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl })).rejects.toMatchObject({ code: "LIEN_HORS_DOMAINE" });
    expect(appels).toHaveLength(0);
    expect(await depots().publications.compter()).toBe(avant);
  });
  it("premier commentaire non vide : refusé (non transmis)", async () => {
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    await depots().creneauxEditoriaux.modifier(id, { textes: { pinterest: { texte: "Description d'exemple", premierCommentaire: "Bonjour" } } } as never);
    await expect(pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl })).rejects.toMatchObject({ code: "PREMIER_COMMENTAIRE_NON_TRANSMIS" });
    expect(appels).toHaveLength(0);
  });
});

describe("Pinterest PR 5 · porte Pinterest propre à l'envoi (porte générale ouverte, tour fermé)", () => {
  const poserEssai = async (creneauId: string, p: Record<string, unknown> = {}): Promise<void> => {
    const t = Date.now();
    await ecrireParametre("zernio.essai_brouillon", { version: 1, creneauId, compte: CIBLE, reseau: "pinterest", poseLe: new Date(t - 3600_000).toISOString(), expireLe: new Date(t + 3 * 3600_000).toISOString(), ...p });
  };
  beforeEach(() => {
    vi.stubEnv("ZERNIO_API_KEY", "cle-essai");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("tour fermé, pas d'essai : refus avant tout appel, rien d'écrit", async () => {
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    const avant = await depots().publications.compter();
    await expect(pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
    expect(await depots().publications.compter()).toBe(avant);
  });
  it("essai d'un AUTRE créneau : refus ; essai de CE créneau : brouillon créé", async () => {
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    await creneau("cr-2", "vis_pin", "pinterest");
    await poserEssai("cr-2");
    await expect(pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
    await poserEssai("cr-1");
    const r = await pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl });
    expect(r.deja).toBe(false);
    expect(appels).toHaveLength(1);
  });
  it("essai expiré : refus, zéro appel", async () => {
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    await poserEssai("cr-1", { poseLe: new Date(Date.now() - 5 * 3600_000).toISOString(), expireLe: new Date(Date.now() - 3600_000).toISOString() });
    await expect(pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
  });
  it("image d'épingle hors ligne : refus, zéro appel", async () => {
    porte.ouverte = true;
    await visuelEpingle();
    const id = await creneau("cr-1", "vis_pin", "pinterest");
    await expect(pub.envoyerVisuel(faux(), id, "pinterest", { lireUrl: async () => "http://hors-ligne.test/x.png" })).rejects.toMatchObject({ code: "FICHIER_HORS_LIGNE" });
    expect(appels).toHaveLength(0);
  });
  it("tour : l'essai d'un créneau Pinterest donne sa seule ligne, un essai expiré n'en donne aucune", async () => {
    const deps = () => construireDepsEnvoiCalendrier({ service: () => faux(), lireUrl, porte: async () => true, client: creerFauxClientZernio().client });
    for (const i of [1, 2]) {
      await visuelEpingle(`vis_${i}`, { epingle: epingle({ cle: `ep-${i}` }) });
      await creneau(`cr-${i}`, `vis_${i}`, "pinterest", new Date(Date.now() + (2 + i) * 24 * 3600_000).toISOString());
    }
    await poserEssai("cr-1");
    expect((await deps().creneaux()).filter((l) => l.reseau === "pinterest").map((l) => l.id)).toEqual(["cr-1"]);
    await poserEssai("cr-1", { poseLe: new Date(Date.now() - 5 * 3600_000).toISOString(), expireLe: new Date(Date.now() - 3600_000).toISOString() });
    expect((await deps().creneaux()).filter((l) => l.reseau === "pinterest")).toEqual([]);
  });
});

describe("Pinterest PR 5 · tour du calendrier : fermé à Pinterest", () => {
  const deps = () => construireDepsEnvoiCalendrier({ service: () => faux(), lireUrl, porte: async () => true, client: creerFauxClientZernio().client });
  const heure = (i: number) => new Date(Date.now() + (2 + i) * 24 * 3600_000).toISOString();
  async function sept(): Promise<void> {
    for (let i = 0; i < 7; i++) {
      await visuelEpingle(`vis_${i}`, { epingle: epingle({ cle: `ep-${i}` }) });
      await creneau(`cr-${i}`, `vis_${i}`, "pinterest", heure(i));
    }
  }
  it("tour général fermé : 0 ligne Pinterest, 0 appel", async () => {
    await sept();
    expect((await deps().creneaux()).filter((l) => l.reseau === "pinterest")).toEqual([]);
    expect(appels).toHaveLength(0);
  });
  it("tour ouvert (constante forcée) : au plus 3 créations par tour", async () => {
    porte.ouverte = true;
    await sept();
    expect(CREATIONS_PINTEREST_PAR_TOUR).toBe(3);
    const lignes = (await deps().creneaux()).filter((l) => l.reseau === "pinterest");
    expect(lignes).toHaveLength(3);
  });
  it("tour suivant : les créneaux déjà créés ne comptent plus dans le plafond, 3 nouveaux passent", async () => {
    porte.ouverte = true;
    await sept();
    const premiers = (await deps().creneaux()).filter((l) => l.reseau === "pinterest");
    for (const l of premiers) {
      await depots().envoisPlanifies.enregistrer({ id: `env-${l.id}`, cle: `envoi:${l.videoId}:pinterest:v0:${l.id}`, videoId: l.videoId, nature: "visuel", creneauId: l.id, reseau: "pinterest", versionCreneau: 0, jour: l.jour, heure: l.heure, statut: "brouillon", creeLe: VALIDEE, modifieLe: VALIDEE } as never);
    }
    const tour2 = (await deps().creneaux()).filter((l) => l.reseau === "pinterest");
    const nouveaux = tour2.filter((l) => !premiers.some((p) => p.id === l.id));
    expect(nouveaux).toHaveLength(3);
  });
});

describe("Pinterest PR 5 · schéma, plan, promotion", () => {
  it("lireVisuelStocke : épingle valide lue ; Pinterest refusé pour un carrousel ; épingle sans ses champs refusée", () => {
    const base = { id: "v", titre: "t", entree: { type: "session" }, statut: "valide", modeTexte: "import", versionSpec: 1, coutCentimes: 0, creeLe: "x", modifieLe: "x" };
    expect(lireVisuelStocke({ ...base, famille: "epingle", reseaux: ["pinterest"], epingle: epingle() }).famille).toBe("epingle");
    expect(() => lireVisuelStocke({ ...base, famille: "carrousel", reseaux: ["pinterest"] })).toThrow();
    expect(() => lireVisuelStocke({ ...base, famille: "epingle", reseaux: ["pinterest"] })).toThrow();
    expect(() => lireVisuelStocke({ ...base, famille: "epingle", reseaux: ["instagram"], epingle: epingle() })).toThrow();
    expect(() => lireVisuelStocke({ ...base, famille: "epingle", reseaux: ["pinterest"], epingle: epingle({ texteAlternatif: "a".repeat(501) }) })).toThrow();
    expect(() => lireVisuelStocke({ ...base, famille: "epingle", reseaux: ["pinterest"], epingle: epingle({ contenuIA: "oui" }) })).toThrow();
  });
  it("identifiantsProgrammation rend la ligne Pinterest", () => {
    const l = identifiantsProgrammation({ visuelId: "vis_pin", heuresParReseau: { pinterest: DEMAIN }, decalages: 0 } as never);
    expect(l.map((x) => x.reseau)).toEqual(["pinterest"]);
  });
  it("tableauDeLaCible lit le tableau de la cible", () => {
    expect(tableauDeLaCible("compte-pin:pin:111")).toBe("111");
    expect(tableauDeLaCible("compte-pin")).toBeUndefined();
    expect(tableauDeLaCible(undefined)).toBeUndefined();
  });
});
