/**
 * IV-SV · le lot GARDE le choix « sans voix » après le dépôt : budget du mois (transfert), reprise après une pause et
 * « Refaire » comptent le prix sans voix, jamais HeyGen. Dépôts mémoire, faux HeyGen, aucun appel payant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LecteurCredit } from "@/fournisseurs/types";
import type { Id, Travail, Video } from "@/domaine/types";
import type { EtatFabricationIV } from "@/moteurs/montage-image-video";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const lots = await import("@/services/image-video-lot");

const reseau = vi.spyOn(globalThis, "fetch");

let soldeHeygen = 1_000_000;
const heygen: LecteurCredit = {
  fournisseur: "heygen",
  nom: "HeyGen",
  mode: "reel",
  urlRecharge: "",
  variableCle: "HEYGEN_API_KEY",
  async lireSolde() {
    return { fournisseur: "heygen", centimes: soldeHeygen, devise: "USD", luLe: new Date().toISOString() };
  },
  async testerConnexion() {
    return { ok: true, finCle: "…x", message: "ok", testeLe: new Date().toISOString() };
  },
};

const horo = () => ({ creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
const lancees: Id[] = [];
let nTravail = 0;
let echecLancement: ((videoId: Id) => unknown) | null = null;

const etat = (etape: EtatFabricationIV["etape"], plus: Partial<EtatFabricationIV> = {}): EtatFabricationIV =>
  ({ version: "fabrication-iv/1", etape, demande: {}, caisse: { plafondCentimes: 1000, reservations: [] }, tentatives: {}, journal: [], ...plus }) as unknown as EtatFabricationIV;

const dep = (plus: Record<string, unknown> = {}) => ({
  formatOuvert: () => true,
  voix: async () => ({ voixId: "vx", personnageId: "px" }),
  fichier: async (id: string) => ({ id, cleStockage: `k/${id}`, mime: "image/png", taille: 1000, nom: `${id}.png`, sha256: `sha-${id}` }),
  accordEssai: async () => true,
  taux: async () => 0.9,
  brouillon: async (e: { titre: string; entrees: Record<string, unknown> }) => {
    const id = `v-${nTravail++}-${e.titre}`;
    await depots().videos.enregistrer({ id, titre: e.titre, entrees: e.entrees, statut: "brouillon", ...horo() } as unknown as Video);
    return { id };
  },
  abandonner: async () => undefined,
  lancerVideo: async (videoId: Id) => {
    const e = echecLancement?.(videoId);
    if (e) throw e;
    lancees.push(videoId);
    const id = `t-${videoId}`;
    await depots().travaux.enregistrer({ id, type: "video", cibleId: videoId, titre: videoId, etapes: [], statut: "en_cours", progression: 0, tentatives: 1, cleIdempotence: id, fournisseurUtilise: "x", parametres: { imageVideo: etat("lecture") }, ...horo() } as unknown as Travail);
    return { travailId: id };
  },
  ...plus,
});

async function terminer(videoId: Id, statut: Travail["statut"], e: EtatFabricationIV) {
  await depots().travaux.modifier(`t-${videoId}`, { statut, parametres: { imageVideo: e } });
}

const IMAGES = ["a", "b"].map((id) => ({ fichierId: id, largeur: 1080, hauteur: 1350 }));
const RESEAUX = ["linkedin"];
const sansVoixDispo = async () => {
  throw new Error("la voix ne doit pas être cherchée en mode sans voix");
};

const ecran = await import("@/services/image-video-ecran");
const { ecrireParametre } = await import("@/services/_commun");

async function deposerLot(sansVoix: boolean) {
  const prix = ecran.prixDuDepot(RESEAUX as never, 0.9, 50, sansVoix);
  const issue = await lots.deposerLotImageVideo({ images: IMAGES, reseaux: RESEAUX, accordCentimes: prix * IMAGES.length, ...(sansVoix ? { sansVoix: true } : {}) }, dep(sansVoix ? { voix: sansVoixDispo } : {}));
  expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
  return { lotId: (issue as { lotId: string }).lotId, prix };
}
const lire = async (id: string) => (await lots.lireLotIV(id))!;

beforeEach(() => {
  reinitialiserDepots();
  soldeHeygen = 1_000_000;
  lancees.length = 0;
  nTravail = 0;
  echecLancement = null;
  credits.injecterLecteursPourEssai([heygen], ["heygen"]);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  expect(reseau).not.toHaveBeenCalled();
});

describe("IV-SV · lot sans voix : le choix suit le lot", () => {
  it("budget du mois : après le 1er lancement, l'engagement du lot baisse exactement du prix sans voix", async () => {
    const { prix } = await deposerLot(true);
    expect(prix).toBeLessThan(ecran.prixDuDepot(RESEAUX as never, 0.9, 50, false));
    expect((await couts.resumeBudget()).engage.centimes).toBe(prix * IMAGES.length);
    await lots.avancerLotsIV(dep({ voix: sansVoixDispo }));
    expect(lancees).toHaveLength(1);
    // Calcul : 2 vidéos × prix sans voix, moins la part de la 1re (prix sans voix, la caisse du double est vide) = 1 × prix.
    expect((await couts.resumeBudget()).engage.centimes).toBe(prix);
  });

  it("avec voix : rien ne change (l'engagement baisse du prix avec voix)", async () => {
    const { prix } = await deposerLot(false);
    expect((await couts.resumeBudget()).engage.centimes).toBe(prix * IMAGES.length);
    await lots.avancerLotsIV(dep());
    expect((await couts.resumeBudget()).engage.centimes).toBe(prix);
  });

  it("reprise après une pause : passe avec un solde HeyGen à 0 et ne réserve aucune ligne HeyGen", async () => {
    const { lotId } = await deposerLot(true);
    soldeHeygen = 0;
    const lot = await lire(lotId);
    await ecrireParametre(`imageVideo.lot.${lotId}`, { ...lot, statut: "en-pause", pause: { raison: "credit", phrase: "Le crédit ne suffit plus." } });
    expect(await lots.reprendreLotImageVideo(lotId)).toEqual({ statut: "reprise" });
    const reservations = await depots().reservations.lister((r) => r.travailId === `lot:${lotId}`);
    expect(JSON.stringify(reservations)).not.toMatch(/heygen/i);
    expect(JSON.stringify(reservations)).not.toMatch(/"etape":"(voix|ecoute)"/);
  });

  it("reprise d'un lot AVEC voix, solde HeyGen à 0 : toujours refusée", async () => {
    const { lotId } = await deposerLot(false);
    soldeHeygen = 0;
    const lot = await lire(lotId);
    await ecrireParametre(`imageVideo.lot.${lotId}`, { ...lot, statut: "en-pause", pause: { raison: "credit", phrase: "Le crédit ne suffit plus." } });
    await depots().relevesSoldes.enregistrer({ id: "rel-zero", fournisseur: "heygen", mode: "reel", centimes: 0, devise: "USD", luLe: new Date(Date.now() + 1000).toISOString(), ...horo() });
    expect(await lots.reprendreLotImageVideo(lotId)).toMatchObject({ statut: "refusee" });
  });

  it("« Refaire » une vidéo d'un lot sans voix : la nouvelle vidéo reste sans voix (aucune voix cherchée)", async () => {
    const { lotId, prix } = await deposerLot(true);
    const lot = await lire(lotId);
    await lots.avancerLotsIV(dep({ voix: sansVoixDispo }));
    await terminer(lot.videos[0].videoId, "echec", etat("refusee", { refus: { etape: "voix", code: "IV_VOIX", message: "Échec.", reessayable: true } }));
    await lots.avancerLotsIV(dep({ voix: sansVoixDispo }));
    const lancer = vi.fn(async () => ({ statut: "lancee" as const, travailId: "t-neuf" }));
    const issue = await lots.refaireVideoDuLot(lotId, 1, { accordCentimes: prix }, { ...dep({ voix: sansVoixDispo }), lancer });
    expect(issue, JSON.stringify(issue)).toMatchObject({ statut: "lancee" });
    const neuve = await depots().videos.obtenir((issue as { videoId: string }).videoId);
    expect((neuve!.entrees?.imageVideo as { sansVoix?: boolean; plafondCentimes?: number }).sansVoix).toBe(true);
    expect((neuve!.entrees?.imageVideo as { plafondCentimes?: number }).plafondCentimes).toBe(prix);
    expect(neuve!.distribution ?? []).toEqual([]);
  });

  it("« Refaire » une vidéo d'un lot AVEC voix : inchangé (pas de sansVoix, voix exigée)", async () => {
    const { lotId, prix } = await deposerLot(false);
    const lot = await lire(lotId);
    await lots.avancerLotsIV(dep());
    await terminer(lot.videos[0].videoId, "echec", etat("refusee", { refus: { etape: "voix", code: "IV_VOIX", message: "Échec.", reessayable: true } }));
    await lots.avancerLotsIV(dep());
    const lancer = vi.fn(async () => ({ statut: "lancee" as const, travailId: "t-neuf" }));
    expect(await lots.refaireVideoDuLot(lotId, 1, { accordCentimes: prix }, { ...dep({ voix: async () => null }), lancer })).toMatchObject({ statut: "refusee" });
  });
});
