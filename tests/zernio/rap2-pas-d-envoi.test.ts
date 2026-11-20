/**
 * RAP-2 · une publication rapatriée n'entre JAMAIS dans le chemin d'envoi du calendrier : même avec les trois réglages ouverts,
 * le tour d'envoi ne la voit pas (il part des créneaux) et rien n'est envoyé au diffuseur.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { DemandePublication, FournisseurPublication } from "@/fournisseurs/types";
import { creerFauxClientZernio } from "./aides/faux-zernio";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { PARAM_EDITORIALE_ACTIVE, PARAM_ENVOI_CALENDRIER, PARAM_ARRET_ZERNIO } = await import("@/services/zernio");
const { tourEnvoisCalendrierServeur, reinitialiserTourEnvoisCalendrier } = await import("@/services/branchement-envoi-calendrier");

const MIN = 60_000;
const DEBUT = Math.floor(Date.now() / MIN) * MIN;
const LE = "2026-11-12T10:00:00Z";
let appels: DemandePublication[];

const fournisseur = (): FournisseurPublication =>
  ({
    id: "zernio", type: "publication", nom: "faux", reelPrevu: "faux", mode: "reel", capacites: { asynchrone: false, accordExige: false },
    listerCanaux: async () => [],
    envoyer: async (d: DemandePublication) => { appels.push(d); return { idExterne: "ext", via: "zernio", statut: "brouillon" }; },
  }) as unknown as FournisseurPublication;

beforeEach(() => {
  appels = [];
  reinitialiserDepots();
  reinitialiserRequete();
  reinitialiserTourEnvoisCalendrier();
  vi.stubGlobal("fetch", () => Promise.reject(new Error("appel réseau réel interdit")));
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("RAP-2 · pas de doublon publié", () => {
  it("portes ouvertes, rapatriées présentes (programmée, brouillon, retirée) : le tour n'envoie rien et ne touche pas le diffuseur", async () => {
    await ecrireParametre(PARAM_EDITORIALE_ACTIVE, true);
    await ecrireParametre(PARAM_ENVOI_CALENDRIER, true);
    await ecrireParametre(PARAM_ARRET_ZERNIO, true);
    for (const [id, statut, extra] of [["zr_a_c", "programmee", {}], ["zr_b_c", "brouillon", {}], ["zr_c_c", "programmee", { retireeLe: LE }]] as const) {
      await depots().publications.enregistrer({ id, reseau: "instagram", via: "zernio", statut, etatEnvoi: "envoye", date: new Date(DEBUT + 2 * 3600_000).toISOString(), texte: "t", canalId: "c", idExterne: id.slice(0, 4), rapatrieeLe: LE, origineDiffuseur: "import-buffer", creeLe: LE, modifieLe: LE, ...extra } as never);
    }
    const { client, faux } = creerFauxClientZernio((a) => (a.url.endsWith("/v1/posts") && a.methode === "GET" ? { statut: 200, corps: { posts: [] } } : { statut: 404, corps: {} }));
    for (let i = 0; i < 3; i++) {
      await tourEnvoisCalendrierServeur({ service: () => fournisseur(), client, maintenant: () => DEBUT + i * 6 * MIN, lireUrl: async (c: string) => `https://exemple.test/${c}`, fichierExiste: async () => true, notifier: async () => undefined } as never);
    }
    expect(appels).toHaveLength(0);
    expect(faux.appels.filter((a: { methode: string }) => a.methode !== "GET")).toHaveLength(0);
    expect(await depots().envoisPlanifies.compter()).toBe(0);
    // Aucun appel au diffuseur ne vise l'identifiant externe d'une rapatriée (ni dans l'adresse, ni dans le corps).
    for (const a of faux.appels as { url: string; corps?: string }[]) for (const idExt of ["zr_a", "zr_b", "zr_c"]) expect(`${a.url} ${a.corps ?? ""}`).not.toContain(idExt);
  });
});
