/**
 * Budgets INDICATIFS, jamais bloquants (décision de Will, 23/10 : « oui tout selon tes recommandations »).
 * Interrupteur unique `budget.mode` = "indicatif" | "bloquant". En indicatif, les SEUILS ne refusent plus : ils préviennent
 * Will (cloche, une fois par jour et par motif) et la fabrication continue. Restent durs dans les deux modes : les gardes de
 * l'Usine, le double réel, le solde réel HeyGen / ElevenLabs, l'arrêt de sécurité à 5 × le prix annoncé.
 * Dépôts en mémoire, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const modeBudgetMod = await import("@/services/mode-budget");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "budget-indicatif-essai";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number, fournisseur = "simulation"): LigneCout => ({ etape: "Voix", fournisseur, unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number, fournisseur = "simulation") => ({ lignes: [ligne(c, fournisseur)], total: eur(c) });
let n = 0;
const demande = () => ({ videoId: `v-bi-${++n}`, travailId: `trv-bi-${n}` });
const sansReseau = (async () => {
  throw new Error("aucun appel attendu");
}) as unknown as typeof fetch;

function heygenEssai(solde: number): LecteurCredit {
  return {
    fournisseur: "heygen",
    nom: "HeyGen",
    mode: "reel",
    urlRecharge: "https://app.heygen.com/settings/api",
    variableCle: "HEYGEN_API_KEY",
    async lireSolde() {
      return { fournisseur: "heygen", centimes: solde, devise: "USD", luLe: new Date().toISOString() };
    },
    async testerConnexion() {
      return { ok: true, finCle: "…0000", message: "Clé acceptée", testeLe: new Date().toISOString() };
    },
  };
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "b".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai([], []);
  await auth.seConnecter(MDP, false);
  for (const d of await depots().depenses.lister()) await depots().depenses.supprimer(d.id);
  await ecrireParametre("budget.seuilConfirmation", eur(1_000_000));
  await ecrireParametre("budget.mensuel", eur(100));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
});

const notesBudget = async () => (await depots().notifications.lister()).filter((x) => x.type === "budget");

describe("l'interrupteur budget.mode", () => {
  it("dans les tests, le défaut du code est « bloquant » (variable de vitest) ; le réglage en base l'emporte", async () => {
    expect(await modeBudgetMod.modeBudget()).toBe("bloquant");
    await ecrireParametre("budget.mode", "indicatif");
    expect(await modeBudgetMod.modeBudget()).toBe("indicatif");
    expect(await modeBudgetMod.budgetIndicatif()).toBe(true);
    await ecrireParametre("budget.mode", "n'importe quoi");
    expect(await modeBudgetMod.modeBudget()).toBe("bloquant"); // illisible : le défaut du code
  });
});

describe("mode bloquant : comportement actuel inchangé", () => {
  it("le dépassement du mois refuse toujours (BUDGET_DEPASSE)", async () => {
    await ecrireParametre("budget.mode", "bloquant");
    await credits.verifierEtReserver(estimation(90), true, "Cette vidéo", demande());
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
  });
});

describe("mode indicatif : le plafond du mois ne refuse plus", () => {
  beforeEach(() => ecrireParametre("budget.mode", "indicatif"));

  it("au-delà du plafond : rien n'est levé, la réservation et l'engagement sont posés, Will est prévenu UNE fois par jour", async () => {
    await credits.verifierEtReserver(estimation(90), true, "Cette vidéo", demande());
    const d2 = demande();
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", d2)).resolves.toBeUndefined();
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).resolves.toBeUndefined();
    const notes = await notesBudget();
    expect(notes.filter((x) => /indicatif/i.test(x.titre))).toHaveLength(1);
    // La comptabilité continue : l'engagement du travail est bien posé (seul le refus disparaît).
    expect((await (await import("@/services/couts")).resumeBudget()).engage.centimes).toBe(130);
  });

  it("l'Usine reste BLOQUANTE : budget absent, budget atteint, et plafond du studio dépassé", async () => {
    await expect(credits.reserverPourUsine(estimation(10), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    await expect(credits.reserverPourUsine(estimation(500), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    const { moisParis } = await import("@/services/couts");
    await ecrireParametre(`budget.usine.${moisParis()}`, { budget_mensuel_cents: 50, mois: moisParis(), le: new Date().toISOString() });
    await expect(credits.reserverPourUsine(estimation(60), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_MENSUEL_ATTEINT" });
  });

  it("une estimation illisible (NaN) est refusée dans les deux modes", async () => {
    const nan = { lignes: [ligne(10)], total: eur(Number.NaN) };
    await expect(credits.verifierEtReserver(nan, true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_ILLISIBLE" });
  });

  it("un plafond du mois illisible ne bloque plus non plus, mais prévient", async () => {
    await ecrireParametre("budget.mensuel", { devise: "EUR" });
    await expect(credits.verifierEtReserver(estimation(10), true, "Cette vidéo", demande())).resolves.toBeUndefined();
    expect((await notesBudget()).filter((x) => /illisible/i.test(x.titre))).toHaveLength(1);
  });

  it("CREDIT_INSUFFISANT HeyGen reste levé (solde LU chez HeyGen)", async () => {
    await ecrireParametre("budget.mensuel", eur(1_000_000));
    credits.injecterLecteursPourEssai([heygenEssai(10)], ["heygen"]);
    const voix: LigneCout = { etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 10_000, prixUnitaire: eur(0.02), total: eur(200), nature: "estime" };
    await expect(credits.verifierBudgetEtCredits({ lignes: [voix], total: eur(200) }, true, "Cette vidéo")).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
  });

  it("un solde seulement « suivi » (deviné : recharges déclarées moins dépenses, ex. fal.ai) n'oppose plus rien ; en bloquant il oppose toujours", async () => {
    await ecrireParametre("budget.mensuel", eur(1_000_000));
    // Lecteur « suivi » (comme fal.ai) rangé sous un fournisseur payant sans réglage de simulation.
    const suivi: LecteurCredit = { fournisseur: "heygen", nom: "Suivi", mode: "suivi", urlRecharge: "https://exemple.invalid", variableCle: "X_KEY", async testerConnexion() { return { ok: true, finCle: "…0000", message: "ok", testeLe: new Date().toISOString() }; } };
    credits.injecterLecteursPourEssai([suivi], ["heygen"]);
    const debut = new Date(Date.now() - 3600_000).toISOString();
    await depots().recharges.enregistrer({ id: "r1", fournisseur: "heygen", centimes: 100, devise: "USD", date: debut, creeLe: debut, modifieLe: debut });
    const voix: LigneCout = { etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 10_000, prixUnitaire: eur(0.02), total: eur(200), nature: "estime" };
    const est = { lignes: [voix], total: eur(200) };
    await expect(credits.verifierBudgetEtCredits(est, true, "Cette vidéo")).resolves.toBeUndefined();
    await ecrireParametre("budget.mode", "bloquant");
    await expect(credits.verifierBudgetEtCredits(est, true, "Cette vidéo")).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
  });
});

describe("confirmation de prix au-dessus du seuil", () => {
  beforeEach(async () => {
    await ecrireParametre("budget.mensuel", eur(1_000_000));
    await ecrireParametre("budget.seuilConfirmation", eur(1000));
  });

  it("indicatif : un lancement fait à la main par Will au-dessus du seuil exige TOUJOURS la confirmation", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await expect(credits.verifierBudgetEtCredits(estimation(2000), false, "Cette vidéo")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await expect(credits.verifierBudgetEtCredits(estimation(2000), 2000, "Cette vidéo")).resolves.toBeUndefined();
  });

  it("indicatif : un lancement AUTOMATIQUE (relance) ne l'exige plus ; en bloquant, il l'exige encore", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await expect(credits.verifierBudgetEtCredits(estimation(2000), false, "Cette relance", { automatique: true })).resolves.toBeUndefined();
    await ecrireParametre("budget.mode", "bloquant");
    await expect(credits.verifierBudgetEtCredits(estimation(2000), false, "Cette relance", { automatique: true })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
  });

  it("l'Usine garde sa confirmation même en automatique et en indicatif", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await expect(credits.verifierBudgetEtCredits(estimation(2000), false, "Cette vidéo", { automatique: true, origine: "usine" })).rejects.toBeTruthy();
  });
});
