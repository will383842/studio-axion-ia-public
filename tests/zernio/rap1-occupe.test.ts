/**
 * RAP-1 · VERROU de non-régression (vert sur master aussi) : une publication rapatriée n'a pas de média, donc elle n'occupe jamais
 * un créneau du tour d'envoi (l'exclusion « occupe » cherche les occupants par média). Contre-épreuve : la même ligne AVEC le visuel exclut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { creerFauxClientZernio } from "./aides/faux-zernio";

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
const { tourEnvoisCalendrierServeur, reinitialiserTourEnvoisCalendrier } = await import("@/services/branchement-envoi-calendrier");

const MIN = 60_000;
const JOUR = 24 * 60 * MIN;
const DEBUT = Math.floor(Date.now() / MIN) * MIN;
const heureDu = (j: number): string => new Date(Math.floor((DEBUT + j * JOUR) / MIN) * MIN).toISOString().replace(/\.\d{3}Z$/, "Z");
const LE = "2026-11-12T10:00:00Z";
const COMPTE = "compte-2";
let appels: DemandePublication[];
let notifications: unknown[];

const fournisseur = (): FournisseurPublication =>
  ({
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [{ id: COMPTE, organisationId: "zernio", nom: "Compte Instagram", service: "instagram" }],
    envoyer: async (d: DemandePublication) => { appels.push(d); return { idExterne: `ext-${appels.length}`, via: "zernio", statut: "brouillon" }; },
  }) as unknown as FournisseurPublication;

async function preparer(): Promise<void> {
  await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
  await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
  await ecrireParametre(PARAM_ARRET_ZERNIO, true);
  await depots().visuels.enregistrer({
    id: "vis_1", famille: "carrousel", titre: "Cinq erreurs", entree: { type: "sujet", sujet: "exemple" }, statut: "valide", modeTexte: "api", versionSpec: 1, coutCentimes: 0,
    creeLe: LE, modifieLe: LE, spec: { alt: "Cinq erreurs courantes" },
    rendu: { empreinte: "e1", pdfCle: "visuels/vis_1/c.pdf", vignetteCle: "visuels/vis_1/v.png", pages: [1, 2, 3].map((i) => ({ index: i, x1Cle: `visuels/vis_1/p${i}.png`, x2Cle: `visuels/vis_1/p${i}@2x.png` })), renduLe: LE },
  } as never);
  await depots().creneauxEditoriaux.enregistrer({
    id: "c1", jourVise: heureDu(2).slice(0, 10), heuresParReseau: { instagram: heureDu(2) }, compteCible: COMPTE, visuelId: "vis_1",
    textes: { instagram: { texte: "Texte instagram", premierCommentaire: "" } }, statut: "valide", decalages: 0, valideeLe: LE, valideePar: "le fondateur",
  } as never);
}

const voisine = (p: Record<string, unknown>) =>
  depots().publications.enregistrer({ id: "pub-x", reseau: "instagram", via: "zernio", statut: "programmee", etatEnvoi: "envoye", date: heureDu(2), texte: "t", canalId: COMPTE, creeLe: LE, modifieLe: LE, ...p } as never);

async function tour() {
  const { client, horloge } = creerFauxClientZernio((a) => (a.url.endsWith("/v1/posts") && a.methode === "GET" ? { statut: 200, corps: { posts: [] } } : { statut: 404, corps: {} }));
  horloge.avancer(DEBUT - horloge.maintenant());
  const lancer = (n: number) => tourEnvoisCalendrierServeur({ service: () => fournisseur(), client, maintenant: () => DEBUT + n * 6 * MIN, lireUrl: async (c: string) => `https://exemple.test/${c}`, fichierExiste: async () => true, notifier: async (x: unknown) => { notifications.push(x); } } as never);
  for (let i = 0; i < 2; i++) await lancer(i);
}

beforeEach(() => {
  appels = [];
  notifications = [];
  reinitialiserDepots();
  reinitialiserRequete();
  reinitialiserTourEnvoisCalendrier();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("appel réseau réel interdit")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("RAP-1 · verrou « occupe » (point E)", () => {
  it("contre-épreuve : la même ligne AVEC le visuel du créneau l'exclut (aucun envoi, une notification)", async () => {
    await preparer();
    await voisine({ visuelId: "vis_1", cleEnvoi: "f".repeat(64) });
    await tour();
    expect(appels).toHaveLength(0);
    expect(notifications).toHaveLength(1);
  });

  it("une rapatriée du même compte, même réseau, même jour n'exclut pas le créneau", async () => {
    await preparer();
    await voisine({ rapatrieeLe: LE, origineDiffuseur: "import-buffer", idExterne: "p1", cleEnvoi: "imp-1" });
    await tour();
    expect(notifications).toHaveLength(0);
  });
});
