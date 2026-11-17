/**
 * L5-21 · couche fine « envoi des visuels depuis le créneau » : prépare les fichiers par réseau (LinkedIn = 1 PDF ;
 * Instagram et Facebook = N images avec texte alternatif) puis APPELLE `envoyerVisuel` (L5-02). Faux fournisseur, dépôts
 * en mémoire, faux stockage : aucun appel réel, aucun envoi réel. Données fictives. Interrupteur éditorial ÉTEINT par défaut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";

process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
const { envoyerVisuelDuCreneau, envoyerVisuelDuCreneauSurReseaux } = await import("@/services/envoi-visuel-creneau");

const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const VALIDEE = "2026-11-12T10:00:00Z";
const COMPTES = { linkedin: "compte-1:li:42", instagram: "compte-2", facebook: "compte-1:fb:page-1" } as const;
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;

let appels: DemandePublication[] = [];
const faux = (): FournisseurPublication =>
  ({
    id: "zernio",
    type: "publication",
    nom: "faux",
    reelPrevu: "faux",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [
      { id: "compte-1:li:42", organisationId: "zernio", nom: "Page LinkedIn", service: "linkedin", genre: "page" },
      { id: "compte-2", organisationId: "zernio", nom: "Compte Instagram", service: "instagram" },
      { id: "compte-1:fb:page-1", organisationId: "zernio", nom: "Page Facebook", service: "facebook", genre: "page" },
    ],
    envoyer: async (d: DemandePublication) => {
      appels.push(d);
      return { idExterne: `ext-${appels.length}`, via: "zernio", statut: "brouillon" };
    },
  }) as unknown as FournisseurPublication;

async function ouvrirTout(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
}

async function creerVisuel(p: Record<string, unknown> = {}): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_1", famille: "carrousel", titre: "Cinq erreurs courantes", entree: { type: "sujet", sujet: "exemple" }, statut: "valide",
    modeTexte: "api", versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le,
    rendu: {
      empreinte: "e1", pdfCle: "visuels/vis_1/carrousel.pdf", vignetteCle: "visuels/vis_1/v.png",
      pages: [1, 2, 3].map((i) => ({ index: i, x1Cle: `visuels/vis_1/p${i}.png`, x2Cle: `visuels/vis_1/p${i}@2x.png` })), renduLe: le,
    },
    ...p,
  } as never);
}

async function creerCreneau(reseaux: Array<"linkedin" | "instagram" | "facebook"> = ["linkedin"], p: Record<string, unknown> = {}): Promise<string> {
  await depots().creneauxEditoriaux.enregistrer({
    id: "cr-1", jourVise: DEMAIN.slice(0, 10), heuresParReseau: Object.fromEntries(reseaux.map((r) => [r, DEMAIN])), compteCible: COMPTES[reseaux[0]], visuelId: "vis_1",
    textes: Object.fromEntries(reseaux.map((r) => [r, { texte: `Texte ${r}`, premierCommentaire: "" }])),
    statut: "valide", decalages: 0, valideeLe: VALIDEE, valideePar: "le fondateur", ...p,
  } as never);
  return "cr-1";
}

const total = async () => depots().publications.compter();

beforeEach(() => {
  appels = [];
  vi.stubGlobal("fetch", () => Promise.reject(new Error("aucun appel réel dans ce test")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  reinitialiserDepots();
  reinitialiserRequete();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("L5-21 · porte fermée = zéro appel", () => {
  it("rien n'est réglé (défaut) : envoyerVisuel n'est PAS appelé, aucune lecture de fichier, aucun appel au diffuseur", async () => {
    await creerVisuel();
    const id = await creerCreneau();
    const envoyer = vi.fn();
    const lire = vi.fn(lireUrl);
    const avant = await total();
    await expect(envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl: lire, envoyer: envoyer as never })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(lire).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it.each([
    ["éditorial éteint", PARAM_EDITORIALE_ACTIVE],
    ["calendrier éteint", PARAM_ENVOI_CALENDRIER],
    ["« Tout arrêter » actif", PARAM_ARRET_ZERNIO],
  ])("%s, les autres ouverts : zéro appel", async (_n, cle) => {
    await creerVisuel();
    const id = await creerCreneau();
    await ouvrirTout();
    await ecrireParametre(cle, false);
    const envoyer = vi.fn();
    await expect(envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl, envoyer: envoyer as never })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it("plusieurs réseaux, porte fermée : zéro appel pour chacun", async () => {
    await creerVisuel();
    const id = await creerCreneau(["linkedin", "instagram", "facebook"]);
    const envoyer = vi.fn();
    await expect(envoyerVisuelDuCreneauSurReseaux(faux(), id, { lireUrl, envoyer: envoyer as never, textesAlternatifs: ["a", "b", "c"] })).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });
});

describe("L5-21 · fichiers préparés par réseau, puis envoyerVisuel (aucun second chemin d'envoi)", () => {
  beforeEach(ouvrirTout);

  it("LinkedIn : 1 PDF avec titre, aucune image ; passe par envoyerVisuel avec le créneau", async () => {
    await creerVisuel();
    const id = await creerCreneau();
    const envoyer = vi.fn(async (...a: unknown[]) => (await import("@/services/publications")).envoyerVisuel(...(a as Parameters<typeof import("@/services/publications").envoyerVisuel>)));
    const r = await envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl, envoyer: envoyer as never });
    expect(envoyer).toHaveBeenCalledTimes(1);
    expect(envoyer.mock.calls[0][1]).toBe(id);
    expect(envoyer.mock.calls[0][2]).toBe("linkedin");
    expect(appels).toHaveLength(1);
    expect(appels[0].document).toEqual({ url: "https://exemple.test/visuels/vis_1/carrousel.pdf", titre: "Cinq erreurs courantes" });
    expect(appels[0].images).toBeUndefined();
    expect(appels[0].mode).toBe("brouillon");
    expect(r.deja).toBe(false);
  });

  it("Instagram : N images dans l'ordre, chacune avec son texte alternatif", async () => {
    await creerVisuel();
    const id = await creerCreneau(["instagram"]);
    await envoyerVisuelDuCreneau(faux(), id, "instagram", { lireUrl, textesAlternatifs: ["Page un", "Page deux", "Page trois"] });
    expect(appels[0].images?.map((i) => i.url)).toEqual([1, 2, 3].map((i) => `https://exemple.test/visuels/vis_1/p${i}.png`));
    expect(appels[0].images?.map((i) => i.texteAlternatif)).toEqual(["Page un", "Page deux", "Page trois"]);
    expect(appels[0].document).toBeUndefined();
  });

  it("Instagram : texte alternatif manquant ou vide pour une page = zéro appel", async () => {
    await creerVisuel();
    const id = await creerCreneau(["instagram"]);
    const envoyer = vi.fn();
    for (const alts of [undefined, ["a", "b"], ["a", "", "c"]]) {
      await expect(envoyerVisuelDuCreneau(faux(), id, "instagram", { lireUrl, textesAlternatifs: alts, envoyer: envoyer as never })).rejects.toMatchObject({ code: "TEXTE_ALTERNATIF_MANQUANT" });
    }
    expect(envoyer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it("trois réseaux : chacun reçoit ses fichiers (PDF / images), un résultat par réseau", async () => {
    await creerVisuel();
    const id = await creerCreneau(["linkedin", "instagram", "facebook"]);
    const res = await envoyerVisuelDuCreneauSurReseaux(faux(), id, { lireUrl, textesAlternatifs: ["a", "b", "c"] });
    expect(res.map((r) => [r.reseau, r.ok])).toEqual([["linkedin", true], ["instagram", true], ["facebook", true]]);
    expect(appels).toHaveLength(3);
    expect(appels.filter((a) => a.document)).toHaveLength(1);
    expect(appels.filter((a) => a.images?.length === 3)).toHaveLength(2);
  });
});

describe("L5-21 · fichier absent ou illisible = zéro appel", () => {
  beforeEach(ouvrirTout);

  it.each([
    ["PDF sans clé", { rendu: { empreinte: "e", pdfCle: "", vignetteCle: "v", pages: [{ index: 1, x1Cle: "visuels/vis_1/p1.png", x2Cle: "x" }], renduLe: "2026-11-10T08:00:00Z" } }],
  ])("LinkedIn, %s : zéro appel", async (_n, p) => {
    await creerVisuel(p);
    const id = await creerCreneau();
    const envoyer = vi.fn();
    await expect(envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl, envoyer: envoyer as never })).rejects.toMatchObject({ code: "FICHIER_ABSENT" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it("fichier absent du stockage (existence connue fausse) : zéro appel, rien d'écrit", async () => {
    await creerVisuel();
    const id = await creerCreneau();
    const avant = await total();
    await expect(envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl, fichierExiste: async () => false })).rejects.toMatchObject({ code: "FICHIER_ABSENT" });
    expect(appels).toHaveLength(0);
    expect(await total()).toBe(avant);
  });

  it("une seule page absente sur Instagram : zéro appel", async () => {
    await creerVisuel();
    const id = await creerCreneau(["instagram"]);
    const envoyer = vi.fn();
    await expect(envoyerVisuelDuCreneau(faux(), id, "instagram", { lireUrl, fichierExiste: async (c) => !c.endsWith("p2.png"), textesAlternatifs: ["a", "b", "c"], envoyer: envoyer as never })).rejects.toMatchObject({ code: "FICHIER_ABSENT" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it.each([
    ["lecture qui échoue", async () => { throw new Error("illisible"); }],
    ["adresse vide", async () => ""],
    ["adresse non sécurisée", async (c: string) => `http://exemple.test/${c}`],
  ])("adresse illisible (%s) : zéro appel", async (_n, lire) => {
    await creerVisuel();
    const id = await creerCreneau();
    const envoyer = vi.fn();
    await expect(envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl: lire, envoyer: envoyer as never })).rejects.toMatchObject({ code: "FICHIER_ABSENT" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it("créneau sans visuel, ou visuel sans rendu : zéro appel", async () => {
    await creerVisuel({ rendu: undefined });
    const id = await creerCreneau();
    const envoyer = vi.fn();
    await expect(envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl, envoyer: envoyer as never })).rejects.toMatchObject({ code: "FICHIER_ABSENT" });
    await expect(envoyerVisuelDuCreneau(faux(), "inconnu", "linkedin", { lireUrl, envoyer: envoyer as never })).rejects.toMatchObject({ code: "CRENEAU_NON_VALIDE" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });
});

describe("L5-21 · garde-fous conservés", () => {
  beforeEach(ouvrirTout);

  it("créneau non validé : refus, zéro appel", async () => {
    await creerVisuel();
    const id = await creerCreneau(["linkedin"], { statut: "propose", valideeLe: undefined });
    const envoyer = vi.fn();
    await expect(envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl, envoyer: envoyer as never })).rejects.toMatchObject({ code: "CRENEAU_NON_VALIDE" });
    expect(envoyer).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it("deuxième envoi identique : la même publication, aucun nouvel appel (anti-double envoi de L5-02)", async () => {
    await creerVisuel();
    const id = await creerCreneau();
    const a = await envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl });
    const b = await envoyerVisuelDuCreneau(faux(), id, "linkedin", { lireUrl });
    expect(b.deja).toBe(true);
    expect(b.publication.id).toBe(a.publication.id);
    expect(appels).toHaveLength(1);
  });

  it("réseau non visuel : refus, zéro appel", async () => {
    await creerVisuel();
    const id = await creerCreneau();
    await expect(envoyerVisuelDuCreneau(faux(), id, "tiktok" as never, { lireUrl })).rejects.toMatchObject({ code: "RESEAU" });
    expect(appels).toHaveLength(0);
  });
});
