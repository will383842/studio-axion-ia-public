/**
 * Essai d'un brouillon posé sur un créneau programmé en un clic (compte « rien de choisi ») : l'essai garde la cible RÉELLE
 * (la page LinkedIn unique), jamais le marqueur, sinon la garde du fournisseur refuse l'envoi (« compte n'est pas celui de l'essai »).
 * Dépôts en mémoire, faux fournisseur (aucun appel réseau), ids fictifs.
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
const PROFIL = { id: "compte-1:li:profil", organisationId: "zernio", nom: "Profil", service: "linkedin", genre: "profil" };
const JOUR = 24 * 3600_000;

async function creneau(compteCible: string): Promise<void> {
  const quand = new Date(Math.floor((Date.now() + 2 * JOUR) / 60_000) * 60_000).toISOString();
  await depots().creneauxEditoriaux.enregistrer({
    id: "cA", jourVise: quand.slice(0, 10), heuresParReseau: { linkedin: quand }, compteCible, visuelId: "vis_1",
    textes: { linkedin: { texte: "Texte", premierCommentaire: "" } },
    statut: "programme", decalages: 0, valideeLe: "2026-11-12T10:00:00Z", valideePar: "le fondateur",
  } as never);
}

beforeEach(() => {
  reinitialiserDepots();
  canaux.liste = [PAGE, PROFIL];
});

describe("essai : compte réel résolu à la pose", () => {
  it("créneau « compte-studio » : l'essai garde la page LinkedIn unique, jamais le marqueur ni le profil", async () => {
    await creneau("compte-studio");
    const r = await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures: 4 });
    expect(r.ok).toBe(true);
    expect(await lireEssai(Date.now())).toMatchObject({ creneauId: "cA", compte: PAGE.id, reseau: "linkedin" });
  });

  it("aucune page unique (deux pages) : refus, rien n'est posé", async () => {
    canaux.liste = [PAGE, { ...PAGE, id: "compte-2:li:77", nom: "Page B" }];
    await creneau("compte-studio");
    const r = await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures: 4 });
    expect(r.ok).toBe(false);
    expect((await depots().parametres.obtenir(PARAM_ESSAI_BROUILLON))?.valeur ?? null).toBeNull();
  });

  it("compte déjà choisi : gardé tel quel, sans lire la liste", async () => {
    canaux.liste = [];
    await creneau("compte-1:li:42");
    const r = await actions.poserEssaiZernioAction({ creneauId: "cA", dureeHeures: 4 });
    expect(r.ok).toBe(true);
    expect(await lireEssai(Date.now())).toMatchObject({ compte: "compte-1:li:42" });
  });

  it("créneau « compte-studio » : un essai qui porterait le marqueur lui-même ne se relit pas (fermé)", async () => {
    await creneau("compte-studio");
    const pose = new Date(Date.now() - 60_000).toISOString();
    await depots().parametres.enregistrer({ id: PARAM_ESSAI_BROUILLON, valeur: { version: 1, creneauId: "cA", compte: "compte-studio", reseau: "linkedin", poseLe: pose, expireLe: new Date(Date.now() + 3600_000).toISOString() }, creeLe: pose, modifieLe: pose } as never);
    expect(await lireEssai(Date.now())).toBeNull();
  });
});
