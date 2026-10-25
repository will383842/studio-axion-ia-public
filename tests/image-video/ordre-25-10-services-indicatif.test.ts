/**
 * Ordre du 25/10/2026 · en mode INDICATIF, le prix ne bloque jamais les VRAIS services Image → vidéo (lanceur, dépôt d'un lot,
 * dépôt d'un texte, suite d'un lot) et une trace « Prix X accepté sans confirmation » est écrite au journal quand l'accord manquait.
 * Le réglage `budget.mode` est posé ici (vitest.config.mts impose « bloquant » par défaut). Dépôts mémoire, doubles, aucun réseau.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LecteurCredit } from "@/fournisseurs/types";
import type { Id, Travail } from "@/domaine/types";
import type { EtatFabricationIV } from "@/moteurs/montage-image-video";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }), headers: async () => new Headers() }));
vi.mock("@/services/auth", async (orig) => ({ ...(await orig<typeof import("@/services/auth")>()), exigerSession: async () => ({ utilisateurId: "will" }) }));

const { avancerJusquAArretIV, etatInitialIV, validerCarteIV } = await import("@/moteurs/montage-image-video/fabrication");
const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const credits = await import("@/services/credits");
const lots = await import("@/services/image-video-lot");
const texte = await import("@/services/image-video-texte");
const { publierVitrineIV, idsVitrineIV } = await import("@/services/image-video-lanceur");
const { validerScriptImageVideo, prixAffiche } = await import("@/services/image-video-scripts");
const { outilsImageVideo, PREFIXE_DECISIONS } = await import("@/services/image-video");
const { prixDuDepot } = await import("@/services/image-video-ecran");

const reseau = vi.spyOn(globalThis, "fetch");
const TRACE = /accepté sans confirmation/;
const traces = () => depots().evenements.compter((e) => TRACE.test(e.message));

const heygen: LecteurCredit = {
  fournisseur: "heygen",
  nom: "HeyGen",
  mode: "reel",
  urlRecharge: "",
  variableCle: "HEYGEN_API_KEY",
  async lireSolde() {
    return { fournisseur: "heygen", centimes: 1_000_000, devise: "USD", luLe: new Date().toISOString() };
  },
  async testerConnexion() {
    return { ok: true, finCle: "…x", message: "ok", testeLe: new Date().toISOString() };
  },
};

const horo = () => ({ creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
const lancees: Id[] = [];
let nTravail = 0;

const etat = (etape: EtatFabricationIV["etape"], plus: Partial<EtatFabricationIV> = {}): EtatFabricationIV =>
  ({ version: "fabrication-iv/1", etape, demande: {}, caisse: { plafondCentimes: 1000, reservations: [] }, tentatives: {}, journal: [], ...plus }) as unknown as EtatFabricationIV;

const dep = () => ({
  formatOuvert: () => true,
  voix: async () => ({ voixId: "vx", personnageId: "px" }),
  fichier: async (id: string) => ({ id, cleStockage: `k/${id}`, mime: "image/png", taille: 1000, nom: `${id}.png`, sha256: `sha-${id}` }),
  accordEssai: async () => true,
  taux: async () => 0.9,
  brouillon: async (e: { titre: string; entrees: Record<string, unknown> }) => {
    const id = `v-${nTravail++}-${e.titre}`;
    await depots().videos.enregistrer({ id, titre: e.titre, entrees: e.entrees, statut: "brouillon", ...horo() } as never);
    return { id };
  },
  abandonner: async () => undefined,
  lancerVideo: async (videoId: Id) => {
    lancees.push(videoId);
    const id = `t-${videoId}`;
    await depots().travaux.enregistrer({ id, type: "video", cibleId: videoId, titre: videoId, etapes: [], statut: "en_cours", progression: 0, tentatives: 1, cleIdempotence: id, fournisseurUtilise: "x", parametres: { imageVideo: etat("lecture") }, ...horo() } as unknown as Travail);
    return { travailId: id };
  },
});

const IMAGES = ["a", "b", "c"].map((id) => ({ fichierId: id, largeur: 1080, hauteur: 1350 }));
const RESEAUX = ["linkedin"];

beforeEach(async () => {
  reinitialiserDepots();
  lancees.length = 0;
  nTravail = 0;
  credits.injecterLecteursPourEssai([heygen], ["heygen"]);
  await ecrireParametre("budget.mode", "indicatif");
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  expect(reseau).not.toHaveBeenCalled();
});

describe("lanceur : la décision du script s'écrit sans accord, la voix est réservée", () => {
  const VIDEO = "v-iv-indicatif";
  async function vitrineAuScript() {
    const carte = carteFixe("C");
    const o = outilsSimules(carte, monde());
    let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { videoId: VIDEO })), o);
    e = validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-15T08:00:00.000Z" });
    e = await avancerJusquAArretIV(e, o);
    await publierVitrineIV({ videoId: VIDEO, titre: "Essai", etat: e, entrees: {} });
    return { e, montant: prixAffiche(e.propositionScript!) };
  }

  it("sans accord : la décision est écrite avec le prix du jour et la trace est au journal", async () => {
    const { e, montant } = await vitrineAuScript();
    const choixFormules = Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const]));
    await validerScriptImageVideo(VIDEO, { choixFormules });
    const gardees = await lireParametre<Record<string, Record<string, unknown>> | null>(`${PREFIXE_DECISIONS}${VIDEO}`, null);
    expect(gardees?.script).toMatchObject({ proposition: e.propositionScript!.empreinte, accordCentimes: montant });
    expect(await traces()).toBeGreaterThan(0);
  });

  it("voix : une décision sans accord ne bloque plus la réservation", async () => {
    await vitrineAuScript();
    const { travailId } = idsVitrineIV(VIDEO);
    const outils = await outilsImageVideo({ videoId: VIDEO, travailId, production: false, accordDuScriptExige: true, lireImageSource: async () => null });
    await ecrireParametre(`${PREFIXE_DECISIONS}${VIDEO}`, { script: { proposition: "p", choixFormules: {} } });
    expect(await outils.budget.reserver({ videoId: VIDEO, appelId: "iv-voix-1-1", etape: "voix", fournisseur: "heygen", centimes: 40, caracteres: 900 })).toEqual({ ok: true });
    expect(await traces()).toBeGreaterThan(0);
  });
});

describe("dépôts : un lot ou un texte sans accord est lancé", () => {
  it("lot sans accord : statut « lancee » et trace au journal", async () => {
    const issue = await lots.deposerLotImageVideo({ images: IMAGES, reseaux: RESEAUX, accordCentimes: undefined }, dep());
    expect(issue.statut).toBe("lancee");
    expect(await traces()).toBeGreaterThan(0);
  });

  it("lot avec un accord suffisant : lancé, aucune trace", async () => {
    const prix = prixDuDepot(["linkedin"], 0.9);
    const issue = await lots.deposerLotImageVideo({ images: IMAGES, reseaux: RESEAUX, accordCentimes: prix * IMAGES.length }, dep());
    expect(issue.statut).toBe("lancee");
    expect(await traces()).toBe(0);
  });

  it("texte sans accord : statut « lancee » et trace au journal", async () => {
    const d = dep();
    const issue = await texte.deposerTexteImageVideo(
      { texte: "Quand une facture client dépasse 30 jours, l'IA rédige une relance polie et suit le paiement dans le tableur.", reseaux: RESEAUX as never, accordCentimes: undefined },
      { formatOuvert: d.formatOuvert, voix: d.voix, taux: d.taux, accordEssai: d.accordEssai, brouillon: d.brouillon as never, abandonner: d.abandonner, lancer: async () => ({ statut: "lancee" }) as never },
    );
    expect(issue.statut).toBe("lancee");
    expect(await traces()).toBeGreaterThan(0);
  });
});

describe("suite d'un lot : à plus de 5 fois le plafond, la suivante part quand même", () => {
  it("plafond du lot = 1 vidéo, engagé = 6 ×, indicatif : deux lancements, aucune pause", async () => {
    const prix = prixDuDepot(["linkedin"], 0.9);
    const d = dep();
    const issue = await lots.deposerLotImageVideo({ images: IMAGES, reseaux: RESEAUX, accordCentimes: prix * IMAGES.length }, d);
    const lotId = (issue as { lotId: string }).lotId;
    const lot = (await lots.lireLotIV(lotId))!;
    await ecrireParametre(`imageVideo.lot.${lotId}`, { ...lot, plafondCentimes: prix });
    await lots.avancerLotsIV(d as never);
    await depots().travaux.modifier(`t-${lot.videos[0].videoId}`, {
      statut: "termine",
      parametres: { imageVideo: etat("prete", { caisse: { plafondCentimes: prix, reservations: [{ cle: "x", etape: "voix", fournisseur: "heygen", centimes: prix * 6 }] } }) },
    });
    await lots.avancerLotsIV(d as never);
    expect(lancees).toHaveLength(2);
    expect((await lots.lireLotIV(lotId))!.pause).toBeFalsy();
  });
});
