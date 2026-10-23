/**
 * LOT D'IMAGES · L6 — dépôt (accord, idempotence, brouillons créés d'avance, crédit réservé), séquenceur (une seule
 * vidéo à la fois, mise de côté qui n'arrête pas le lot, pause crédit / pannes, arrêt, reprise, redémarrage), « Refaire ».
 * Dépôts mémoire du studio, faux HeyGen, `fetch` jamais appelé. Le lancement est un double : rien n'est fabriqué.
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
const { ErreurStudio } = await import("@/services/_commun");
const { simulerRedemarragePourEssai } = await import("@/services/boucle");

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
const RESEAUX = ["linkedin"];

async function deposer(plus: Record<string, unknown> = {}, images = IMAGES) {
  const prix = (await import("@/services/image-video-ecran")).prixDuDepot(["linkedin"], 0.9);
  const issue = await lots.deposerLotImageVideo({ images, reseaux: RESEAUX, accordCentimes: prix * images.length }, dep(plus));
  expect(issue.statut).toBe("lancee");
  return { lotId: (issue as { lotId: string }).lotId, prix };
}
const nombreDeVideos = async () => (await depots().videos.lister()).length;
const lire = async (id: string) => (await lots.lireLotIV(id))!;
const reservation = async (lotId: string) => (await depots().reservations.lister((r) => r.travailId === `lot:${lotId}`))[0];

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

describe("dépôt du lot", () => {
  it("accord inférieur au total (ou « true ») : rien n'est créé, le total est redemandé", async () => {
    const avant = await nombreDeVideos();
    const prix = (await import("@/services/image-video-ecran")).prixDuDepot(["linkedin"], 0.9);
    for (const accord of [prix, prix * 3 - 1, true as unknown as number, undefined]) {
      const r = await lots.deposerLotImageVideo({ images: IMAGES, reseaux: RESEAUX, accordCentimes: accord }, dep());
      expect(r).toMatchObject({ statut: "accord-requis", centimes: prix * 3 });
    }
    expect(await nombreDeVideos()).toBe(avant);
    expect(await lots.lotsDeLIndexIV()).toEqual([]);
    expect(await depots().reservations.lister((r) => !!r.travailId?.startsWith("lot:"))).toHaveLength(0);
  });

  it("taille : 1 image ou plus de 10 refusées", async () => {
    expect((await lots.deposerLotImageVideo({ images: IMAGES.slice(0, 1), reseaux: RESEAUX, accordCentimes: 9999 }, dep())).statut).toBe("refusee");
    const onze = Array.from({ length: 11 }, (_, i) => ({ fichierId: `f${i}`, largeur: 1080, hauteur: 1350 }));
    expect((await lots.deposerLotImageVideo({ images: onze, reseaux: RESEAUX, accordCentimes: 99999 }, dep())).statut).toBe("refusee");
  });

  it("crée N brouillons d'avance avec les entrées du lot, réserve le crédit et engage le prix", async () => {
    const { lotId, prix } = await deposer();
    const lot = await lire(lotId);
    expect(lot).toMatchObject({ statut: "en-cours", prixParVideoCentimes: prix, plafondCentimes: prix * 3, accordCentimes: prix * 3 });
    expect(lot.videos.map((v) => [v.rang, v.statut, v.fichierId])).toEqual([[1, "en-attente", "a"], [2, "en-attente", "b"], [3, "en-attente", "c"]]);
    const v1 = await depots().videos.obtenir(lot.videos[0].videoId);
    expect((v1!.entrees as { imageVideo: Record<string, unknown> }).imageVideo).toMatchObject({ plafondCentimes: prix, lot: { id: lotId, rang: 1, accordParVideoCentimes: prix } });
    expect((await reservation(lotId)).statut).toBe("active");
    expect((await couts.resumeBudget()).engage.centimes).toBe(prix * 3);
    expect(lancees).toEqual([]);
  });

  it("double dépôt identique (même en même temps) : le même lot, un seul jeu de brouillons", async () => {
    const prix = (await import("@/services/image-video-ecran")).prixDuDepot(["linkedin"], 0.9);
    const demande = { images: IMAGES, reseaux: RESEAUX, accordCentimes: prix * 3 };
    const avant = await nombreDeVideos();
    const [a, b] = await Promise.all([lots.deposerLotImageVideo(demande, dep()), lots.deposerLotImageVideo(demande, dep())]);
    expect(a).toEqual(b);
    expect(a.statut).toBe("lancee");
    expect((await nombreDeVideos()) - avant).toBe(3);
    expect(await lots.lotsDeLIndexIV()).toHaveLength(1);
  });

  it("crédit insuffisant : refus en phrase, aucun brouillon, aucun lot", async () => {
    soldeHeygen = 10;
    const avant = await nombreDeVideos();
    const prix = (await import("@/services/image-video-ecran")).prixDuDepot(["linkedin"], 0.9);
    const r = await lots.deposerLotImageVideo({ images: IMAGES, reseaux: RESEAUX, accordCentimes: prix * 3 }, dep());
    expect(r).toMatchObject({ statut: "refusee" });
    expect((r as { phrase: string }).phrase).toContain("Crédit HeyGen insuffisant");
    expect(await nombreDeVideos()).toBe(avant);
    expect(await lots.lotsDeLIndexIV()).toEqual([]);
  });
});

describe("séquenceur", () => {
  it("une seule vidéo à la fois, dans l'ordre des rangs", async () => {
    const { lotId } = await deposer();
    const lot = await lire(lotId);
    await lots.avancerLotsIV(dep());
    await lots.avancerLotsIV(dep());
    expect(lancees).toEqual([lot.videos[0].videoId]);
    expect((await lire(lotId)).videos.map((v) => v.statut)).toEqual(["en-fabrication", "en-attente", "en-attente"]);
    await terminer(lot.videos[0].videoId, "termine", etat("prete"));
    await lots.avancerLotsIV(dep());
    expect(lancees).toEqual([lot.videos[0].videoId, lot.videos[1].videoId]);
    expect((await lire(lotId)).videos.map((v) => v.statut)).toEqual(["faite", "en-fabrication", "en-attente"]);
  });

  it("n'a pas de session : le lancement reçoit l'identifiant et le prix par vidéo, rien d'autre", async () => {
    const { lotId, prix } = await deposer();
    const lancerVideo = vi.fn(async (videoId: Id) => dep().lancerVideo(videoId));
    await lots.avancerLotsIV(dep({ lancerVideo }));
    expect(lancerVideo).toHaveBeenCalledTimes(1);
    expect(lancerVideo).toHaveBeenCalledWith((await lire(lotId)).videos[0].videoId, prix);
  });

  it("attend une autre fabrication Image → vidéo active (lancée à la main par Will)", async () => {
    const { lotId } = await deposer();
    await depots().travaux.enregistrer({ id: "t-autre", type: "video", cibleId: "autre", titre: "autre", etapes: [], statut: "en_cours", progression: 0, tentatives: 1, cleIdempotence: "x", fournisseurUtilise: "x", parametres: { imageVideo: etat("voix") }, ...horo() } as unknown as Travail);
    await lots.avancerLotsIV(dep());
    expect(lancees).toEqual([]);
    await depots().travaux.modifier("t-autre", { statut: "termine" });
    await lots.avancerLotsIV(dep());
    expect(lancees).toHaveLength(1);
    expect((await lire(lotId)).videos[0].statut).toBe("en-fabrication");
  });

  it("une vidéo mise de côté à une porte n'arrête pas le lot : la suivante part", async () => {
    const { lotId } = await deposer();
    const lot = await lire(lotId);
    await lots.avancerLotsIV(dep());
    await terminer(lot.videos[0].videoId, "echec", etat("carte-a-valider", { miseDeCote: { porte: "carte", motif: "Un point de l'image est incertain.", phrases: ["x"] } }));
    await lots.avancerLotsIV(dep());
    const apres = await lire(lotId);
    expect(apres.videos[0]).toMatchObject({ statut: "mise-de-cote", miseDeCote: { porte: "carte", motif: "Un point de l'image est incertain." } });
    expect(apres.videos[1].statut).toBe("en-fabrication");
    expect(apres.pannesDeSuite).toBe(0);
    expect(apres.statut).toBe("en-cours");
  });

  it("la dernière vidéo finie : le lot est terminé et sa réservation libérée", async () => {
    const { lotId } = await deposer({}, IMAGES.slice(0, 2));
    for (let i = 0; i < 2; i++) {
      await lots.avancerLotsIV(dep());
      const v = (await lire(lotId)).videos.find((x) => x.statut === "en-fabrication")!;
      await terminer(v.videoId, "termine", etat("prete"));
    }
    await lots.avancerLotsIV(dep());
    expect((await lire(lotId)).statut).toBe("termine");
    expect((await reservation(lotId)).statut).toBe("liberee");
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
  });

  it("crédit refusé au lancement : la part est rendue au lot, la vidéo reste en attente, le lot est en pause", async () => {
    const { lotId, prix } = await deposer();
    const avant = (await reservation(lotId)).centimes;
    echecLancement = () => new ErreurStudio("CREDIT_INSUFFISANT", "Crédit HeyGen insuffisant : il reste 1,00 $.");
    await lots.avancerLotsIV(dep());
    const lot = await lire(lotId);
    expect(lot.statut).toBe("en-pause");
    expect(lot.pause).toMatchObject({ raison: "credit", phrase: "Crédit HeyGen insuffisant : il reste 1,00 $." });
    expect(lot.videos[0]).toMatchObject({ statut: "en-attente" });
    expect(lot.videos[0].lanceeLe).toBeUndefined();
    expect((await reservation(lotId)).centimes).toBe(avant);
    expect((await couts.resumeBudget()).engage.centimes).toBe(prix * 3);
    // En pause : plus rien ne part.
    echecLancement = null;
    await lots.avancerLotsIV(dep());
    expect(lancees).toEqual([]);
  });

  it("format masqué : le lot se met en pause « format » avant toute dépense", async () => {
    const { lotId } = await deposer();
    echecLancement = () => new ErreurStudio("IV_FORMAT_MASQUE", "Le format n'est pas ouvert.");
    await lots.avancerLotsIV(dep());
    expect((await lire(lotId)).pause?.raison).toBe("format");
  });

  it("deux pannes de suite : le lot se met en pause « pannes », la troisième vidéo ne part pas", async () => {
    const { lotId } = await deposer();
    const lot = await lire(lotId);
    for (const k of [0, 1]) {
      await lots.avancerLotsIV(dep());
      await terminer(lot.videos[k].videoId, "echec", etat("refusee", { refus: { etape: "rendu", code: "IV_RENDU", message: "Le rendu a échoué.", reessayable: true } }));
    }
    await lots.avancerLotsIV(dep());
    const apres = await lire(lotId);
    expect(apres.statut).toBe("en-pause");
    expect(apres.pause?.raison).toBe("pannes");
    expect(apres.videos[2].statut).toBe("en-attente");
    expect(lancees).toHaveLength(2);
  });

  it("plafond du lot : jamais plus que le prix accordé", async () => {
    const { lotId, prix } = await deposer();
    const lot = await lire(lotId);
    // Le plafond ne couvre plus qu'une vidéo : la seconde n'est pas lancée.
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre(`imageVideo.lot.${lotId}`, { ...lot, plafondCentimes: prix });
    await lots.avancerLotsIV(dep());
    await terminer(lot.videos[0].videoId, "termine", etat("prete", { caisse: { plafondCentimes: prix, reservations: [{ cle: "x", etape: "voix", fournisseur: "heygen", centimes: prix }] } }));
    await lots.avancerLotsIV(dep());
    expect(lancees).toHaveLength(1);
    expect((await lire(lotId)).pause).toMatchObject({ raison: "budget", phrase: "Le prix accordé pour ce lot est atteint : rien de plus n'est lancé." });
  });

  it("plafond du lot en mode INDICATIF : le prix accordé est un repère, la suivante part (arrêt de sécurité à 5 ×)", async () => {
    const { lotId, prix } = await deposer();
    const lot = await lire(lotId);
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre(`imageVideo.lot.${lotId}`, { ...lot, plafondCentimes: prix });
    await lots.avancerLotsIV(dep());
    await terminer(lot.videos[0].videoId, "termine", etat("prete", { caisse: { plafondCentimes: prix, reservations: [{ cle: "x", etape: "voix", fournisseur: "heygen", centimes: prix }] } }));
    await lots.avancerLotsIV(dep());
    expect(lancees).toHaveLength(2);
    expect((await lire(lotId)).pause).toBeFalsy();
  });

  it("vidéo supprimée : l'entrée est mise de côté « Supprimée. »", async () => {
    const { lotId } = await deposer();
    const lot = await lire(lotId);
    await lots.avancerLotsIV(dep());
    await depots().travaux.supprimer(`t-${lot.videos[0].videoId}`);
    await depots().videos.supprimer(lot.videos[0].videoId);
    await lots.avancerLotsIV(dep());
    expect((await lire(lotId)).videos[0]).toMatchObject({ statut: "mise-de-cote", miseDeCote: { motif: "Supprimée." } });
  });
});

describe("arrêter, reprendre, redémarrer", () => {
  it("arrêter le lot : plus aucun lancement, réservation et engagement libérés", async () => {
    const { lotId } = await deposer();
    await lots.avancerLotsIV(dep());
    expect(await lots.arreterLotImageVideo(lotId)).toEqual({ statut: "arrete" });
    expect((await lire(lotId)).statut).toBe("arrete");
    expect((await reservation(lotId)).statut).toBe("liberee");
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
    const v1 = (await lire(lotId)).videos[0];
    await terminer(v1.videoId, "termine", etat("prete"));
    await lots.avancerLotsIV(dep());
    expect(lancees).toHaveLength(1);
    // La vidéo en cours est allée au bout ; le lot arrêté n'en lance aucune autre.
    expect((await lire(lotId)).videos.map((v) => v.statut)).toEqual(["faite", "en-attente", "en-attente"]);
    expect((await lire(lotId)).statut).toBe("arrete");
  });

  it("reprendre un lot en cours qui porte TikTok (d'avant le retrait) : la reprise se fait, TikTok n'est pas compté", async () => {
    const { lotId } = await deposer();
    const lot = await lire(lotId);
    const { ecrireParametre } = await import("@/services/_commun");
    await ecrireParametre(`imageVideo.lot.${lotId}`, { ...lot, reseaux: ["tiktok", "linkedin"], statut: "en-pause", pause: { raison: "credit", phrase: "Le crédit ne suffit plus." } });
    expect((await lire(lotId)).reseaux).toEqual(["tiktok", "linkedin"]);
    expect(lot.videos.length).toBe(3);
    expect(await lots.reprendreLotImageVideo(lotId)).toEqual({ statut: "reprise" });
    expect((await lire(lotId)).statut).toBe("en-cours");
  });

  it("reprendre après une pause crédit : la réservation est revérifiée ; un refus garde la pause", async () => {
    const { lotId } = await deposer();
    echecLancement = () => new ErreurStudio("CREDIT_INSUFFISANT", "Crédit HeyGen insuffisant.");
    await lots.avancerLotsIV(dep());
    echecLancement = null;
    await depots().relevesSoldes.enregistrer({ id: "rel-bas", fournisseur: "heygen", mode: "reel", centimes: 10, devise: "USD", luLe: new Date(Date.now() + 1000).toISOString(), ...horo() });
    const refus = await lots.reprendreLotImageVideo(lotId);
    expect(refus).toMatchObject({ statut: "refusee" });
    expect((await lire(lotId)).statut).toBe("en-pause");
    await depots().relevesSoldes.enregistrer({ id: "rel-haut", fournisseur: "heygen", mode: "reel", centimes: 1_000_000, devise: "USD", luLe: new Date(Date.now() + 2000).toISOString(), ...horo() });
    expect(await lots.reprendreLotImageVideo(lotId)).toEqual({ statut: "reprise" });
    const lot = await lire(lotId);
    expect(lot).toMatchObject({ statut: "en-cours", pannesDeSuite: 0 });
    expect(lot.pause).toBeUndefined();
    await lots.avancerLotsIV(dep());
    expect(lancees).toHaveLength(1);
  });

  it("redémarrage entre `lanceeLe` et le lancement : la vidéo est lancée une seule fois", async () => {
    const { lotId } = await deposer();
    const lot = await lire(lotId);
    // Le serveur s'est arrêté après avoir écrit `lanceeLe` : statut « en fabrication », aucun travail.
    const { ecrireParametre } = await import("@/services/_commun");
    lot.videos[0].statut = "en-fabrication";
    lot.videos[0].lanceeLe = new Date().toISOString();
    await ecrireParametre(`imageVideo.lot.${lotId}`, lot);
    simulerRedemarragePourEssai();
    await lots.avancerLotsIV(dep());
    expect(lancees).toEqual([lot.videos[0].videoId]);
    await lots.avancerLotsIV(dep());
    await lots.avancerLotsIV(dep());
    expect(lancees).toEqual([lot.videos[0].videoId]);
  });

  it("redémarrage pendant la fabrication : rien n'est relancé tant que son travail existe", async () => {
    const { lotId } = await deposer();
    await lots.avancerLotsIV(dep());
    simulerRedemarragePourEssai();
    await lots.avancerLotsIV(dep());
    await lots.avancerLotsIV(dep());
    expect(lancees).toHaveLength(1);
    expect((await lire(lotId)).videos[0].statut).toBe("en-fabrication");
  });
});

describe("refaire", () => {
  it("crée une nouvelle vidéo de la même image par le parcours d'une image seule, marque l'entrée « refaite »", async () => {
    const { lotId } = await deposer();
    const lot = await lire(lotId);
    await lots.avancerLotsIV(dep());
    await terminer(lot.videos[0].videoId, "echec", etat("refusee", { refus: { etape: "voix", code: "IV_VOIX", message: "La voix a échoué.", reessayable: true } }));
    await lots.avancerLotsIV(dep());
    const prix = (await import("@/services/image-video-ecran")).prixDuDepot(["linkedin"], 0.9);
    const lancer = vi.fn(async () => ({ statut: "lancee" as const, travailId: "t-neuf" }));
    const issue = await lots.refaireVideoDuLot(lotId, 1, { accordCentimes: prix }, { ...dep(), lancer });
    expect(issue.statut).toBe("lancee");
    const apres = await lire(lotId);
    expect(apres.videos[0]).toMatchObject({ statut: "refaite", refaiteEn: (issue as { videoId: string }).videoId });
    expect(lancer).toHaveBeenCalledTimes(1);
    expect(apres.videos[0].miseDeCote).toBeDefined();
    // Une vidéo encore à venir n'est pas à refaire.
    expect((await lots.refaireVideoDuLot(lotId, 3, { accordCentimes: prix }, dep())).statut).toBe("refusee");
  });
});

describe("relecture (PR #378)", () => {
  it("travail refusé par le moteur SANS état (« echec », aucun `imageVideo`) : mise de côté, jamais relancée en boucle", async () => {
    const { lotId } = await deposer();
    // Comme `travailRefuse` du moteur (ex. NUMERO_VERSION_INTROUVABLE) : un travail en échec, sans état de la machine.
    const lancerVideo = async (videoId: Id) => {
      lancees.push(videoId);
      const id = `t-${videoId}-${lancees.length}`;
      await depots().travaux.enregistrer({ id, type: "video", cibleId: videoId, titre: videoId, etapes: [], statut: "echec", progression: 0, tentatives: 1, cleIdempotence: id, fournisseurUtilise: "x", parametres: {}, erreur: { code: "NUMERO_VERSION_INTROUVABLE", reessayable: false, messagePourWill: "Le numéro de la version est introuvable." }, ...horo() } as unknown as Travail);
      return { travailId: id };
    };
    for (let k = 0; k < 4; k++) await lots.avancerLotsIV(dep({ lancerVideo }));
    const lot = await lire(lotId);
    // Chaque vidéo n'est lancée qu'UNE fois.
    expect(new Set(lancees).size).toBe(lancees.length);
    expect(lot.videos[0]).toMatchObject({ statut: "mise-de-cote", miseDeCote: { porte: "arret", motif: "Le numéro de la version est introuvable." } });
  });

  it("« Arrêter » pendant un lancement qui échoue (crédit) : le lot reste arrêté, sa réservation libérée", async () => {
    let id = "";
    const lancerVideo = async () => {
      await lots.arreterLotImageVideo(id);
      throw new ErreurStudio("CREDIT_INSUFFISANT", "Crédit HeyGen insuffisant.");
    };
    const { lotId } = await deposer();
    id = lotId;
    await lots.avancerLotsIV(dep({ lancerVideo }));
    const lot = await lire(lotId);
    expect(lot.statut).toBe("arrete");
    expect(lot.pause).toBeUndefined();
    expect((await reservation(lotId)).statut).toBe("liberee");
  });
});
