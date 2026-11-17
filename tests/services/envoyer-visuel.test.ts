/**
 * L5-02 · envoi d'un visuel (carrousel, infographie) depuis le créneau. Faux fournisseur, dépôts en mémoire, faux stockage :
 * aucun appel réel, aucun envoi réel. Données fictives. Interrupteur éditorial (L7-08) ÉTEINT par défaut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";

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
const pub = await import("@/services/publications");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
const { REGLAGE_ENVOI_CALENDRIER } = await import("@/domaine/outil-publication");

const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const CIBLE = "compte-1:li:42";
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;

let appels: DemandePublication[] = [];
let comportement: (d: DemandePublication) => Promise<{ idExterne: string; via: "zernio"; statut: "brouillon" }>;
const faux = (): FournisseurPublication =>
  ({
    id: "zernio",
    type: "publication",
    nom: "faux",
    reelPrevu: "faux",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    envoyer: async (d: DemandePublication) => {
      appels.push(d);
      return comportement(d);
    },
  }) as unknown as FournisseurPublication;

async function ouvrirTout(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
}

async function creerVisuel(p: Record<string, unknown> = {}): Promise<string> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_1",
    famille: "carrousel",
    titre: "Cinq erreurs courantes",
    entree: { type: "sujet", sujet: "exemple" },
    statut: "valide",
    modeTexte: "simulation",
    versionSpec: 1,
    coutCentimes: 0,
    creeLe: le,
    modifieLe: le,
    rendu: {
      empreinte: "e1",
      pdfCle: "visuels/vis_1/carrousel.pdf",
      vignetteCle: "visuels/vis_1/v.png",
      pages: [1, 2, 3].map((i) => ({ index: i, x1Cle: `visuels/vis_1/p${i}.png`, x2Cle: `visuels/vis_1/p${i}@2x.png` })),
      renduLe: le,
    },
    ...p,
  } as never);
  return "vis_1";
}

const options = (o: Record<string, unknown> = {}) => ({ cible: CIBLE, legende: "Légende d'exemple", lireUrl, ...o });

beforeEach(async () => {
  appels = [];
  comportement = async () => ({ idExterne: "ext-1", via: "zernio", statut: "brouillon" });
  vi.stubGlobal("fetch", () => Promise.reject(new Error("aucun appel réel dans ce test")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  reinitialiserDepots();
  reinitialiserRequete();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("L5-02 · envoyerVisuel : interrupteur éteint par défaut", () => {
  it("le nom du réglage lu est celui de L7-08", () => {
    expect(PARAM_EDITORIALE_ACTIVE).toBe("publication.editoriale_active");
    expect(REGLAGE_ENVOI_CALENDRIER).toBe(PARAM_EDITORIALE_ACTIVE);
  });

  it("rien n'est réglé (défaut) : refus, 0 appel, 0 publication écrite", async () => {
    const id = await creerVisuel();
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
    expect(await depots().publications.compter()).toBe(0);
  });

  it.each([
    ["éditorial éteint", { [PARAM_EDITORIALE_ACTIVE]: false }],
    ["calendrier éteint", { [PARAM_ENVOI_CALENDRIER]: false }],
    ["« Tout arrêter » actif", { [PARAM_ARRET_ZERNIO]: false }],
  ])("%s, les autres ouverts : refus, 0 appel", async (_n, reglage) => {
    const id = await creerVisuel();
    await ouvrirTout();
    for (const [k, v] of Object.entries(reglage)) await ecrireParametre(k, v);
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
    expect(await depots().publications.compter()).toBe(0);
  });

  it("l'ancien réglage d'envoi seul ouvert ne suffit pas", async () => {
    const id = await creerVisuel();
    await ecrireParametre(PARAM_ARRET_ZERNIO, true);
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_CALENDRIER_FERME" });
    expect(appels).toHaveLength(0);
  });
});

describe("L5-02 · envoyerVisuel : contenu envoyé", () => {
  beforeEach(ouvrirTout);

  it("carrousel LinkedIn = 1 document PDF avec titre, aucune image, brouillon", async () => {
    const id = await creerVisuel();
    const r = await pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options({ premierCommentaire: "Voir le guide" }));
    expect(r.deja).toBe(false);
    expect(appels).toHaveLength(1);
    expect(appels[0].document).toEqual({ url: "https://exemple.test/visuels/vis_1/carrousel.pdf", titre: "Cinq erreurs courantes" });
    expect(appels[0].images).toBeUndefined();
    expect(appels[0].mode).toBe("brouillon");
    expect(appels[0].cible).toBe(CIBLE);
    expect(r.publication).toMatchObject({ visuelId: "vis_1", reseau: "linkedin", via: "zernio", etatEnvoi: "envoye", statut: "brouillon" });
    expect(r.publication.videoId).toBeUndefined();
  });

  it("Instagram : les images dans l'ordre, chacune avec son texte alternatif de 125 signes au plus", async () => {
    const id = await creerVisuel();
    await pub.envoyerVisuel(faux(), id, "instagram", DEMAIN, options({ cible: "compte-2", textesAlternatifs: ["Page un", "Page deux", "Page trois"] }));
    expect(appels[0].images?.map((i) => i.url)).toEqual([1, 2, 3].map((i) => `https://exemple.test/visuels/vis_1/p${i}.png`));
    expect(appels[0].images?.map((i) => i.texteAlternatif)).toEqual(["Page un", "Page deux", "Page trois"]);
    expect(appels[0].document).toBeUndefined();
  });

  it("Instagram sans texte alternatif : refus avant tout appel", async () => {
    const id = await creerVisuel();
    await expect(pub.envoyerVisuel(faux(), id, "instagram", DEMAIN, options({ cible: "compte-2" }))).rejects.toBeTruthy();
    expect(appels).toHaveLength(0);
    expect(await depots().publications.compter()).toBe(0);
  });

  it.each([
    ["non validé", { statut: "brouillon" }],
    ["à la corbeille", { corbeilleLe: "2026-11-11T08:00:00Z" }],
    ["d'exemple", { estDemo: true }],
    ["sans rendu", { rendu: undefined }],
  ])("visuel %s : refus, 0 appel", async (_n, p) => {
    const id = await creerVisuel(p);
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options())).rejects.toBeTruthy();
    expect(appels).toHaveLength(0);
  });

  it("date passée : refus, 0 appel", async () => {
    const id = await creerVisuel();
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", "2020-01-01T10:00:00Z", options())).rejects.toMatchObject({ code: "DATE_PASSEE" });
    expect(appels).toHaveLength(0);
  });

  it("jamais de réponse automatique : aucun champ de réponse dans la demande LinkedIn", async () => {
    const id = await creerVisuel();
    await pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options());
    expect(JSON.stringify(appels[0])).not.toMatch(/autoReply|reponseAuto|replyTo/i);
  });
});

describe("L5-02 · envoyerVisuel : anti-double envoi", () => {
  beforeEach(ouvrirTout);

  it("deux passages successifs = un seul envoi, la même publication rendue", async () => {
    const id = await creerVisuel();
    const a = await pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options());
    const b = await pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options());
    expect(appels).toHaveLength(1);
    expect(b.deja).toBe(true);
    expect(b.publication.id).toBe(a.publication.id);
    expect(await depots().publications.compter()).toBe(1);
  });

  it("deux appels en même temps = un seul envoi", async () => {
    const id = await creerVisuel();
    const [a, b] = await Promise.allSettled([
      pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options()),
      pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options()),
    ]);
    expect(appels).toHaveLength(1);
    expect([a.status, b.status].filter((s) => s === "fulfilled").length).toBeGreaterThanOrEqual(1);
    expect(await depots().publications.compter()).toBe(1);
  });

  it("envoi en cours (processus mort entre la réservation et la réponse) : ne repart pas", async () => {
    const id = await creerVisuel();
    let liberer!: () => void;
    comportement = () => new Promise((res) => { liberer = () => res({ idExterne: "ext-1", via: "zernio", statut: "brouillon" }); });
    const premier = pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options());
    await vi.waitFor(() => expect(appels).toHaveLength(1));
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_EN_COURS" });
    expect(appels).toHaveLength(1);
    liberer();
    await premier;
  });

  it("réponse perdue : « à vérifier », aucun renvoi automatique aux passages suivants", async () => {
    const id = await creerVisuel();
    comportement = async () => { throw new ErreurZernio("indisponible", "délai dépassé", { reessayable: true }); };
    const r = await pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options()).catch((e) => e);
    expect(r).toBeDefined();
    const pubs = await depots().publications.lister();
    expect(pubs).toHaveLength(1);
    expect(pubs[0].etatEnvoi).toBe("a-verifier");
    comportement = async () => ({ idExterne: "ext-2", via: "zernio", statut: "brouillon" });
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options())).rejects.toMatchObject({ code: "ENVOI_A_VERIFIER" });
    expect(appels).toHaveLength(1);
  });

  it("reprise après échec partiel : un refus net permet UN nouvel essai, puis plus rien ne repart", async () => {
    const id = await creerVisuel();
    comportement = async () => { throw new ErreurZernio("refuse", "refusé avant le réseau", { avantReseau: true }); };
    await expect(pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options())).rejects.toBeTruthy();
    expect((await depots().publications.lister()).map((p) => p.etatEnvoi)).toEqual(["refuse"]);
    comportement = async () => ({ idExterne: "ext-2", via: "zernio", statut: "brouillon" });
    const ok = await pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options());
    expect(ok.publication.etatEnvoi).toBe("envoye");
    const encore = await pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options());
    expect(encore.deja).toBe(true);
    expect(appels).toHaveLength(2);
  });

  it("un autre réseau du même visuel est un autre envoi (pas un doublon)", async () => {
    const id = await creerVisuel();
    await pub.envoyerVisuel(faux(), id, "linkedin", DEMAIN, options());
    await pub.envoyerVisuel(faux(), id, "instagram", DEMAIN, options({ cible: "compte-2", textesAlternatifs: ["a", "b", "c"] }));
    expect(appels).toHaveLength(2);
  });
});
