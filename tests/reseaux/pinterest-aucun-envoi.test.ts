/**
 * Pinterest, PR 1 : AUCUN envoi. Ces tests passent par les VRAIES portes d'envoi avec `reseau: "pinterest"` et
 * exigent le refus avec ZÉRO appel au fournisseur simulé. Dépôts en mémoire, faux fournisseur, aucun réseau.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { GrilleSemaine } from "@/components/calendrier/GrilleSemaine";
import { VueJour } from "@/components/calendrier/VueJour";
import type { EntreeCarte } from "@/components/calendrier/CarteEntreeCalendrier";
import { lireReseaux } from "@/components/calendrier/lire-reseaux";
import { RESEAUX_CALENDRIER } from "@/components/calendrier/BarreFiltres";
import { creerFauxClientZernio } from "../zernio/aides/faux-zernio";

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
const { construireDepsEnvoiCalendrier } = await import("@/services/branchement-envoi-calendrier");
const { ErreurStudio } = await import("@/services/_commun");

const VALIDEE = "2026-11-12T10:00:00Z";
const DEMAIN = new Date(Date.now() + 26 * 3600_000).toISOString();
const lireUrl = async (cle: string) => `https://exemple.test/${cle}`;

let appels: DemandePublication[] = [];
const faux = (): FournisseurPublication =>
  ({
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [{ id: "compte-pin", organisationId: "zernio", nom: "Compte Pinterest", service: "pinterest" }],
    envoyer: async (d: DemandePublication) => {
      appels.push(d);
      return { idExterne: "ext-1", via: "zernio", statut: "brouillon" };
    },
  }) as unknown as FournisseurPublication;

async function visuelValide(): Promise<void> {
  const le = "2026-11-10T08:00:00Z";
  await depots().visuels.enregistrer({
    id: "vis_1", famille: "carrousel", titre: "Cinq erreurs", entree: { type: "sujet", sujet: "exemple" }, statut: "valide", modeTexte: "api",
    versionSpec: 1, coutCentimes: 0, creeLe: le, modifieLe: le,
    rendu: { empreinte: "e1", pdfCle: "visuels/vis_1/c.pdf", vignetteCle: "visuels/vis_1/v.png", pages: [1, 2].map((i) => ({ index: i, x1Cle: `visuels/vis_1/p${i}.png`, x2Cle: `visuels/vis_1/p${i}@2x.png` })), renduLe: le },
  } as never);
}
async function creneauPinterest(id = "cr-pin"): Promise<string> {
  await depots().creneauxEditoriaux.enregistrer({
    id, jourVise: DEMAIN.slice(0, 10), heuresParReseau: { pinterest: DEMAIN }, compteCible: "compte-pin", visuelId: "vis_1",
    textes: { pinterest: { texte: "Légende d'exemple", premierCommentaire: "" } },
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
  vi.stubGlobal("fetch", () => Promise.reject(new Error("aucun appel réel dans ce test")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  reinitialiserDepots();
  await ouvrirTout();
  await visuelValide();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Pinterest : les portes d'envoi refusent, sans aucun appel au fournisseur", () => {
  it("envoyerVisuel (porte de `envoyerVisuelValide`) : « Ce réseau ne reçoit pas de visuel », zéro appel, rien d'écrit", async () => {
    const id = await creneauPinterest();
    const avant = await depots().publications.compter();
    await expect(pub.envoyerVisuel(faux(), id, "pinterest" as never, { lireUrl })).rejects.toMatchObject({ code: "RESEAU", message: expect.stringContaining("Ce réseau ne reçoit pas de visuel") });
    expect(appels).toHaveLength(0);
    expect(await depots().publications.compter()).toBe(avant);
  });

  it("le branchement d'envoi du calendrier (`RESEAUX_VISUELS`) refuse Pinterest : zéro appel au fournisseur", async () => {
    const id = await creneauPinterest();
    const service = vi.fn(() => faux());
    const deps = construireDepsEnvoiCalendrier({ service, lireUrl, porte: async () => true, client: creerFauxClientZernio().client });
    const demande = { videoId: "vis_1", creneauId: id, reseau: "pinterest", nature: "visuel", versionCreneau: 0, jour: DEMAIN.slice(0, 10), heure: "10:00" };
    await expect(deps.envoyerReel!("zernio", demande as never)).rejects.toBeInstanceOf(ErreurStudio);
    await expect(deps.envoyerReel!("zernio", demande as never)).rejects.toMatchObject({ code: "RESEAU" });
    expect(service).not.toHaveBeenCalled();
    expect(appels).toHaveLength(0);
  });

  it("le tour du branchement ne propose aucune ligne Pinterest à envoyer", async () => {
    await creneauPinterest();
    const deps = construireDepsEnvoiCalendrier({ service: () => faux(), lireUrl, porte: async () => true, client: creerFauxClientZernio().client });
    const lignes = await deps.creneaux();
    expect(lignes.filter((l) => (l.reseau as string) === "pinterest")).toEqual([]);
    expect(appels).toHaveLength(0);
  });
});

describe("Pinterest : le calendrier l'affiche sans lever", () => {
  const entree = (p: Partial<EntreeCarte> = {}): EntreeCarte => ({ cle: "publication:pin1", jour: "2026-11-11", reseau: "pinterest", type: "video", etat: "programme", heure: "09:00", titre: "Une épingle d'exemple", ...p });

  it("GrilleSemaine rend une carte data-reseau=\"pinterest\"", () => {
    const html = renderToStaticMarkup(createElement(GrilleSemaine, { semaineDu: "2026-11-11", aujourdhui: "2026-11-11", entrees: [entree()] }));
    expect(html).toContain('data-reseau="pinterest"');
    expect(html).toContain("Pinterest");
  });
  it("VueJour rend une carte data-reseau=\"pinterest\"", () => {
    const html = renderToStaticMarkup(createElement(VueJour, { jour: "2026-11-11", aujourdhui: "2026-11-11", entrees: [entree()] }));
    expect(html).toContain('data-reseau="pinterest"');
  });
  it("listerCalendrier ne lève pas avec une publication Pinterest et la rend", async () => {
    await depots().publications.enregistrer({ id: "pub_pin", visuelId: "vis_1", reseau: "pinterest", statut: "brouillon", via: "zernio", date: DEMAIN, texte: "t", creeLe: DEMAIN, modifieLe: DEMAIN } as never);
    const debut = new Date(Date.now() - 864e5).toISOString();
    const fin = new Date(Date.now() + 3 * 864e5).toISOString();
    const jours = await pub.listerCalendrier(debut, fin);
    expect(jours.flatMap((j) => j.publications).map((p) => p.reseau)).toContain("pinterest");
    expect(appels).toHaveLength(0);
  });
});

describe("Pinterest : ancien lien du calendrier", () => {
  it("?reseaux= avec les 4 anciens réseaux = tous", () => {
    expect(lireReseaux("linkedin,instagram,facebook,tiktok")).toEqual([...RESEAUX_CALENDRIER]);
    expect(lireReseaux(["linkedin,instagram", "facebook,tiktok"])).toEqual([...RESEAUX_CALENDRIER]);
  });
  it("absent : tous ; un sous-ensemble ou vide reste tel quel", () => {
    expect(lireReseaux(undefined)).toEqual([...RESEAUX_CALENDRIER]);
    expect(lireReseaux("linkedin,tiktok")).toEqual(["linkedin", "tiktok"]);
    expect(lireReseaux("")).toEqual([]);
    expect(lireReseaux("pinterest")).toEqual(["pinterest"]);
  });
});
