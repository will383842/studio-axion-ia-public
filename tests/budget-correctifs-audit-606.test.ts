/**
 * Correctifs de l'audit argent de la PR #606 (budget indicatif) :
 *  - l'origine « usine » reste bloquante (origine lue sur la dernière version, transmise à la commande face caméra, au
 *    plafond Claude du mois et au lot Image -> vidéo) ; une origine illisible ferme (usine) ;
 *  - cloches : une par vidéo (ou lot) et par jour, prix annoncé en euros ; messages exacts ;
 *  - cas concret : voix en indicatif = compteur de lectures ET arrêt de sécurité à 5 fois la part voix.
 * Faux `fetch`, aucun réseau, 0 €.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { exemplesCommeVraies } from "./helpers/videos-reelles";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const dcv = await import("@/services/depense-claude-video");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { roleRelectureFacecam } = await import("@/moteurs/montage-facecam/monteur");
const { nouvelId } = await import("@/lib/ids");
import type { Video } from "@/domaine/types";

const MDP = "essai-budget-indicatif-claude";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeEach(async () => {
  reinitialiserDepots();
  await exemplesCommeVraies(depots());
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(init?.body);
    return reponseFlux(fluxReussi({ texte: JSON.stringify({ ok: true, defauts: [], corrections: [] }), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

async function video(): Promise<Video> {
  const modele = (await depots().videos.obtenir("v-04"))!;
  const v: Video = { ...modele, id: "v-bi-fc", estDemo: false, formatId: "facecam" };
  await depots().videos.enregistrer(v);
  return v;
}

async function depenseMonteur(videoId: string, centimesEur: number, date = new Date().toISOString()) {
  const ligne = { etape: "Monteur · consignes", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: centimesEur, devise: "EUR" as const }, total: { centimes: centimesEur, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
}

const entree = { contexte: {}, variable: "<elements>\n</elements>" };
const options = () => ({ etape: "Monteur · relecture des images", facecam: { depuis: new Date(Date.now() - 60_000).toISOString() } });

async function versionDe(videoId: string, origine?: "usine" | "studio") {
  const modele = (await depots().versions.lister())[0];
  const date = new Date().toISOString();
  await depots().versions.enregistrer({ ...(modele ?? {}), id: nouvelId("ver"), videoId, numero: 99, commande: { ...(modele?.commande ?? {}), ...(origine ? { origine } : {}) }, creeLe: date, modifieLe: date } as never);
}

describe("origine « usine » : les plafonds par vidéo restent bloquants sans que l'appelant la passe", () => {
  it("vidéo dont la dernière version vient de l'Usine : bloquée au-dessus du plafond", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    await versionDe(v.id, "usine");
    await depenseMonteur(v.id, 140, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, options());
    expect(r).toMatchObject({ ok: false, arret: "plafond-video" });
    expect(appels).toHaveLength(0);
  });
  it("même dépense, commande de Will : passe en indicatif", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    await versionDe(v.id, "studio");
    await depenseMonteur(v.id, 140, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, options());
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  });
  it("budgetIndicatifPourVideo : Usine faux, Will vrai, origine explicite prioritaire", async () => {
    const m = await import("@/services/mode-budget");
    await ecrireParametre("budget.mode", "indicatif");
    const v = await video();
    await versionDe(v.id, "usine");
    expect(await m.budgetIndicatifPourVideo(v.id)).toBe(false);
    expect(await m.budgetIndicatifPourVideo(v.id, "studio")).toBe(true);
    expect(await m.origineDeLaVideo("inconnue")).toBe("studio");
  });
  it("plafond Claude du mois : une vidéo de l'Usine reste en version simple", async () => {
    const { plafondClaudeDuMoisAtteint } = await import("@/services/plafond-claude");
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("claude.plafondMensuelUsd", 0.0001);
    await depenseMonteur((await video()).id, 140);
    expect(await plafondClaudeDuMoisAtteint("usine")).toBe(true);
    expect(await plafondClaudeDuMoisAtteint("studio")).toBe(false);
  });
});

describe("lot Image → vidéo", () => {
  it("origineDuLotIV : « usine » si une vidéo du lot vient de l'Usine", async () => {
    const { origineDuLotIV } = await import("@/services/image-video-lot");
    const v = await video();
    expect(await origineDuLotIV({ videos: [{ videoId: v.id }] } as never)).toBe("studio");
    await versionDe(v.id, "usine");
    expect(await origineDuLotIV({ videos: [{ videoId: v.id }] } as never)).toBe("usine");
  });
});

describe("cloche : une par vidéo et par jour", () => {
  it("deux vidéos qui dépassent : deux cloches ; la même vidéo deux fois : une seule", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    brancherClaude();
    const a = await video();
    const b: Video = { ...a, id: "v-bi-fc-2" };
    await depots().videos.enregistrer(b);
    for (const v of [a, b]) await depenseMonteur(v.id, 140, new Date(Date.now() - 30_000).toISOString());
    await dcv.executerRolePourVideo(a.id, roleRelectureFacecam, entree, options());
    await dcv.executerRolePourVideo(b.id, roleRelectureFacecam, entree, options());
    await dcv.executerRolePourVideo(a.id, roleRelectureFacecam, entree, options());
    const cloches = (await depots().notifications.lister()).filter((x) => x.type === "budget" && /Prix annoncé/.test(x.titre));
    expect(cloches).toHaveLength(2);
    expect(cloches[0].message).toMatch(/Au-delà du budget indicatif : la fabrication continue, arrêt de sécurité à 5 fois le prix annoncé/);
  });
  it("arrêt de sécurité : message exact et clair", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    brancherClaude();
    const v = await video();
    await depenseMonteur(v.id, 800, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, options());
    expect(!r.ok && r.message).toMatch(/dépasserait 5 fois le prix annoncé, rien de plus n'est payé/);
    expect(!r.ok && r.message).not.toMatch(/déjà coûté/);
  });
});

describe("cas concret : voix en indicatif = compteur ET 5 ×", () => {
  it("le compteur de 3 lectures reste", async () => {
    const { verifierPartVoix } = await import("@/moteurs/montage-cas-concret/fabriquer");
    const p = (prise: string) => ({ prise, coutCentimes: 1 }) as never;
    expect(() => verifierPartVoix({ indicatif: { lecturesVoixMax: 3, facteurSecurite: 5 } }, [p("a"), p("a"), p("a")], { prise: "a", texte: "t" })).toThrow(/déjà été lue 3 fois/);
  });
  it("sous le compteur mais au-delà de 5 × la part voix : arrêt de sécurité", async () => {
    const { verifierPartVoix } = await import("@/moteurs/montage-cas-concret/fabriquer");
    const budget = { plafondVoix: { centimes: 10, prixLecture: () => 20 }, indicatif: { lecturesVoixMax: 3, facteurSecurite: 5 } };
    const payees = [{ prise: "a", coutCentimes: 40 }] as never;
    expect(() => verifierPartVoix(budget, payees, { prise: "a", texte: "t" })).toThrow(/Arrêt de sécurité/);
  });
  it("au-dessus du montant mais sous 5 × : la lecture passe (indicatif)", async () => {
    const { verifierPartVoix } = await import("@/moteurs/montage-cas-concret/fabriquer");
    const budget = { plafondVoix: { centimes: 10, prixLecture: () => 20 }, indicatif: { lecturesVoixMax: 3, facteurSecurite: 5 } };
    expect(() => verifierPartVoix(budget, [{ prise: "a", coutCentimes: 20 }] as never, { prise: "a", texte: "t" })).not.toThrow();
  });
});

describe("montants et devise de la cloche, origine illisible, sujet de lot", () => {
  it("le prix annoncé est converti en euros (taux) : 1,5 $ au taux 0,9 = 1,35 €", async () => {
    const { jugerPlafond } = await import("@/services/budget-mensuel");
    await ecrireParametre("budget.mode", "indicatif");
    expect(await jugerPlafond(200, 1.5, true, "Ce texte", "vid-x", { tauxUsdEur: 0.9 })).toBe("ok");
    const n = (await depots().notifications.lister()).filter((x) => x.type === "budget" && /Prix annoncé/.test(x.titre));
    expect(n).toHaveLength(1);
    expect(n[0].message).toMatch(/\(1,35\s*€\)/);
    expect(n[0].message).not.toMatch(/\$/);
  });
  it("face caméra (format sans prix) : aucun montant dans la cloche", async () => {
    const { jugerPlafond } = await import("@/services/budget-mensuel");
    await jugerPlafond(200, 1.5, true, "Monteur", "vid-y", { sansPrix: true });
    const n = (await depots().notifications.lister()).filter((x) => x.type === "budget" && /Prix annoncé/.test(x.titre));
    expect(n[0].message).toMatch(/^Monteur : Au-delà du budget indicatif : la fabrication continue/);
  });
  it("origineDeLaVideo : lecture en panne = « usine » (échec fermé) ; vidéo sans version = « studio »", async () => {
    const m = await import("@/services/mode-budget");
    expect(await m.origineDeLaVideo("sans-version")).toBe("studio");
    const spy = vi.spyOn(depots().versions, "lister").mockRejectedValue(new Error("panne"));
    expect(await m.origineDeLaVideo("x")).toBe("usine");
    expect(await m.budgetIndicatifPourVideo("x")).toBe(false);
    spy.mockRestore();
  });
  it("sujetDeCloche : le lot si la vidéo en fait partie, sinon la vidéo", async () => {
    const m = await import("@/services/mode-budget");
    const v = await video();
    expect(await m.sujetDeCloche(v.id)).toBe(v.id);
    const date = new Date().toISOString();
    await depots().versions.enregistrer({ id: nouvelId("ver"), videoId: v.id, numero: 1, commande: { entrees: { lot: { id: "lot-7", rang: 2, accordParVideoCentimes: 100 } } }, creeLe: date, modifieLe: date } as never);
    expect(await m.sujetDeCloche(v.id)).toBe("lot-7");
  });
});

describe("transmission de l'origine", () => {
  it("construireCommande (face caméra) : le plafond Claude du mois suit l'origine reçue", async () => {
    const { construireCommande } = await import("@/services/fabrication");
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("claude.plafondMensuelUsd", 0.0001);
    await depenseMonteur((await video()).id, 140);
    const v = await video();
    expect((await construireCommande(v.id, { origine: "usine" })).plafondClaudeAtteint).toBe(true);
    expect((await construireCommande(v.id)).plafondClaudeAtteint).toBe(false);
  }, 30_000);
  it("outilsFacecamAnimee : lit l'origine de la commande (ou celle de la vidéo) pour le plafond Claude", async () => {
    const { outilsFacecamAnimee } = await import("@/services/facecam-animee");
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("claude.plafondMensuelUsd", 0.0001);
    const v = await video();
    await depenseMonteur(v.id, 140);
    const base = { videoId: v.id, travailId: "t-1", production: false } as never;
    const sansOrigine = await outilsFacecamAnimee(base);
    expect(await sansOrigine.plafondClaudeAtteint()).toBe(false);
    const usine = await outilsFacecamAnimee({ ...(base as object), origine: "usine" } as never);
    expect(await usine.plafondClaudeAtteint()).toBe(true);
    await versionDe(v.id, "usine");
    expect(await (await outilsFacecamAnimee(base)).plafondClaudeAtteint()).toBe(true);
  }, 30_000);
});

describe("Usine : réservation sur le budget de l'Usine, actions de Will, formats sans prix", () => {
  it("vidéo d'origine Usine SOUS le plafond, sans budget reçu de l'Usine : budget-usine, 0 appel", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    await versionDe(v.id, "usine");
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, options());
    expect(r).toMatchObject({ ok: false, arret: "budget-usine" });
    expect(appels).toHaveLength(0);
  });
  it("même vidéo, action de Will (parWill) au-dessus du plafond : indicatif, pas de budget-usine", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    await versionDe(v.id, "usine");
    await depenseMonteur(v.id, 140, new Date(Date.now() - 30_000).toISOString());
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, { ...options(), parWill: true });
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  });
  it("relireImagesControle reçoit l'origine : Usine = 0 appel, Will = 1 appel", async () => {
    const { relireImagesControle } = await import("@/services/monteur-facecam");
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    const etat = { facecam: { passages: [] } } as never;
    const images = [{ type: "image/jpeg", base64: "AAAA", legende: "x", elementId: null }] as never;
    await relireImagesControle(v.id, etat, images, { origine: "usine" });
    expect(appels).toHaveLength(0);
    await relireImagesControle(v.id, etat, images, { origine: "studio" });
    expect(appels).toHaveLength(1);
  }, 30_000);
  it("monteurPourFabrication reçoit l'origine : Usine = 0 appel Claude, Will = au moins 1", async () => {
    const { monteurPourFabrication } = await import("@/services/monteur-facecam");
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const v = await video();
    const entrees = { facecam: { consignes: [{ id: "c1", texte: "mets un titre au début", origine: "voix", etat: "comprise", dansPriseSec: 0 }] } };
    const opts = { titre: "t", mots: [{ mot: "bonjour", debutSec: 0, finSec: 1 }], dureePriseSec: 10 } as never;
    await monteurPourFabrication(v.id, { entrees, origine: "usine" }, opts);
    expect(appels).toHaveLength(0);
    await monteurPourFabrication(v.id, { entrees, origine: "studio" }, opts);
    expect(appels.length).toBeGreaterThanOrEqual(1);
  }, 30_000);
  it("format sans prix (face caméra animée) : ni la cloche ni l'arrêt de sécurité ne montrent de montant", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    brancherClaude();
    const a = await video();
    const v: Video = { ...a, id: "v-fa-1", formatId: "facecam-animee" };
    await depots().videos.enregistrer(v);
    const plafondPropre = { id: "faclaude", parametre: "facecamAnimee.plafondClaudeUsd", defautUsd: 1.5, prefixeEtape: "Face caméra animée ·" };
    const ligne = { etape: "Face caméra animée · mise en scène", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: 140, devise: "EUR" as const }, total: { centimes: 140, devise: "EUR" as const }, nature: "reel" };
    const date = new Date(Date.now() - 30_000).toISOString();
    await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId: v.id, lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
    const r = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, { etape: "Face caméra animée · mise en scène", plafondPropre } as never);
    expect(r.ok).toBe(true);
    const cloche = (await depots().notifications.lister()).filter((x) => x.type === "budget" && /Prix annoncé/.test(x.titre));
    expect(cloche).toHaveLength(1);
    expect(cloche[0].message).not.toMatch(/€|\$/);
    const ligne2 = { ...ligne, total: { centimes: 900, devise: "EUR" as const } };
    await depots().depenses.enregistrer({ id: nouvelId("dep"), videoId: v.id, lignes: [ligne2], total: ligne2.total, date, creeLe: date, modifieLe: date } as never);
    const r2 = await dcv.executerRolePourVideo(v.id, roleRelectureFacecam, entree, { etape: "Face caméra animée · mise en scène", plafondPropre } as never);
    expect(!r2.ok && r2.message).not.toMatch(/€|\$/);
    expect(!r2.ok && r2.message).toMatch(/Arrêt de sécurité/);
  }, 30_000);
});
