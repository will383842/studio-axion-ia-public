/**
 * LOT D'IMAGES · L5 — crédit et budget réservés POUR LE LOT (plan § c.3) : `reserverLot`, `transfererDuLot`,
 * `rendreAuLot`, `libererLot`. Dépôts mémoire du studio, faux fournisseur HeyGen, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LigneCout } from "@/domaine/types";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");

let soldeHeygen = 100_000;
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

const ligne = (c: number, etape = "voix"): LigneCout => ({ etape, fournisseur: "heygen", unite: "forfait", quantite: 1, prixUnitaire: { centimes: c, devise: "EUR" }, total: { centimes: c, devise: "EUR" }, nature: "reel" });
/** Une vidéo : 100 centimes de voix ; un lot de 3 : 300. */
const UNE = [ligne(100)];
const TROIS = [ligne(300)];
const eur = (centimes: number) => ({ centimes, devise: "EUR" as const });
const LOT = "lot-iv-0123456789ab";
const CLE = `lot:${LOT}`;

const reservationLot = async () => (await depots().reservations.lister((r) => r.travailId === CLE))[0];

beforeEach(() => {
  reinitialiserDepots();
  soldeHeygen = 100_000;
  credits.injecterLecteursPourEssai([heygen], ["heygen"]);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

describe("reserverLot", () => {
  it("réserve le crédit de tout le lot et engage son prix sur le budget du mois", async () => {
    const avant = await couts.resumeBudget();
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    const r = await reservationLot();
    expect(r).toMatchObject({ fournisseur: "heygen", statut: "active" });
    expect(r.centimes).toBeGreaterThan(0);
    expect((await couts.resumeBudget()).engage.centimes - avant.engage.centimes).toBe(300);
  });

  it("le disponible affiché ailleurs tient compte du lot dès l'accord", async () => {
    const avant = await credits.soldeFournisseur("heygen", 0);
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    const apres = await credits.soldeFournisseur("heygen", 0);
    expect(apres.disponible!).toBe(avant.disponible! - (await reservationLot()).centimes);
  });

  it("idempotent : un second appel ne réserve pas deux fois", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    const premiere = (await reservationLot()).centimes;
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    expect(await depots().reservations.lister((r) => r.travailId === CLE)).toHaveLength(1);
    expect((await reservationLot()).centimes).toBe(premiere);
  });

  it("crédit insuffisant : refus en phrase, rien n'est créé", async () => {
    soldeHeygen = 10;
    await expect(credits.reserverLot(LOT, TROIS, eur(300), 300)).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
    expect(await reservationLot()).toBeUndefined();
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
  });

  it("l'engagement du lot reste compté longtemps après le dépôt (aucun travail ne le porte)", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 3 * 3_600_000);
    expect((await couts.resumeBudget()).engage.centimes).toBe(300);
  });
});

describe("reprise du lot après une pause", () => {
  it("la réservation est recalculée sur ce qui reste ; un refus de crédit la laisse telle quelle", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    await credits.transfererDuLot(LOT, "v1", UNE, eur(100));
    await credits.reserverLot(LOT, [ligne(200)], eur(200), 200, { reprise: true });
    const deux = await credits.besoinsDeLEstimation([ligne(200)]);
    expect((await reservationLot()).centimes).toBe(deux[0].avecMarge);
    expect((await couts.resumeBudget()).engage.centimes).toBe(200);
    // Le solde lu chez HeyGen tombe : un relevé plus récent le dit.
    await depots().relevesSoldes.enregistrer({ id: "rel-bas", fournisseur: "heygen", mode: "reel", centimes: 10, devise: "USD", luLe: new Date(Date.now() + 1000).toISOString(), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
    const avant = (await reservationLot()).centimes;
    await expect(credits.reserverLot(LOT, [ligne(200)], eur(200), 200, { reprise: true })).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
    expect((await reservationLot()).centimes).toBe(avant);
  });
});

describe("transfererDuLot", () => {
  it("diminue la réservation du lot et son engagement de la part de la vidéo", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    const avant = (await reservationLot()).centimes;
    await credits.transfererDuLot(LOT, "v1", UNE, eur(100));
    const apres = (await reservationLot()).centimes;
    expect(apres).toBeLessThan(avant);
    expect(apres).toBeGreaterThan(0);
    expect((await couts.resumeBudget()).engage.centimes).toBe(200);
  });

  it("idempotent par vidéo : un second appel pour la même vidéo ne retire rien", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    await credits.transfererDuLot(LOT, "v1", UNE, eur(100));
    const une = (await reservationLot()).centimes;
    await credits.transfererDuLot(LOT, "v1", UNE, eur(100));
    expect((await reservationLot()).centimes).toBe(une);
    expect((await couts.resumeBudget()).engage.centimes).toBe(200);
    await credits.transfererDuLot(LOT, "v2", UNE, eur(100));
    expect((await reservationLot()).centimes).toBeLessThan(une);
  });

  it("jamais négatif, même si la vidéo demande plus que ce qui reste", async () => {
    await credits.reserverLot(LOT, UNE, eur(100), 100);
    await credits.transfererDuLot(LOT, "v1", TROIS, eur(300));
    expect((await reservationLot()).centimes).toBe(0);
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
  });

  it("sans réservation de lot : ne fait rien et ne plante pas", async () => {
    await expect(credits.transfererDuLot(LOT, "v1", UNE, eur(100))).resolves.toBeUndefined();
  });
});

describe("rendreAuLot", () => {
  it("rend la part transférée (lancement échoué avant le travail), une seule fois", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    const entiere = (await reservationLot()).centimes;
    await credits.transfererDuLot(LOT, "v1", UNE, eur(100));
    await credits.rendreAuLot(LOT, "v1");
    expect((await reservationLot()).centimes).toBe(entiere);
    expect((await couts.resumeBudget()).engage.centimes).toBe(300);
    await credits.rendreAuLot(LOT, "v1");
    expect((await reservationLot()).centimes).toBe(entiere);
  });

  it("une vidéo rendue peut être transférée de nouveau (reprise du lot)", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    await credits.transfererDuLot(LOT, "v1", UNE, eur(100));
    await credits.rendreAuLot(LOT, "v1");
    await credits.transfererDuLot(LOT, "v1", UNE, eur(100));
    expect((await couts.resumeBudget()).engage.centimes).toBe(200);
  });

  it("une vidéo jamais transférée : rien à rendre", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    const avant = (await reservationLot()).centimes;
    await credits.rendreAuLot(LOT, "v9");
    expect((await reservationLot()).centimes).toBe(avant);
  });
});

describe("libererLot", () => {
  it("fin du lot : réservation et engagement libérés ; ce qui est lancé garde sa propre réservation", async () => {
    await credits.reserverLot(LOT, TROIS, eur(300), 300);
    await depots().reservations.enregistrer({ id: "res-propre", fournisseur: "heygen", travailId: "t-v1", centimes: 50, devise: "USD", statut: "active", creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
    await credits.libererLot(LOT);
    expect((await reservationLot()).statut).toBe("liberee");
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
    expect((await depots().reservations.obtenir("res-propre"))?.statut).toBe("active");
  });
});
