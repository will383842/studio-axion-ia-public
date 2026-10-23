/**
 * Budget INDICATIF — écriture des scripts (PR B, suite de #606). Faux `fetch`, aucun réseau, 0 €.
 * Mode indicatif : le plafond du sujet et la limite Claude du mois PRÉVIENNENT (journal + une cloche par jour et par motif)
 * et l'écriture continue ; seul l'arrêt de sécurité (5 × le plafond du sujet) arrête encore. Pas de plafond mensuel dur.
 * Mode bloquant (retour arrière) et commande de l'Usine : comportement d'avant, tout refuse.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const serie = await import("@/services/serie-ecriture");
const { ecrireParametre } = await import("@/services/_commun");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
import { roleSonde } from "@/generateur/roles/sonde";
import type { GenerationScript, LigneCout } from "@/domaine/types";

const MDP = "essai-budget-indicatif-ecriture";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
const fetchInterdit = (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch;

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, fetchInterdit)], ["anthropic"]);
});
afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

const entree = { contexte: { contexteAxion: "Axion-IA : formations IA pour dirigeants." }, variable: "<brief>Les PV</brief>" };

let n = 0;
/** `dejaUsd` : un appel d'une étape précédente encore compté (pire cas d'une étape lancée), pour placer l'écriture entre 1 × et 5 × le plafond. */
async function generation(plafondUsd = 1.5, dejaUsd = 0): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const etapes = dejaUsd ? [{ role: "x", versionConsigne: 1, modeleDemande: "claude-sonnet-5-5", effort: "low", appelId: `appel-deja-${n + 1}`, lanceLe: le, estimationPireCasUsd: dejaUsd } as never] : [];
  const g: GenerationScript = { id: `gen-bie-${++n}`, scriptMaitreId: `suj-bie-${n}`, hachageContexte: "h", plafondUsd, portee: "sujet", etapes, statut: "en-cours", essai: false, creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const appels: unknown[] = [];
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    appels.push(init?.body);
    return reponseFlux(fluxReussi({ texte: JSON.stringify({ phrase: "ok" }), modele: "claude-sonnet-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
  return appels;
}

const cloches = async (motif: RegExp) => (await depots().notifications.lister()).filter((x) => x.type === "budget" && motif.test(x.titre));

describe("plafond du SUJET (réservation par appel)", () => {
  it("mode bloquant : au-dessus du plafond, refus (comme avant)", async () => {
    const g = await generation();
    expect(await gc.reserverDansPlafondSujet(g.id, "a1", 2)).toEqual({ ok: false, plafondUsd: 1.5 });
  });

  it("mode indicatif : au-dessus du plafond mais sous 5 ×, l'appel part, Will est prévenu UNE fois par jour", async () => {
    const g = await generation();
    expect(await gc.reserverDansPlafondSujet(g.id, "a1", 2, true)).toEqual({ ok: true });
    expect(await gc.reserverDansPlafondSujet(g.id, "a2", 2, true)).toEqual({ ok: true });
    expect(await cloches(/Plafond du sujet/)).toHaveLength(1);
  });

  it("mode indicatif : au-delà de 5 × le plafond du sujet, arrêt de sécurité (rien n'est réservé)", async () => {
    const g = await generation();
    expect(await gc.reserverDansPlafondSujet(g.id, "a1", 8, true)).toMatchObject({ ok: false, plafondUsd: 1.5, securite: true });
    // la place n'a pas été prise : un petit appel passe encore
    expect(await gc.reserverDansPlafondSujet(g.id, "a2", 1, true)).toEqual({ ok: true });
  });
});

describe("executerRoleFacture (écriture réelle, faux Claude)", () => {
  it("indicatif : plafond du sujet dépassé (sous 5 ×) → l'écriture PART ; bloquant → « plafond-atteint », aucun appel", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    // 2 $ déjà engagés sur un plafond de 1,50 $ : entre 1 × et 5 ×
    const appels = brancherClaude();
    await ecrireParametre("budget.mode", "bloquant");
    const g1 = await generation(1.5, 2);
    expect(await gc.executerRoleFacture(g1.id, roleSonde, entree)).toMatchObject({ ok: false, arret: "plafond-atteint" });
    expect(appels).toHaveLength(0);
    await ecrireParametre("budget.mode", "indicatif");
    const g2 = await generation(1.5, 2);
    const r = await gc.executerRoleFacture(g2.id, roleSonde, entree);
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
  });

  it("indicatif : 5 × dépassé → arrêt de sécurité, message clair, aucun appel", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const g = await generation(1.5, 8);
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(r).toMatchObject({ ok: false, arret: "plafond-atteint" });
    expect(!r.ok && r.message).toMatch(/Arrêt de sécurité : cette écriture dépasserait 5 fois le prix annoncé/);
    expect(appels).toHaveLength(0);
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("plafond-atteint");
  });

  it("Usine : le plafond du sujet reste BLOQUANT même en indicatif", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    await ecrireParametre("budget.mode", "indicatif");
    const appels = brancherClaude();
    const g = await generation(1.5, 2);
    expect(await gc.executerRoleFacture(g.id, roleSonde, entree, { origine: "usine" })).toMatchObject({ ok: false, arret: "plafond-atteint" });
    expect(appels).toHaveLength(0);
  });

  it("limite Claude DU MOIS : indicatif → alerte seulement, l'écriture part ; bloquant → en attente ; Usine → en attente", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    const appels = brancherClaude();
    await ecrireParametre(gc.PARAM_PLAFOND_MENSUEL, 0.0001);
    await ecrireParametre("budget.mode", "bloquant");
    expect(await gc.executerRoleFacture((await generation()).id, roleSonde, entree)).toMatchObject({ ok: false, arret: "en-attente-credit" });
    await ecrireParametre("budget.mode", "indicatif");
    expect(await gc.executerRoleFacture((await generation()).id, roleSonde, entree, { origine: "usine" })).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(appels).toHaveLength(0);
    const r = await gc.executerRoleFacture((await generation()).id, roleSonde, entree);
    expect(r.ok).toBe(true);
    expect(appels).toHaveLength(1);
    expect(await cloches(/Claude du mois/)).toHaveLength(1);
  });
});

describe("pire cas de la chaîne (avant le premier appel de chaque tour)", () => {
  it("bloquant : pire cas > plafond → refus, statut « plafond-atteint » (comme avant)", async () => {
    const g = await generation();
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 2 })).toMatchObject({ ok: false });
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("plafond-atteint");
  });

  it("indicatif : pire cas entre 1 × et 5 × → l'écriture part (alerte), le statut ne change pas", async () => {
    const g = await generation();
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 2, indicatif: true })).toEqual({ ok: true });
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("en-cours");
    expect(await cloches(/Plafond du sujet/)).toHaveLength(1);
  });

  it("indicatif : pire cas au-delà de 5 × → arrêt de sécurité, rien ne part", async () => {
    const g = await generation();
    const r = await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 8, indicatif: true });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.message).toMatch(/Arrêt de sécurité/);
    expect((await depots().generations.obtenir(g.id))?.statut).toBe("plafond-atteint");
  });

  it("indicatif : la reprise ne repaie rien — la dépense déjà faite compte dans le seuil de 5 ×", async () => {
    const g = await generation();
    await depots().generations.modifier(g.id, { etapes: [{ role: "x", versionConsigne: 1, modeleDemande: "claude-sonnet-5-5", effort: "low", appelId: "appel-deja", lanceLe: "2026-10-23T08:00:00Z", estimationPireCasUsd: 7 } as never] });
    // 7 $ déjà dépensés + 1 $ restant = 8 $ > 7,5 $ (5 × 1,5 $) : arrêt de sécurité, même en indicatif
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 1, indicatif: true })).toMatchObject({ ok: false });
  });
});

describe("écriture en série", () => {
  const base = { demandees: 10, prixUnitaireCentimes: 140, restantBudgetCentimes: 599, plafondSujetUsdCentimes: 150, restantClaudeUsdCentimes: 10_000, essai: false };
  it("bloquant : seules les idées couvertes partent (inchangé)", () => {
    expect(serie.calculerPlanSerie(base)).toEqual({ partiront: 4, limite: "budget" });
  });
  it("indicatif : tout part, la limite reste affichée en information", () => {
    expect(serie.calculerPlanSerie({ ...base, indicatif: true })).toEqual({ partiront: 10, limite: "budget" });
    expect(serie.calculerPlanSerie({ ...base, restantBudgetCentimes: 100_000, restantClaudeUsdCentimes: 449, indicatif: true })).toEqual({ partiront: 10, limite: "claude" });
  });
  it("indicatif : rien ne dépasse le nombre demandé, et sans manque il n'y a pas de limite", () => {
    expect(serie.calculerPlanSerie({ ...base, restantBudgetCentimes: 100_000, indicatif: true })).toEqual({ partiront: 10 });
  });
});

describe("arrêt de sécurité : phrase et plafond d'origine", () => {
  it("l'arrêt par appel, avec une réserve de chaîne déjà posée : la réserve devient « sécurité » (l'écran dit la bonne phrase)", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    await ecrireParametre("budget.mode", "indicatif");
    brancherClaude();
    const g = await generation(1.5, 7.5);
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 0, indicatif: true })).toEqual({ ok: true });
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(!r.ok && r.message).toMatch(/dépasserait 5 fois le prix annoncé \(1,50 \$\), rien de plus n'est payé/);
    expect(await gc.lireReserveChaine(g.id)).toMatchObject({ accepte: false, securite: true });
    expect(await gc.phraseReserveRefusee(g.id)).toMatch(/dépasserait 5 fois le prix annoncé \(1,50 \$\)/);
  });

  it("l'arrêt par appel d'une écriture « sans réserve » (déjà en route) n'écrit AUCUNE réserve : elle reste au régime appel par appel", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    await ecrireParametre("budget.mode", "indicatif");
    brancherClaude();
    const g = await generation(1.5, 8);
    expect(await gc.ecritureSansReserve(g)).toBe(true);
    const r = await gc.executerRoleFacture(g.id, roleSonde, entree);
    expect(!r.ok && r.message).toMatch(/Arrêt de sécurité/);
    expect(await gc.lireReserveChaine(g.id)).toBeNull();
    expect(await gc.ecritureSansReserve((await depots().generations.obtenir(g.id))!)).toBe(true);
  });

  it("le « prix annoncé » affiché est le plafond d'ORIGINE, sans la part relevée après des pannes", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const g = await generation(1.5, 2);
    await gc.releverPlafondApresPannes(g.id, 5);
    const r = await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 50, indicatif: true });
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.message).toMatch(/\(1,50 \$\)/);
    expect(await gc.phraseReserveRefusee(g.id)).toMatch(/\(1,50 \$\)/);
  });

  it("limiteSecuriteUsd : le relèvement du devis de reprise s'ajoute à 1 ×, il n'est pas multiplié par 5", () => {
    const g = { plafondUsd: 3.5, etapes: [], appelsReleves: [] };
    // plafond 3,50 $ qui INCLUT déjà 2 $ de relèvement pas encore noté dans appelsReleves : 5 × 1,50 + 2 = 9,50 $
    expect(gc.limiteSecuriteUsd(g, 2)).toBeCloseTo(9.5, 6);
    expect(gc.plafondAnnonceUsd(g, 2)).toBeCloseTo(1.5, 6);
    // sans relèvement : 5 × 3,50
    expect(gc.limiteSecuriteUsd(g)).toBeCloseTo(17.5, 6);
  });


  it("plafond relevé après des pannes : le facteur 5 s'applique au plafond d'ORIGINE, la part relevée s'ajoute à 1 ×", async () => {
    const g = await generation(1.5, 2); // 2 $ d'un appel resté sans réponse
    expect(await gc.releverPlafondApresPannes(g.id, 5)).toBeCloseTo(2, 6);
    expect((await depots().generations.obtenir(g.id))!.plafondUsd).toBeCloseTo(3.5, 6);
    // limite de sécurité = 5 × 1,50 + 2 = 9,50 $ (et non 5 × 3,50 = 17,50 $) ; 2 $ déjà comptés
    expect(await gc.reserverDansPlafondSujet(g.id, "b1", 7.4, true)).toEqual({ ok: true });
    expect(await gc.reserverDansPlafondSujet(g.id, "b2", 1, true)).toMatchObject({ ok: false, securite: true });
  });
});

describe("confirmation de prix : seulement après un geste de reprise de Will", () => {
  const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
  const est = (c: number) => ({ lignes: [{ etape: "x", fournisseur: "anthropic", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" } as LigneCout], total: eur(c) });
  beforeEach(async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("budget.seuilConfirmation", eur(100));
    await ecrireParametre("budget.mensuel", eur(1_000_000));
    await credits.declarerRecharge("anthropic", 100_000);
  });

  it("verifierEtReserverSelonOrigine : sans « automatique » le seuil est exigé ; avec, il ne l'est plus ; l'Usine l'exige TOUJOURS", async () => {
    await expect(credits.verifierEtReserverSelonOrigine(undefined, est(500), false, "Cette écriture", { travailId: "t-1" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await expect(credits.verifierEtReserverSelonOrigine(undefined, est(500), false, "Cette écriture", { travailId: "t-2" }, { automatique: true })).resolves.toBeUndefined();
    const { moisParis } = await import("@/services/couts");
    await ecrireParametre(`budget.usine.${moisParis()}`, { budget_mensuel_cents: 1_000_000, mois: moisParis(), le: new Date().toISOString() });
    await expect(credits.verifierEtReserverSelonOrigine("usine", est(500), false, "Cette écriture", { travailId: "t-3" }, { automatique: true })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
  });

  it("premier tour d'un lancement de Will : seuil exigé (en attente « seuil ») ; après le geste « Reprendre » de Will : l'écriture part", async () => {
    await ecrireParametre("fournisseur.script", "claude");
    await ecrireParametre("budget.seuilConfirmation", eur(0));
    const appels = brancherClaude();
    const g = await generation();
    expect(await gc.executerRoleFacture(g.id, roleSonde, entree)).toMatchObject({ ok: false, arret: "en-attente-credit" });
    expect(appels).toHaveLength(0);
    await depots().generations.modifier(g.id, { statut: "en-cours" });
    await gc.marquerRepriseDeWill(g.id);
    expect((await gc.executerRoleFacture(g.id, roleSonde, entree)).ok).toBe(true);
    expect(appels).toHaveLength(1);
  });
});
