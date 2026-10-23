/**
 * D2 — CRÉDITS ET CLÉS (lot « intensité · crédits · calage », 02/10 ; consigne `CREDITS-ET-CLES.md` §7).
 * Tous les tests tournent SANS clé ni réseau : lecteurs de solde injectés, réponses enregistrées
 * (`tests/fixtures/credits-heygen-users-me.json`, lecture réelle du 02/10).
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import fixtureHeygen from "./fixtures/credits-heygen-users-me.json";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const boucle = await import("@/services/boucle");
const credits = await import("@/services/credits");
const notifications = await import("@/services/notifications");
const { moteurSimulation } = await import("@/moteurs/simulation");
const { ErreurHeygen } = await import("@/fournisseurs/heygen/client");
const { etape17Credits } = await import("@/services/migrations/etape-17-credits");
import * as dom from "@/domaine/credits";
import { ErreurLecture } from "@/fournisseurs/credits";
import { caracteresRestants, creerLecteurElevenLabs } from "@/fournisseurs/credits/elevenlabs";
import { creerLecteurHeygen, soldeDepuisReponse } from "@/fournisseurs/credits/heygen";
import { creerLecteurAnthropic, creerLecteurFal } from "@/fournisseurs/credits/suivis";
import type { MoteurVideo } from "@/moteurs";
import type { DepenseEnregistree, LigneCout, Travail } from "@/domaine/types";
import type { LecteurCredit } from "@/fournisseurs/types";
import { centimes } from "@/lib/montants";

const MDP_TEST = "essai-d2-credits";
/** Fausse clé d'essai (forme d'une vraie, jamais une vraie). */
const CLE_ESSAI = "hg_ESSAI_cle_tres_secrete_0123456789_Zq7W";
const CLE_CLAUDE = "sk-ant-ESSAI-cle-secrete-abcdefghijklmnop-K9x2";

beforeAll(async () => {
  process.env.SESSION_SECRET = "d".repeat(48);
  const empreinte = await hash(MDP_TEST, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP_TEST, false);
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  boucle.arreterBoucle();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Lecteur HeyGen d'essai : solde réglable, compte ses lectures (gratuites). Aucun appel payant n'existe ici. */
function heygenEssai(etat: { solde: number; lectures: number; refuse?: boolean }): LecteurCredit {
  return {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      etat.lectures++;
      if (etat.refuse) throw new ErreurLecture("refuse", "HeyGen refuse la clé.");
      return { fournisseur: "heygen", centimes: etat.solde, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: !etat.refuse, finCle: "…Zq7W", message: etat.refuse ? "Clé refusée : remplacez-la." : "Clé acceptée", testeLe: new Date().toISOString() };
    },
  };
}

const faussaireSansReseau = (async () => {
  throw new Error("aucun appel attendu");
}) as unknown as typeof fetch;

/** Claude « suivi » : AUCUN appel réseau autorisé (le pré-vol ne doit jamais l'appeler). */
function claudeSansReseau(appels: { n: number }): LecteurCredit {
  return creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_CLAUDE }, (async () => {
    appels.n++;
    throw new Error("aucun appel attendu");
  }) as unknown as typeof fetch);
}

const ligne = (etape: string, fournisseur: string, unite: LigneCout["unite"], quantite: number, totalCentimesEur: number, nature: LigneCout["nature"] = "estime"): LigneCout => ({
  etape,
  fournisseur,
  unite,
  quantite,
  prixUnitaire: centimes(totalCentimesEur / Math.max(1, quantite)),
  total: centimes(totalCentimesEur),
  nature,
});

async function depense(fournisseur: string, centimesEur: number, date = new Date().toISOString(), videoId?: string): Promise<void> {
  const l = ligne("Voix", fournisseur, "forfait", 1, centimesEur, "reel");
  const dep: DepenseEnregistree = { id: `dep-${Math.random().toString(36).slice(2)}`, videoId, lignes: [l], total: l.total, date, creeLe: date, modifieLe: date };
  await depots().depenses.enregistrer(dep);
}

/* ------------------------------------------------------------------ */
/** Brique 6 : le repère « script relu » que l'assistant joint à l'attente d'une vidéo dite par la voix de synthèse. */
async function scriptReluDe(videoId: string): Promise<string> {
  const { empreinteDesBlocs } = await import("@/domaine/relecture-assistant");
  const v = await depots().videos.obtenir(videoId);
  return empreinteDesBlocs((await depots().scripts.obtenir(v!.scriptId!))!.blocs);
}

describe("calculs purs (domaine/credits)", () => {
  it("identifiants, conversion, affichage en dollars", () => {
    expect(dom.idFournisseur("fal.ai")).toBe("fal");
    expect(dom.idFournisseur("fal-ai")).toBe("fal");
    expect(dom.idFournisseur("HeyGen")).toBe("heygen");
    expect(dom.eurVersUsd(90, 0.9)).toBeCloseTo(100);
    expect(dom.formaterDollars(2983)).toMatch(/^29,83\s\$$/);
  });

  it("solde suivi = dernière recharge − dépenses réelles depuis ; inconnu sans recharge", () => {
    const recharges = [{ fournisseur: "anthropic", centimes: 2000, date: "2026-10-01T00:00:00.000Z" }];
    const dep = [
      { date: "2026-09-30T00:00:00.000Z", lignes: [ligne("Script", "anthropic", "appel", 1, 900, "reel")] },
      { date: "2026-10-01T10:00:00.000Z", lignes: [ligne("Script", "anthropic", "appel", 1, 90, "reel"), ligne("Voix", "heygen", "forfait", 1, 900, "reel")] },
    ];
    expect(dom.soldeSuivi(recharges, dep, "anthropic", 0.9)).toEqual({ centimes: 1900, depuis: "2026-10-01T00:00:00.000Z", recharge: 2000 });
    expect(dom.soldeSuivi([], dep, "anthropic", 0.9)).toBeNull();
  });

  it("pré-vol : estimation + 20 %, un seul manque suffit ; un solde inconnu ne bloque pas", () => {
    const besoins = dom.besoinsParFournisseur([
      { fournisseur: "heygen", centimesUsd: 300, etape: "Voix" },
      { fournisseur: "fal.ai", centimesUsd: 100, etape: "Illustrations" },
    ]);
    expect(besoins).toEqual([
      { fournisseur: "heygen", estimation: 300, avecMarge: 360, etapes: ["Voix"] },
      { fournisseur: "fal", estimation: 100, avecMarge: 120, etapes: ["Illustrations"] },
    ]);
    expect(dom.manques(besoins, { heygen: 359, fal: 1000 })).toEqual([{ fournisseur: "heygen", disponible: 359, demande: 360 }]);
    expect(dom.manques(besoins, { heygen: 360, fal: null })).toEqual([]);
  });

  it("jauge : verte, orange sous 25 %, rouge sous 10 % ou sous une vidéo ; ≈ N vidéos", () => {
    expect(dom.tonJauge(500, 1000, 100)).toBe("vert");
    expect(dom.tonJauge(200, 1000, 100)).toBe("orange");
    expect(dom.tonJauge(90, 1000, 10)).toBe("rouge");
    expect(dom.tonJauge(400, 1000, 500)).toBe("rouge");
    expect(dom.videosRestantes(950, 300)).toBe(3);
    expect(dom.videosRestantes(950, null)).toBeNull();
  });

  it("coût moyen sur les 10 dernières vidéos qui ont payé ce fournisseur", () => {
    const dep = Array.from({ length: 12 }, (_, i) => ({ videoId: `v${i}`, date: `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`, lignes: [ligne("Voix", "heygen", "forfait", 1, i < 2 ? 9000 : 90, "reel")] }));
    // Les deux plus anciennes (90 $) sont hors des 10 dernières.
    expect(dom.coutMoyenVideo(dep, "heygen", 0.9)).toBeCloseTo(100);
  });

  it("référence de la jauge : le solde après la dernière recharge (hausse) puis le plus haut depuis", () => {
    const r = (c: number, j: number) => ({ centimes: c, luLe: `2026-10-0${j}T00:00:00.000Z` });
    expect(dom.soldeDeReference([r(3000, 1), r(2000, 2), r(1000, 3)])).toBe(3000);
    expect(dom.soldeDeReference([r(3000, 1), r(500, 2), r(4000, 3), r(3500, 4)])).toBe(4000);
  });

  it("alertes : le seuil le plus bas franchi, une fois ; « plus qu'une vidéo » ; e-mail à 10 % et à une vidéo", () => {
    expect(dom.alerteAEnvoyer(60, 600, null, [])).toBeNull();
    expect(dom.alerteAEnvoyer(45, 450, null, [])).toEqual({ cle: "50", email: false });
    expect(dom.alerteAEnvoyer(20, 200, null, ["50"])).toEqual({ cle: "25", email: false });
    expect(dom.alerteAEnvoyer(8, 80, null, ["50", "25"])).toEqual({ cle: "10", email: true });
    expect(dom.alerteAEnvoyer(8, 80, null, ["50", "25", "10"])).toBeNull();
    expect(dom.alerteAEnvoyer(40, 80, 100, [])).toEqual({ cle: "une-video", email: true });
  });

  it("rapprochement (écart > 10 %), expiration fal.ai (365 j, rappel à 30 j)", () => {
    expect(dom.rapprochement(800, 1000)).toMatchObject({ inexplique: true, recharge: false });
    expect(dom.rapprochement(950, 1000)).toMatchObject({ inexplique: false, recharge: false });
    expect(dom.rapprochement(3000, 1000)).toMatchObject({ recharge: true });
    const achat = "2026-01-01T00:00:00.000Z";
    expect(dom.expirationParDefaut("fal.ai", achat)).toBe("2027-01-01T00:00:00.000Z");
    expect(dom.expirationParDefaut("heygen", achat)).toBeUndefined();
    const t = Date.parse("2026-12-10T00:00:00.000Z");
    expect(dom.expirationsProches([{ expireLe: "2027-01-01T00:00:00.000Z" }, { expireLe: "2027-03-01T00:00:00.000Z" }, { expireLe: "2026-12-01T00:00:00.000Z" }], t)).toHaveLength(1);
  });

  it("clés : 4 derniers caractères seulement, masquées partout", () => {
    expect(dom.finDeCle(CLE_ESSAI)).toBe("…Zq7W");
    expect(dom.finDeCle("court")).toBeUndefined();
    expect(dom.masquerCles(`refus pour ${CLE_ESSAI} !`, [CLE_ESSAI])).toBe("refus pour ••• !");
  });
});

/* ------------------------------------------------------------------ */
describe("lecteurs de solde (réponses enregistrées)", () => {
  it("HeyGen : GET /v3/users/me (v3), x-api-key, solde du porte-monnaie en centimes de dollar", async () => {
    expect(soldeDepuisReponse(fixtureHeygen.data)).toBe(2983);
    const appels: { url: string; cle: string | null; methode: string }[] = [];
    const faux = (async (url: string, init?: RequestInit) => {
      appels.push({ url: String(url), cle: new Headers(init?.headers).get("x-api-key"), methode: init?.method ?? "GET" });
      return new Response(JSON.stringify(fixtureHeygen), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    const l = creerLecteurHeygen({ HEYGEN_API_KEY: CLE_ESSAI }, faux);
    expect(l.mode).toBe("reel");
    const lu = await l.lireSolde!();
    expect(lu).toMatchObject({ fournisseur: "heygen", centimes: 2983, devise: "USD" });
    expect(appels).toEqual([{ url: "https://api.heygen.com/v3/users/me", cle: CLE_ESSAI, methode: "GET" }]);
    const test = await l.testerConnexion();
    expect(test).toMatchObject({ ok: true, finCle: "…Zq7W", message: "Clé acceptée" });
    expect(JSON.stringify(test)).not.toContain(CLE_ESSAI);
  });

  it("HeyGen : clé refusée (401) → test en échec, message clair, la clé n'apparaît nulle part ; sans clé : rien n'est appelé", async () => {
    const faux = (async () => new Response(JSON.stringify({ error: { code: "unauthorized", message: `bad key ${CLE_ESSAI}` } }), { status: 401 })) as unknown as typeof fetch;
    const test = await creerLecteurHeygen({ HEYGEN_API_KEY: CLE_ESSAI }, faux).testerConnexion();
    expect(test.ok).toBe(false);
    expect(test.message).toMatch(/^Clé refusée/);
    expect(JSON.stringify(test)).not.toContain(CLE_ESSAI);
    const jamais = vi.fn();
    const sans = await creerLecteurHeygen({}, jamais as unknown as typeof fetch).testerConnexion();
    expect(sans).toMatchObject({ ok: false, message: "Aucune clé sur le serveur." });
    expect(jamais).not.toHaveBeenCalled();
  });

  it("ElevenLabs : GET /v1/user/subscription, caractères restants ; fal.ai et Claude : soldes SUIVIS, test gratuit", async () => {
    expect(caracteresRestants({ character_count: 1200, character_limit: 30000 })).toBe(28800);
    const vus: string[] = [];
    const faux = (async (url: string) => {
      vus.push(String(url));
      return new Response(JSON.stringify({ character_count: 100, character_limit: 1000, data: [] }), { status: 200 });
    }) as unknown as typeof fetch;
    expect((await creerLecteurElevenLabs({ ELEVENLABS_API_KEY: "el_essai_0123456789abcd" }, faux).lireSolde!()).caracteresRestants).toBe(900);
    const fal = creerLecteurFal({ FAL_KEY: "fal_essai_0123456789abcdef" }, faux);
    const claude = creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_CLAUDE }, faux);
    expect([fal.mode, claude.mode, fal.lireSolde, claude.lireSolde]).toEqual(["suivi", "suivi", undefined, undefined]);
    expect((await fal.testerConnexion()).ok).toBe(true);
    expect((await claude.testerConnexion()).finCle).toBe("…K9x2");
    expect(vus).toEqual(["https://api.elevenlabs.io/v1/user/subscription", "https://api.fal.ai/v1/models/pricing?endpoint_id=fal-ai/nano-banana", "https://api.anthropic.com/v1/models?limit=1"]);
  });
});

/* ------------------------------------------------------------------ */
describe("pré-vol bloquant", () => {
  const voix10k = ligne("Voix", "heygen", "caractere", 10_000, 200); // 10 000 caractères × 0,03 c$ = 3,00 $ → 3,60 $ avec la marge
  const script = ligne("Script", "anthropic", "appel", 1, 90); // 0,90 € = 1,00 $ → 1,20 $

  it("HeyGen insuffisant : refus clair, AVANT tout appel payant ; Claude n'est jamais appelé", async () => {
    const heygen = { solde: 210, lectures: 0 };
    const reseauClaude = { n: 0 };
    credits.injecterLecteursPourEssai([heygenEssai(heygen), claudeSansReseau(reseauClaude)], ["heygen", "anthropic"]);
    await depots().recharges.enregistrer({ id: "r1", fournisseur: "anthropic", centimes: 5000, devise: "USD", date: new Date().toISOString(), creeLe: "", modifieLe: "" });
    const erreur = await credits.verifierBudgetEtCredits({ lignes: [voix10k, script], total: centimes(290) }, true, "Cette vidéo").catch((e) => e);
    expect(erreur).toMatchObject({ code: "CREDIT_INSUFFISANT" });
    expect(erreur.message).toMatch(/^Crédit HeyGen insuffisant : il reste 2,10\s\$, cette vidéo demande ≈ 3,60\s\$\.$/);
    expect(heygen.lectures).toBe(1); // une lecture gratuite du solde, rien d'autre
    expect(reseauClaude.n).toBe(0);
  });

  it("Claude ne bloque plus, même avec un solde déclaré bas : seul HeyGen insuffisant refuse la vidéo", async () => {
    const heygen = { solde: 210, lectures: 0 };
    const reseauClaude = { n: 0 };
    credits.injecterLecteursPourEssai([heygenEssai(heygen), claudeSansReseau(reseauClaude)], ["heygen", "anthropic"]);
    await depots().recharges.enregistrer({ id: "r1", fournisseur: "anthropic", centimes: 100, devise: "USD", date: new Date().toISOString(), creeLe: "", modifieLe: "" });
    // Claude (1,20 $ demandés, 1,00 $ déclaré) ne pèse pas : le refus vient de HeyGen seul.
    await expect(credits.verifierBudgetEtCredits({ lignes: [voix10k, script], total: centimes(290) }, true, "Cette retouche")).rejects.toMatchObject({
      code: "CREDIT_INSUFFISANT",
      message: expect.stringMatching(/^Crédit HeyGen insuffisant : il reste 2,10\s\$, cette retouche demande ≈ 3,60\s\$\.$/),
    });
    expect(reseauClaude.n).toBe(0);
  });

  it("tout couvert, solde suivi inconnu (aucune recharge déclarée), ligne simulée, clé absente : rien ne bloque", async () => {
    credits.injecterLecteursPourEssai([heygenEssai({ solde: 10_000, lectures: 0 }), claudeSansReseau({ n: 0 })], ["heygen", "anthropic"]);
    await expect(credits.verifierBudgetEtCredits({ lignes: [voix10k, script, ligne("Montage", "simulation", "forfait", 1, 50)], total: centimes(340) }, true, "Cette vidéo")).resolves.toBeUndefined();
    credits.injecterLecteursPourEssai([heygenEssai({ solde: 0, lectures: 0 })], []);
    await expect(credits.verifierBudgetEtCredits({ lignes: [voix10k], total: centimes(200) }, true, "Cette vidéo")).resolves.toBeUndefined();
  });

  it("clé refusée : alerte rouge (cloche + e-mail) et fabrication bloquée", async () => {
    credits.injecterLecteursPourEssai([heygenEssai({ solde: 10_000, lectures: 0, refuse: true })], ["heygen"]);
    await expect(credits.verifierBudgetEtCredits({ lignes: [voix10k], total: centimes(200) }, true, "Cette vidéo")).rejects.toMatchObject({ code: "CLE_REFUSEE" });
    expect(await depots().notifications.trouver((n) => n.type === "credit" && n.titre === "Clé HeyGen refusée")).toBeTruthy();
  });

  it("le budget du mois reste vérifié en premier, à l'identique", async () => {
    await expect(credits.verifierBudgetEtCredits({ lignes: [], total: centimes(10_000_000) }, true, "Cette vidéo")).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
  });
});

/* ------------------------------------------------------------------ */
describe("réservations : deux vidéos simultanées, brouillon « dès que possible »", () => {
  /** Les voix de démonstration deviennent des voix HeyGen (le registre, sans clé, les lit en simulation). */
  async function voixHeygen() {
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
  }
  async function besoinHeygen(videoId: string): Promise<number> {
    const c = await fabrication.construireCommande(videoId);
    const { moteurDeCommande } = await import("@/moteurs");
    const e = await moteurDeCommande(c).estimer(c);
    return (await credits.besoinsDeLEstimation(e.lignes)).find((b) => b.fournisseur === "heygen")?.avecMarge ?? 0;
  }

  it("la seconde vidéo attend : réservation de la première, refus de la seconde, puis départ après « Arrêter »", async () => {
    await voixHeygen();
    const heygen = { solde: 0, lectures: 0 };
    credits.injecterLecteursPourEssai([heygenEssai(heygen)], ["heygen"]);
    await depots().videos.modifier("v-04", { statut: "brouillon" });
    const b3 = await besoinHeygen("v-03");
    const b4 = await besoinHeygen("v-04");
    expect(b3).toBeGreaterThan(0);
    expect(b4).toBeGreaterThan(0);
    heygen.solde = b3 + Math.floor(b4 / 2); // assez pour une, pas pour les deux

    const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true });
    const reservees = await depots().reservations.lister((r) => r.statut === "active");
    expect(reservees).toEqual([expect.objectContaining({ fournisseur: "heygen", travailId, videoId: "v-03", centimes: b3, devise: "USD" })]);

    const avant = await depots().travaux.compter();
    await expect(fabrication.lancerFabrication("v-04", { confirme: true })).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
    expect(await depots().travaux.compter()).toBe(avant); // rien n'est parti
    expect(await depots().reservations.compter((r) => r.videoId === "v-04")).toBe(0);

    // « Garder en brouillon » + « lancer dès que possible ».
    await credits.garderEnAttente("v-04", { lancerDesQuePossible: true, fournisseur: "heygen", confirme: true, scriptRelu: await scriptReluDe("v-04") });
    expect((await depots().videos.obtenir("v-04"))!.lancementEnAttente).toMatchObject({ fournisseur: "heygen", confirme: true });
    await credits.surveillerCredits({ force: true });
    expect(await depots().notifications.trouver((n) => n.titre === "Crédit disponible")).toBeFalsy();

    // « Arrêter » la première : sa réservation est libérée (jamais effacée).
    await travaux.annulerTravail(travailId);
    expect((await depots().reservations.lister((r) => r.travailId === travailId))[0]).toMatchObject({ statut: "liberee", libereeLe: expect.any(String) });

    // La boucle de fond prévient ; l'Accueil la lance (la fabrication exige la session de Will).
    await credits.surveillerCredits({ force: true });
    expect(await depots().notifications.trouver((n) => n.titre === "Crédit disponible")).toBeTruthy();
    expect((await credits.resumeCreditsAccueil()).brouillonsPrets).toBe(1);
    expect(await credits.lancerVideosEnAttente()).toEqual({ lancees: ["Télétravail : quels outils pour l'équipe ?"] });
    expect((await depots().videos.obtenir("v-04"))!.lancementEnAttente).toBeUndefined();
    expect(await depots().reservations.compter((r) => r.videoId === "v-04" && r.statut === "active")).toBe(1);
  });

  it("la feuille « crédit insuffisant » dit ce qui manque et où recharger", async () => {
    await voixHeygen();
    credits.injecterLecteursPourEssai([heygenEssai({ solde: 1, lectures: 0 })], ["heygen"]);
    const d = await credits.detailCreditVideo("v-03");
    expect(d.manques).toEqual([expect.objectContaining({ fournisseur: "heygen", nom: "HeyGen", urlRecharge: "https://app.heygen.com/settings/api" })]);
    expect(d.manques[0].disponible).toMatch(/^0,01\s\$$/);
    expect(d.message).toMatch(/^Crédit HeyGen insuffisant/);
    expect(d.economiqueSuffit).toBe(false); // la voix manque : couper les illustrations ne suffit pas
  });

  it("fin de fabrication : la réservation est « consommée » (le coût réel la remplace)", async () => {
    await voixHeygen();
    credits.injecterLecteursPourEssai([heygenEssai({ solde: 1_000_000, lectures: 0 })], ["heygen"]);
    vi.useFakeTimers({ toFake: ["Date"] });
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const choisirMoteur = () => moteurSimulation;
    for (let i = 0; i < 80 && (await depots().travaux.obtenir(travailId))!.statut !== "termine"; i++) {
      vi.setSystemTime(Date.now() + 5_000);
      await boucle.tourDeBoucle({ choisirMoteur });
    }
    expect((await depots().travaux.obtenir(travailId))!.statut).toBe("termine");
    expect((await depots().reservations.lister((r) => r.travailId === travailId)).map((r) => r.statut)).toEqual(["consommee"]);
  });
});

/* ------------------------------------------------------------------ */
describe("« crédit insuffisant » au milieu de la fabrication", () => {
  /** Moteur simulé ; quand `etat.epuise`, le fournisseur répond « crédit insuffisant » (refus non payé). */
  function moteurCredit(travailId: string, etat: { epuise: boolean; refus: number; voixPayees: number }): MoteurVideo {
    return {
      ...moteurSimulation,
      async avancer(t, c, m) {
        if (t.id === travailId && etat.epuise) {
          etat.refus++;
          throw new ErreurHeygen({ code: "quota", reessayable: false, message: "Les crédits HeyGen sont épuisés : rechargez le compte HeyGen, puis réessayez." });
        }
        const avantVoix = t.etapes.find((e) => e.cle === "voix")?.statut;
        const r = await moteurSimulation.avancer(t, c, m);
        if (t.id === travailId && avantVoix !== "terminee" && r.travail.etapes.find((e) => e.cle === "voix")?.statut === "terminee") etat.voixPayees++;
        return r;
      },
    };
  }

  it("étape en attente de crédit, notification immédiate, reprise après la recharge, aucun appel payé en double", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    credits.injecterLecteursPourEssai([heygenEssai({ solde: 1_000_000, lectures: 0 })], ["heygen"]);
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const etat = { epuise: false, refus: 0, voixPayees: 0 };
    const choisirMoteur = () => moteurCredit(travailId, etat);
    const lire = () => depots().travaux.obtenir(travailId).then((t) => t as Travail);
    const tour = async (ms = 5_000) => {
      vi.setSystemTime(Date.now() + ms);
      await boucle.tourDeBoucle({ choisirMoteur });
    };
    // La voix se fait (payée une fois), puis le crédit s'épuise au milieu.
    for (let i = 0; i < 40 && (await lire()).etapes.find((e) => e.cle === "voix")?.statut !== "terminee"; i++) await tour();
    expect(etat.voixPayees).toBe(1);
    const faites = (await lire()).etapes.filter((e) => e.statut === "terminee").map((e) => e.cle);
    etat.epuise = true;
    await tour();
    let t = await lire();
    expect(t.reprise).toMatchObject({ motif: "credit", fournisseurCredit: "heygen" });
    expect(t.statut).not.toBe("echec");
    expect(t.etapes.filter((e) => e.statut === "terminee").map((e) => e.cle)).toEqual(faites); // rien de perdu
    expect((await travaux.obtenirTravail(travailId))!).toMatchObject({ attenteCredit: "HeyGen", enAttenteFournisseur: false });
    expect(await depots().notifications.trouver((n) => n.type === "credit" && n.titre === "Crédit HeyGen épuisé")).toBeTruthy();
    // Pas de nouvel essai avant l'heure (et jamais d'échec au bout de 24 h).
    await tour(10 * 60_000);
    expect(etat.refus).toBe(1);
    await tour(25 * 3600_000);
    expect((await lire()).statut).not.toBe("echec");
    const refusAvantRecharge = etat.refus;

    // Recharge déclarée : reprise immédiate, dans l'ordre ; la voix n'est pas refaite.
    etat.epuise = false;
    await auth.seConnecter(MDP_TEST, false); // 25 h plus tard : nouvelle connexion
    await credits.declarerRecharge("heygen", 2000);
    t = await lire();
    expect(new Date(t.reprise!.prochainEssai).getTime()).toBeLessThanOrEqual(Date.now());
    for (let i = 0; i < 80 && (await lire()).statut !== "termine"; i++) await tour();
    expect((await lire()).statut).toBe("termine");
    expect((await lire()).reprise).toBeUndefined();
    expect(etat.voixPayees).toBe(1);
    expect(etat.refus).toBe(refusAvantRecharge);
    const lignesVoix = (await depots().depenses.lister((x) => x.travailId === travailId)).flatMap((x) => x.lignes).filter((l) => l.etape === "Voix");
    expect(lignesVoix.length).toBeLessThanOrEqual(1);
  });

  it("recharge LUE chez le fournisseur (hausse du solde, sans « J'ai rechargé ») : la vidéo en attente repart, la voix n'est pas repayée", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const heygen = { solde: 1_000_000, lectures: 0 };
    credits.injecterLecteursPourEssai([heygenEssai(heygen)], ["heygen"]);
    await credits.surveillerCredits({ force: true }); // premier relevé (référence du rapprochement)
    const { travailId } = await fabrication.lancerFabrication("v-04", { confirme: true });
    const etat = { epuise: false, refus: 0, voixPayees: 0 };
    const choisirMoteur = () => moteurCredit(travailId, etat);
    const lire = () => depots().travaux.obtenir(travailId).then((t) => t as Travail);
    const tour = async (ms = 5_000) => {
      vi.setSystemTime(Date.now() + ms);
      await boucle.tourDeBoucle({ choisirMoteur });
    };
    for (let i = 0; i < 40 && (await lire()).etapes.find((e) => e.cle === "voix")?.statut !== "terminee"; i++) await tour();
    etat.epuise = true;
    await tour();
    expect((await lire()).reprise).toMatchObject({ motif: "credit", fournisseurCredit: "heygen" });
    expect(new Date((await lire()).reprise!.prochainEssai).getTime()).toBeGreaterThan(Date.now());

    // Will recharge directement chez HeyGen ; le rapprochement du lendemain lit la hausse.
    etat.epuise = false;
    heygen.solde = 3_000_000;
    vi.setSystemTime(Date.now() + 25 * 3600_000);
    const prevu = (await lire()).reprise!.prochainEssai;
    await credits.surveillerCredits({ force: true, instant: Date.now() });
    expect((await lire()).reprise!.prochainEssai).not.toBe(prevu); // c'est la recharge lue qui a relancé, pas le délai
    expect(new Date((await lire()).reprise!.prochainEssai).getTime()).toBeLessThanOrEqual(Date.now());
    expect(JSON.stringify(await depots().evenements.lister())).toContain("Recharge HeyGen constatée");
    for (let i = 0; i < 80 && (await lire()).statut !== "termine"; i++) await tour();
    expect((await lire()).statut).toBe("termine");
    expect(etat.voixPayees).toBe(1);
  });

  it("une erreur « quota » réessayable (banque d'images, 429) reste une panne passagère", async () => {
    expect(credits.estCreditInsuffisant({ code: "quota", reessayable: true })).toBe(false);
    expect(credits.estCreditInsuffisant({ erreur: { code: "quota", reessayable: false } })).toBe(true);
    expect(credits.estCreditInsuffisant(new Error("Your credit balance is too low to access the Anthropic API."))).toBe(true);
    expect(credits.fournisseurDeLErreur(new Error("Your credit balance is too low"), "montage-avocat")).toBe("anthropic");
    expect(credits.fournisseurDeLErreur(new ErreurHeygen({ code: "quota", reessayable: false, message: "x" }), "montage-avocat")).toBe("heygen");
    expect(credits.fournisseurDeLErreur({ message: "fal.ai : crédit épuisé." }, "montage-avocat")).toBe("fal");
  });
});

/* ------------------------------------------------------------------ */
/** Lot R3 : sans e-mail configuré, plus rien ne part (pas même « simulé ») ; une fausse configuration, aucun réseau. */
const EMAIL_FAUX = { cle: "faux", expediteur: "studio@axion-ia.com", destinataire: "will@example.com", adresse: "https://zepto.invalid", site: "https://studio.axion-ia.com" };

describe("alertes, rapprochement, expiration", () => {
  it("solde suivi (fal.ai) : 25 % (cloche), 10 % (cloche + e-mail), une seule fois chacune ; la recharge remet à zéro", async () => {
    credits.injecterLecteursPourEssai([creerLecteurFal({ FAL_KEY: "fal_essai_0123456789abcdef" }, faussaireSansReseau)], ["fal"]);
    const debut = new Date(Date.now() - 3600_000).toISOString();
    await depots().recharges.enregistrer({ id: "r1", fournisseur: "fal", centimes: 1000, devise: "USD", date: debut, creeLe: debut, modifieLe: debut });
    await depense("fal", 720); // 800 $ ¢ dépensés → reste 2,00 $ (20 %)
    await credits.surveillerCredits({ force: true });
    let alertes = await depots().notifications.lister((n) => n.type === "credit");
    expect(alertes.map((n) => n.titre)).toEqual(["fal.ai : crédit sous 25 %"]);
    await credits.surveillerCredits({ force: true });
    expect(await depots().notifications.compter((n) => n.type === "credit")).toBe(1);

    await depense("fal", 117); // reste 0,70 $ (7 %)
    const emails: string[] = [];
    await notifications.diffuserNotifications({ push: null, email: EMAIL_FAUX, envoyerEmail: async (_c, m) => (emails.push(m.titre), { envoye: true, simule: true }) });
    emails.length = 0;
    await credits.surveillerCredits({ force: true });
    alertes = await depots().notifications.lister((n) => n.type === "credit");
    expect(alertes.map((n) => n.titre)).toContain("fal.ai : crédit sous 10 %");
    await notifications.diffuserNotifications({ push: null, email: EMAIL_FAUX, envoyerEmail: async (_c, m) => (emails.push(m.titre), { envoye: true, simule: true }) });
    expect(emails).toEqual(["fal.ai : crédit sous 10 %"]);

    await credits.declarerRecharge("fal", 2000);
    expect(await credits.soldeFournisseur("fal")).toMatchObject({ mode: "suivi", solde: 2070 });
    expect((await depots().recharges.lister()).at(-1)?.note).toMatch(/^dont 0,70/);
  });

  it("« plus qu'une vidéo » (fal.ai) d'après le coût moyen réel des dernières vidéos", async () => {
    credits.injecterLecteursPourEssai([creerLecteurFal({ FAL_KEY: "fal_essai_0123456789abcdef" }, faussaireSansReseau)], ["fal"]);
    const debut = new Date(Date.now() - 3600_000).toISOString();
    await depots().recharges.enregistrer({ id: "r1", fournisseur: "fal", centimes: 1000, devise: "USD", date: debut, creeLe: debut, modifieLe: debut });
    await depense("fal", 540, new Date().toISOString(), "v-01"); // une vidéo à 6 $ → il reste 4 $ < 1 vidéo
    await credits.surveillerCredits({ force: true });
    expect((await depots().notifications.lister((n) => n.type === "credit")).map((n) => n.titre)).toEqual(["fal.ai : plus qu'une vidéo"]);
    const [carte] = (await credits.vueCredits()).filter((c) => c.fournisseur === "fal");
    expect(carte).toMatchObject({ mode: "suivi", ton: "rouge", videosRestantes: 0, pourcentage: 40 });
  });

  it("Claude : aucune alerte de solde (25 %, 10 %, « plus qu'un script »), le solde est chez Anthropic", async () => {
    credits.injecterLecteursPourEssai([claudeSansReseau({ n: 0 })], ["anthropic"]);
    const debut = new Date(Date.now() - 3600_000).toISOString();
    await depots().recharges.enregistrer({ id: "r1", fournisseur: "anthropic", centimes: 1000, devise: "USD", date: debut, creeLe: debut, modifieLe: debut });
    await depense("anthropic", 810, new Date().toISOString(), "v-01"); // aurait fait « sous 10 % » et « plus qu'un script » avec l'ancien suivi
    await credits.surveillerCredits({ force: true });
    expect(await depots().notifications.compter((n) => n.type === "credit")).toBe(0);
    const [carte] = (await credits.vueCredits()).filter((c) => c.fournisseur === "anthropic");
    expect(carte).toMatchObject({ mode: "suivi", videosRestantes: null });
    expect(carte.disponibleTexte).toBeNull();
    expect(carte.ton).not.toBe("rouge");
  });

  it("rapprochement quotidien : un solde lu plus bas de 10 % que l'attendu = « dépense inexpliquée » ; une hausse = recharge", async () => {
    const heygen = { solde: 3000, lectures: 0 };
    credits.injecterLecteursPourEssai([heygenEssai(heygen)], ["heygen"]);
    const t0 = Date.now();
    await credits.surveillerCredits({ force: true, instant: t0 });
    expect(heygen.lectures).toBe(1);
    await credits.surveillerCredits({ force: true, instant: t0 + 3600_000 });
    expect(heygen.lectures).toBe(1); // une fois par jour
    await depense("heygen", 90); // 1,00 $ dépensé par le studio → attendu 29,00 $
    heygen.solde = 2000; // mais 20,00 $ lus chez HeyGen
    await credits.surveillerCredits({ force: true, instant: t0 + 25 * 3600_000 });
    expect(heygen.lectures).toBe(2);
    const releve = (await depots().relevesSoldes.lister()).sort((a, b) => a.luLe.localeCompare(b.luLe)).at(-1)!;
    expect(releve).toMatchObject({ centimes: 2000, attenduCentimes: 2900, mode: "reel" });
    expect(await depots().notifications.trouver((n) => n.titre === "Dépense inexpliquée chez HeyGen")).toBeTruthy();
  });

  it("expiration fal.ai : un rappel 30 jours avant, une seule fois", async () => {
    credits.injecterLecteursPourEssai([creerLecteurFal({ FAL_KEY: "fal_essai_0123456789abcdef" })], ["fal"]);
    const achat = new Date(Date.now() - 340 * 86_400_000).toISOString();
    await depots().recharges.enregistrer({ id: "r-fal", fournisseur: "fal", centimes: 2500, devise: "USD", date: achat, expireLe: dom.expirationParDefaut("fal", achat), creeLe: achat, modifieLe: achat });
    await credits.surveillerCredits({ force: true });
    await credits.surveillerCredits({ force: true });
    expect((await depots().notifications.lister((n) => n.type === "credit")).map((n) => n.titre)).toEqual(["Crédits fal.ai bientôt expirés"]);
  });
});

/* ------------------------------------------------------------------ */
describe("une clé n'apparaît dans aucun journal, aucune réponse, aucun écran", () => {
  it("test de connexion réussi puis refusé, écrans Connexions et Crédits, notifications, journal, sorties console", async () => {
    const sorties: string[] = [];
    for (const m of ["log", "error", "warn", "info"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void sorties.push(a.map(String).join(" ")));
    process.env.HEYGEN_API_KEY = CLE_ESSAI;
    process.env.ANTHROPIC_API_KEY = CLE_CLAUDE;
    try {
      let refuse = false;
      const faux = (async (url: string, init?: RequestInit) => {
        const cle = new Headers(init?.headers).get("x-api-key");
        if (refuse) return new Response(JSON.stringify({ error: { code: "invalid_api_key", message: `Invalid key: ${cle}` } }), { status: 401 });
        if (String(url).includes("anthropic")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
        return new Response(JSON.stringify(fixtureHeygen), { status: 200 });
      }) as unknown as typeof fetch;
      vi.stubGlobal("fetch", faux);
      credits.injecterLecteursPourEssai([creerLecteurHeygen(process.env, faux), creerLecteurAnthropic(process.env, faux)], ["heygen", "anthropic"]);

      const ok = await credits.testerConnexionCredit("heygen");
      expect(ok).toMatchObject({ ok: true, finCle: "…Zq7W" });
      refuse = true;
      const ko = await credits.testerConnexionCredit("heygen");
      expect(ko.ok).toBe(false);
      await credits.testerConnexionCredit("anthropic");
      const ecranCles = await credits.vueCles();
      expect(ecranCles.find((c) => c.fournisseur === "heygen")).toMatchObject({ clePresente: true, finCle: "…Zq7W" });
      const ecranCredits = await credits.vueCredits();
      expect(ecranCredits.find((c) => c.fournisseur === "heygen")).toMatchObject({ mode: "reel", soldeTexte: expect.stringMatching(/^29,83\s\$$/) });

      const d = depots();
      const tout = JSON.stringify({
        ok,
        ko,
        ecranCles,
        ecranCredits,
        notifications: await d.notifications.lister(),
        journal: await d.evenements.lister(),
        parametres: await d.parametres.lister(),
        releves: await d.relevesSoldes.lister(),
        sorties,
      });
      for (const cle of [CLE_ESSAI, CLE_CLAUDE]) {
        expect(tout).not.toContain(cle);
        expect(tout).not.toContain(cle.slice(0, 16));
      }
      expect(await d.notifications.trouver((n) => n.titre === "Clé HeyGen refusée")).toBeTruthy();
    } finally {
      delete process.env.HEYGEN_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});

/* ------------------------------------------------------------------ */
describe("solde d'essai local (captures), jamais en production", () => {
  it("CREDITS_ESSAI fixe le solde lu d'un service réel hors production ; ignoré en production", async () => {
    const env = process.env as Record<string, string | undefined>;
    const avant = env.NODE_ENV;
    env.CREDITS_ESSAI = "heygen=1";
    try {
      expect(await credits.soldeFournisseur("heygen", 0)).toMatchObject({ mode: "reel", solde: 1, disponible: 1 });
      env.NODE_ENV = "production";
      reinitialiserDepots();
      expect((await credits.soldeFournisseur("heygen", 0)).solde).toBeNull();
    } finally {
      env.NODE_ENV = avant;
      delete env.CREDITS_ESSAI;
    }
  });
});

/* ------------------------------------------------------------------ */
describe("migration (étape 17)", () => {
  it("libère une réservation restée active d'un travail fini ; idempotente ; aucune donnée inventée", async () => {
    const d = depots();
    const iso = new Date().toISOString();
    await d.travaux.enregistrer({ id: "t-fini", type: "fabrication", cibleId: "v-03", titre: "x", etapes: [], statut: "termine", progression: 100, tentatives: 1, cleIdempotence: "x", fournisseurUtilise: "simulation", creeLe: iso, modifieLe: iso });
    await d.reservations.enregistrer({ id: "res-1", fournisseur: "heygen", travailId: "t-fini", centimes: 100, devise: "USD", statut: "active", creeLe: iso, modifieLe: iso });
    await d.reservations.enregistrer({ id: "res-2", fournisseur: "heygen", travailId: "t-perdu", centimes: 100, devise: "USD", statut: "active", creeLe: iso, modifieLe: iso });
    expect(await etape17Credits(d, iso)).toEqual({ reservationsLiberees: 1, reservationsConsommees: 1 });
    expect(await etape17Credits(d, iso)).toBeNull();
    expect(await d.reservations.compter()).toBe(2); // rien d'effacé
    expect(await d.recharges.compter()).toBe(0);
  });
});
