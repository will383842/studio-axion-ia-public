/**
 * Un essai enregistré mais ILLISIBLE (compte = marqueur, forme invalide) et non expiré ne bloque plus la pose :
 * l'écran (lireEssai) n'offre aucun « Retirer », la pose le considère donc comme absent et l'écrase.
 * Un essai lisible et actif, lui, bloque toujours. Dépôts en mémoire, aucun appel réseau, clé fictive.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";

process.env.ZERNIO_API_KEY = "cle-essai-fictive";

const canaux = vi.hoisted(() => ({ liste: [] as unknown[] }));
vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/services/auth", async (orig) => {
  const m = await orig<typeof import("@/services/auth")>();
  return { ...m, exigerSession: async () => ({ id: "s1" }) as never };
});
vi.mock("@/fournisseurs", async (orig) => {
  const m = await orig<typeof import("@/fournisseurs")>();
  return { ...m, fournisseurParId: () => ({ id: "zernio", type: "publication", listerCanaux: async () => canaux.liste }) as never };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { PARAM_ESSAI_BROUILLON, lireEssai } = await import("@/services/essai-zernio");
const actions = await import("@/app/(studio)/reglages/actions-zernio");

const PAGE = { id: "compte-1:li:42", organisationId: "zernio", nom: "Page A", service: "linkedin", genre: "page" };
const JOUR = 24 * 3600_000;

async function creneau(compteCible: string): Promise<void> {
  const quand = new Date(Math.floor((Date.now() + 2 * JOUR) / 60_000) * 60_000).toISOString();
  await depots().creneauxEditoriaux.enregistrer({
    id: "cA", jourVise: quand.slice(0, 10), heuresParReseau: { linkedin: quand }, compteCible, visuelId: "vis_1",
    textes: { linkedin: { texte: "Texte", premierCommentaire: "" } },
    statut: "programme", decalages: 0, valideeLe: "2026-11-12T10:00:00Z", valideePar: "le fondateur",
  } as never);
}

async function poserBrut(valeur: unknown): Promise<void> {
  const t = new Date(Date.now() - 60_000).toISOString();
  await depots().parametres.enregistrer({ id: PARAM_ESSAI_BROUILLON, valeur, creeLe: t, modifieLe: t } as never);
}

const essaiBrut = (compte: string) => ({
  version: 1, creneauId: "cA", compte, reseau: "linkedin",
  poseLe: new Date(Date.now() - 60_000).toISOString(), expireLe: new Date(Date.now() + 3600_000).toISOString(),
});

beforeEach(() => {
  reinitialiserDepots();
  canaux.liste = [PAGE];
});

describe("essai illisible : ne bloque plus la pose", () => {
  it("compte = marqueur, non expiré : illisible pour l'écran, la nouvelle pose l'écrase", async () => {
    await creneau("compte-studio");
    await poserBrut(essaiBrut("compte-studio"));
    expect(await lireEssai(Date.now())).toBeNull();
    const r = await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures: 4 });
    expect(r.ok).toBe(true);
    expect(await lireEssai(Date.now())).toMatchObject({ creneauId: "cA", compte: PAGE.id });
  });

  it("forme invalide, non expiré : écrasé aussi", async () => {
    await creneau("compte-1:li:42");
    await poserBrut({ version: 2, expireLe: new Date(Date.now() + 3600_000).toISOString() });
    const r = await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures: 4 });
    expect(r.ok).toBe(true);
  });

  it("essai lisible et actif : bloque toujours", async () => {
    await creneau("compte-1:li:42");
    await poserBrut(essaiBrut("compte-1:li:42"));
    expect(await lireEssai(Date.now())).not.toBeNull();
    const r = await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures: 4 });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("déjà actif");
  });
});
