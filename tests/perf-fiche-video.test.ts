/**
 * Lot P (vitesse de la fiche vidéo, 08/11, Williams : « quand on clique sur une vidéo, c'est très long à s'ouvrir »).
 * Afficher une vidéo ne lit que les fabrications de CETTE vidéo : avant, chaque affichage recopiait les travaux de tout
 * le studio et lisait la vidéo de chacun (plus de 200 lectures avec 200 travaux d'autres vidéos). Aucun appel réseau.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const travaux = await import("@/services/travaux");
const videos = await import("@/services/videos");
type TravailT = Awaited<ReturnType<ReturnType<typeof depots>["travaux"]["obtenir"]>> & object;

const MDP = "perf-fiche-video";
const CIBLE = "v-03";

beforeAll(async () => {
  process.env.SESSION_SECRET = "c".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // La vidéo affichée n'a aucun travail au départ ; les autres vidéos en ont 200, tous terminés.
  for (const t of await depots().travaux.lister()) await depots().travaux.supprimer(t.id);
});

function travail(id: string, cibleId: string, extra: Partial<TravailT>, minute: number): TravailT {
  const date = new Date(Date.UTC(2026, 10, 8, 10, minute % 60, Math.floor(minute / 60))).toISOString();
  return {
    id, cibleId, type: "fabrication", titre: id, etapes: [], statut: "termine", progression: 100, tentatives: 1,
    cleIdempotence: id, fournisseurUtilise: "essai", estDemo: false, creeLe: date, modifieLe: date, termineLe: date, ...extra,
  } as TravailT;
}

async function autresTravaux() {
  for (let i = 0; i < 200; i++) await depots().travaux.enregistrer(travail(`autre-${i}`, "v-01", {}, i));
}

async function ancienne(id: string) {
  const { travailAffiche } = videos;
  return travailAffiche(await travaux.listerTravaux({ inclureTermines: true }), id);
}

describe("fiche vidéo · lecture ciblée", () => {
  it("200 travaux d'autres vidéos : au plus 5 lectures de vidéo pour afficher la fiche", async () => {
    await autresTravaux();
    await depots().travaux.enregistrer(travail("t-cible", CIBLE, { statut: "en_cours", progression: 40 }, 300));
    const espion = vi.spyOn(depots().videos, "obtenir");
    const d = await videos.obtenirVideo(CIBLE);
    expect(d?.video.id).toBe(CIBLE);
    expect(espion.mock.calls.length).toBeLessThanOrEqual(5);
  });

  it("fabrication en cours : même travail qu'avant", async () => {
    await autresTravaux();
    await depots().travaux.enregistrer(travail("t-cible", CIBLE, { statut: "en_cours", progression: 40 }, 300));
    const d = await videos.obtenirVideo(CIBLE);
    expect(d?.travail?.id).toBe("t-cible");
    expect(d?.travail?.id).toBe((await ancienne(CIBLE))?.id);
  });

  it("échec suivi d'un nouveau format : même travail qu'avant", async () => {
    await autresTravaux();
    await depots().travaux.enregistrer(travail("t-fab-echec", CIBLE, { statut: "echec" }, 301));
    await depots().travaux.enregistrer(travail("t-format", CIBLE, { type: "reexport", statut: "en_cours", parametres: { ratio: "9:16" } }, 302));
    const d = await videos.obtenirVideo(CIBLE);
    expect(d?.travail?.id).toBe((await ancienne(CIBLE))?.id);
    expect(d?.travail?.id).toBe("t-fab-echec");
  });

  it("seulement des travaux terminés : aucun travail affiché, comme avant", async () => {
    await autresTravaux();
    await depots().travaux.enregistrer(travail("t-fini", CIBLE, {}, 303));
    const d = await videos.obtenirVideo(CIBLE);
    expect(d?.travail).toBeNull();
    expect(await ancienne(CIBLE)).toBeNull();
  });

  it("vidéo absente : null", async () => {
    expect(await videos.obtenirVideo("inconnue")).toBeNull();
  });
});
