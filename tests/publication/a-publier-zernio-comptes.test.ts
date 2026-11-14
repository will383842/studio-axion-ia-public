/**
 * L7-06, point 4.1 : sans Buffer relié, la liste « comptes à cocher » de « À publier » contient les comptes Zernio
 * (Facebook et réseaux à plusieurs comptes). Aucun réseau : les comptes viennent de la base, lus au dernier « Tester ».
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { exemplesCommeVraies } from "../helpers/videos-reelles";
import { preparerMotDePasse } from "../helpers/g1a";
import type { CanalPublication } from "@/fournisseurs/types";

delete process.env.BUFFER_API_KEY;
process.env.FOURNISSEUR_PUBLICATION = "simulation";
vi.hoisted(() => { process.env.ZERNIO_API_KEY = "cle-factice-essai"; });
process.env.R2_ACCOUNT_ID = "compte-essai";
process.env.R2_ACCESS_KEY_ID = "ACCES-ESSAI";
process.env.R2_SECRET_ACCESS_KEY = "secret-essai";
process.env.R2_BUCKET = "seau-essai";
process.env.FOURNISSEUR_STOCKAGE = "r2";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const apub = await import("@/services/a-publier");
const { ecrireParametre } = await import("@/services/_commun");
const { PARAM_CANAUX_ZERNIO, comptesACocherZernio, enregistrerCanauxZernio, canauxZernioEnregistres } = await import("@/services/comptes-envoi-zernio");
const { injecterClientZernio } = await import("@/services/zernio");
const { creerFauxClientZernio } = await import("../zernio/aides/faux-zernio");

const MDP = "essai-comptes-zernio";
const canal = (id: string, nom: string, service: string, genre?: string): CanalPublication => ({ id, organisationId: "zernio", nom, service, deconnecte: false, ...(genre ? { genre } : {}) });
const CANAUX = [
  canal("exemple-ig-1", "Compte exemple A", "instagram"),
  canal("exemple-ig-2", "Compte exemple B", "instagram"),
  canal("exemple-fb-1:fb:p1", "Page exemple 1", "facebook", "page"),
  canal("exemple-fb-1:fb:p2", "Page exemple 2", "facebook", "page"),
  canal("exemple-li-1", "Compte exemple LinkedIn", "linkedin"),
];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  vi.unstubAllGlobals();
  reinitialiserDepots();
  await exemplesCommeVraies(depots(), { plusExemples: true });
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await ecrireParametre("reseaux.parDefaut", ["linkedin", "instagram", "facebook"]);
  injecterClientZernio(creerFauxClientZernio().client);
  for (const v of await depots().videos.lister(() => true)) await depots().videos.modifier(v.id, { etapeEditoriale: "validee" });
});

/** Première ligne de ce réseau (toutes les vidéos d'exemple validées). */
const ligne = async (reseau: string) => (await apub.vueAPublier()).lignes.find((l) => l.reseau === reseau);

describe("L7-06 · comptes à cocher Zernio sans Buffer relié", () => {
  it("sans Buffer relié, Facebook et Instagram (deux comptes) proposent les comptes Zernio", async () => {
    await ecrireParametre(PARAM_CANAUX_ZERNIO, { lusLe: "2026-11-01T08:00:00Z", canaux: CANAUX });
    const fb = await ligne("facebook");
    expect(fb?.compte.choix?.map((c) => c.id)).toEqual(["exemple-fb-1:fb:p1", "exemple-fb-1:fb:p2"]);
    expect(fb?.compte.choix?.map((c) => c.nom)).toEqual(["Page exemple 1", "Page exemple 2"]);
    expect(fb?.compte.memorises).toEqual([]);
    const ig = await ligne("instagram");
    expect(ig?.compte.choix?.map((c) => c.id)).toEqual(["exemple-ig-1", "exemple-ig-2"]);
  });

  it("un seul compte hors Facebook : rien à cocher (Zernio le prend seul)", async () => {
    await ecrireParametre(PARAM_CANAUX_ZERNIO, { lusLe: "2026-11-01T08:00:00Z", canaux: CANAUX });
    expect((await ligne("linkedin"))?.compte.choix).toBeUndefined();
  });

  it("comptes jamais lus : pas de liste inventée", async () => {
    expect((await ligne("facebook"))?.compte.choix).toBeUndefined();
  });

  it("un compte déconnecté n'est pas proposé", () => {
    const r = comptesACocherZernio("facebook", [{ ...CANAUX[2], deconnecte: true }, CANAUX[3]]);
    expect(r?.choix?.map((c) => c.id)).toEqual(["exemple-fb-1:fb:p2"]);
  });

  it("un réseau gardé explicitement chez Buffer ne reçoit pas la liste Zernio", async () => {
    await ecrireParametre(PARAM_CANAUX_ZERNIO, { lusLe: "2026-11-01T08:00:00Z", canaux: CANAUX });
    // Choix « buffer » déjà enregistré (écrit à la main : Buffer n'est pas relié ici).
    await ecrireParametre("publication.routage", { instagram: "buffer" });
    expect((await ligne("instagram"))?.compte.choix).toBeUndefined();
    expect((await ligne("facebook"))?.compte.choix).toHaveLength(2);
  });

  it("« Tester » garde en base la liste lue chez Zernio", async () => {
    const service = { listerCanaux: async () => CANAUX } as never;
    expect(await enregistrerCanauxZernio(service)).toBe(CANAUX.length);
    expect((await canauxZernioEnregistres())?.canaux).toHaveLength(CANAUX.length);
  });
});
