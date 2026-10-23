/**
 * CORBEILLE · lot d'images vers vidéo : une vidéo archivée ou à la corbeille est traitée comme supprimée (mise de côté,
 * rien lancé ni payé). Mêmes doubles que le séquenceur ; `fetch` jamais appelé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LecteurCredit } from "@/fournisseurs/types";
import type { Id, Travail, Video } from "@/domaine/types";
import type { EtatFabricationIV } from "@/moteurs/montage-image-video";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/services/auth", () => ({ exigerSession: async () => ({}) }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const credits = await import("@/services/credits");
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

const IMAGES = ["a", "b", "c"].map((id) => ({ fichierId: id, largeur: 1080, hauteur: 1350 }));
const RESEAUX = ["youtube-shorts"];

async function deposer(plus: Record<string, unknown> = {}, images = IMAGES) {
  const prix = (await import("@/services/image-video-ecran")).prixDuDepot(["youtube-shorts"], 0.9);
  const issue = await lots.deposerLotImageVideo({ images, reseaux: RESEAUX, accordCentimes: prix * images.length }, dep(plus));
  expect(issue.statut).toBe("lancee");
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

describe("vidéo archivée ou à la corbeille dans un lot", () => {
  it("mise de côté, jamais lancée ; les autres vidéos suivent", async () => {
    const { lotId } = await deposer();
    const lot = await lire(lotId);
    const [v1, v2, v3] = lot.videos.map((v) => v.videoId);
    await depots().videos.modifier(v2, { statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date().toISOString() });
    await lots.avancerLotsIV(dep());
    expect(lancees).toEqual([v1]);
    await terminer(v1, "termine", etat("prete"));
    await lots.avancerLotsIV(dep());
    await lots.avancerLotsIV(dep());
    expect(lancees).toEqual([v1, v3]);
    expect(lancees).not.toContain(v2);
    const apres = await lire(lotId);
    expect(apres.videos.find((v) => v.videoId === v2)).toMatchObject({ statut: "mise-de-cote" });
  });

  it("une vidéo archivée sans corbeille est traitée de même", async () => {
    const { lotId } = await deposer();
    const [v1] = (await lire(lotId)).videos.map((v) => v.videoId);
    await depots().videos.modifier(v1, { statut: "archivee", statutAvantArchive: "brouillon" });
    await lots.avancerLotsIV(dep());
    expect(lancees).not.toContain(v1);
  });

  it("relecture #479 défaut 3 : mise à la corbeille ENTRE les deux verrous du lot → la vidéo n'est ni transférée ni lancée", async () => {
    const { lotId } = await deposer();
    const [v1] = (await lire(lotId)).videos.map((v) => v.videoId);
    const d = depots();
    const vraie = d.travaux.lister.bind(d.travaux);
    // Seulement le contrôle « une fabrication Image → vidéo est-elle active ? » (étape 2, après la mise de côté de l'étape 1) :
    // on le reconnaît à sa réponse sur un travail d'essai (la lecture du dernier travail d'une vidéo, elle, répond non).
    const sonde = { statut: "en_cours", parametres: { imageVideo: {} }, cibleId: "autre" } as unknown as Travail;
    let fait = false;
    vi.spyOn(d.travaux, "lister").mockImplementation(async (filtre?: (t: Travail) => boolean) => {
      if (!fait && filtre?.(sonde)) {
        fait = true;
        await d.videos.modifier(v1, { statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date().toISOString() });
      }
      return vraie(filtre);
    });
    await lots.avancerLotsIV(dep());
    expect(fait).toBe(true);
    expect(lancees).not.toContain(v1);
  });
});

describe("mise à la corbeille entre les deux étapes du lot (chaîne d'argent)", () => {
  it("rien n'est transféré ni lancé", async () => {
    const { lotId } = await deposer();
    const [v1] = (await lire(lotId)).videos.map((v) => v.videoId);
    const d = depots();
    // Will met la vidéo à la corbeille APRÈS la mise de côté (étape 1) et AVANT le lancement : au moment du contrôle
    // « une autre fabrication est-elle active ? » (entre les deux verrous).
    const lister = d.travaux.lister.bind(d.travaux);
    let fait = false;
    vi.spyOn(d.travaux, "lister").mockImplementation(async (filtre?: (t: Travail) => boolean) => {
      if (!fait && filtre?.toString().includes("lanceurIV")) {
        fait = true;
        await d.videos.modifier(v1, { statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date().toISOString() });
      }
      return lister(filtre);
    });
    const avant = await d.depenses.lister();
    const reservationsAvant = await d.reservations.lister();
    await lots.avancerLotsIV(dep());
    expect(fait).toBe(true);
    expect(lancees).not.toContain(v1);
    expect(await d.depenses.lister()).toEqual(avant);
    expect(await d.reservations.lister()).toEqual(reservationsAvant);
    expect((await lire(lotId)).videos.find((v) => v.videoId === v1)).toMatchObject({ statut: "mise-de-cote" });
  });
});

describe("lancement par défaut du lot : dernier garde-fou avant la fabrication payée", () => {
  it("une vidéo archivée ou à la corbeille n'est jamais lancée (IV_ECARTEE), une vidéo absente non plus", async () => {
    const { lotId } = await deposer();
    const [v1] = (await lire(lotId)).videos.map((v) => v.videoId);
    await depots().videos.modifier(v1, { statut: "archivee", statutAvantArchive: "brouillon", corbeilleLe: new Date().toISOString() });
    await expect(lots.lancerVideoDuLot(v1, 100)).rejects.toMatchObject({ code: "IV_ECARTEE", message: "Archivée ou à la corbeille : elle n'est pas lancée." });
    await expect(lots.lancerVideoDuLot("v-inconnue", 100)).rejects.toMatchObject({ code: "IV_ECARTEE" });
    expect(await depots().travaux.compter((t) => t.cibleId === v1)).toBe(0);
  });
});

