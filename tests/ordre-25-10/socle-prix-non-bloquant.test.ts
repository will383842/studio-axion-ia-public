/**
 * Socle « le prix ne bloque jamais » (règle produit du 25/10/2026) : en mode indicatif, un lancement de l'utilisateur sans
 * confirmation de prix part quand même ; le prix accepté est écrit au journal. Témoins : en mode bloquant et pour une
 * commande de l'Usine, les gardes d'avant restent. Dépôts en mémoire, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const modeBudget = await import("@/services/mode-budget");
const { lancerAvecAccord } = await import("@/services/creation-format");
const { CLE_MODE_BUDGET } = modeBudget;
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "socle-prix-non-bloquant";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (etape: string, c: number, fournisseur = "simulation"): LigneCout => ({ etape, fournisseur, unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne("Voix", c)], total: eur(c) });
const estimationDouble = (c: number) => ({ lignes: [ligne("Double, angle principal", c, "heygen")], total: eur(c) });
/** HeyGen avec un solde LU confortable : seul l'accord de prix est en jeu. */
const heygenRiche = (solde: number) => ({ fournisseur: "heygen", nom: "HeyGen", mode: "reel", urlRecharge: "https://exemple.invalid", variableCle: "HEYGEN_API_KEY", async lireSolde() { return { fournisseur: "heygen", centimes: solde, devise: "USD", luLe: new Date().toISOString() }; }, async testerConnexion() { return { ok: true, finCle: "…0000", message: "ok", testeLe: new Date().toISOString() }; } }) as never;
const journalDuPrix = async () => (await depots().evenements.lister()).filter((e) => /accepté sans confirmation/.test(e.message));

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai([heygenRiche(1_000_000)], ["heygen"]);
  await auth.seConnecter(MDP, false);
  await ecrireParametre("budget.mensuel", eur(1_000_000));
  await ecrireParametre("budget.seuilConfirmation", eur(1000));
  const { moisParis } = await import("@/services/couts");
  await ecrireParametre(`budget.usine.${moisParis()}`, { budget_mensuel_cents: 1_000_000, mois: moisParis(), le: new Date().toISOString() });
});

describe("mode indicatif : le prix ne bloque pas", () => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, "indicatif");
  });

  it("(1) au-dessus du seuil, accord=false, origine studio : rien n'est levé", async () => {
    await expect(credits.verifierBudgetEtCredits(estimation(2000), false, "Cette vidéo", { origine: "studio" })).resolves.toBeUndefined();
    await expect(credits.verifierBudgetEtCredits(estimation(2000), undefined, "Cette vidéo")).resolves.toBeUndefined();
  });

  it("(2) le double réel sans accord ne lève plus", async () => {
    await expect(credits.verifierBudgetEtCredits(estimationDouble(150), false, "Cette vidéo")).resolves.toBeUndefined();
    await expect(credits.verifierBudgetEtCredits(estimationDouble(150), undefined, "Cette vidéo", { origine: "studio" })).resolves.toBeUndefined();
  });

  it("(3) lancerAvecAccord sans accord : lancée, le lanceur reçoit le montant", async () => {
    const lancer = vi.fn(async () => ({ travailId: "trav-essai" }));
    const issue = await lancerAvecAccord("v-essai", undefined, 500, { lancer });
    expect(issue).toEqual({ statut: "lancee", travailId: "trav-essai" });
    expect(lancer).toHaveBeenCalledWith("v-essai", 500);
  });

  it("(5) le journal dit « Prix X € accepté sans confirmation »", async () => {
    await credits.verifierBudgetEtCredits(estimation(2000), false, "Cette vidéo");
    const lignes = await journalDuPrix();
    expect(lignes.length).toBeGreaterThan(0);
    expect(lignes[0].message).toMatch(/^Prix .*€ accepté sans confirmation/);
  });

  it("un accord déjà suffisant n'est pas remplacé ni journalisé ; un accord trop bas est relevé au prix du jour", async () => {
    expect(await modeBudget.accordAutomatique(5000, 2000)).toBe(5000);
    expect(await journalDuPrix()).toHaveLength(0);
    expect(await modeBudget.accordAutomatique(100, 2000)).toBe(2000);
    expect(await modeBudget.accordAutomatique(false, 2000)).toBe(2000);
  });

  it("l'Usine garde le sien : accord rendu inchangé, confirmation toujours exigée", async () => {
    expect(await modeBudget.accordAutomatique(false, 2000, { origine: "usine" })).toBe(false);
    await expect(credits.verifierBudgetEtCredits(estimation(2000), false, "Cette vidéo", { origine: "usine" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await expect(credits.reserverPourUsine(estimation(10), true, "Cette vidéo", { videoId: "v-u", travailId: "trv-u" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
  });

  it("sous le seuil, accord false : rien au journal, aucune cloche ; à 0 € non plus", async () => {
    await credits.verifierBudgetEtCredits(estimation(500), false, "Cette vidéo");
    await credits.verifierBudgetEtCredits(estimation(0), false, "Cette vidéo", { videoId: "v-zero" });
    await modeBudget.accordAutomatique(false, 0, { signaler: true });
    expect(await journalDuPrix()).toHaveLength(0);
    expect((await depots().notifications.lister()).filter((n) => n.titre === "Prix accepté sans confirmation")).toHaveLength(0);
  });

  it("GARDE : un crédit réel insuffisant lève toujours CREDIT_INSUFFISANT", async () => {
    credits.injecterLecteursPourEssai([heygenRiche(10)], ["heygen"]);
    const voix: LigneCout = { etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 10_000, prixUnitaire: eur(0.02), total: eur(200), nature: "estime" };
    await expect(credits.verifierBudgetEtCredits({ lignes: [voix], total: eur(200) }, false, "Cette vidéo")).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
  });

  it("avecAccordAutomatique : UNE seule relance, jamais de boucle", async () => {
    const appel = vi.fn(async () => ({ statut: "accord-requis" as const, centimes: 700 }));
    const issue = await modeBudget.avecAccordAutomatique(appel, undefined);
    expect(issue.statut).toBe("accord-requis");
    expect(appel).toHaveBeenCalledTimes(2);
    expect(appel).toHaveBeenLastCalledWith(700);
    const ok = vi.fn(async (a?: number) => (a === undefined ? { statut: "accord-requis" as const, centimes: 700 } : { statut: "lancee" as const }));
    expect((await modeBudget.avecAccordAutomatique(ok, undefined)).statut).toBe("lancee");
    expect(ok).toHaveBeenCalledTimes(2);
  });

  it("la cloche de dépassement : journal toujours, une seule cloche par jour et par vidéo, aucun envoi (push / e-mail)", async () => {
    await modeBudget.signalerDepassementIndicatif("v-a", "Prix accepté", "Essai");
    await modeBudget.signalerDepassementIndicatif("v-a", "Prix accepté", "Essai");
    await modeBudget.signalerDepassementIndicatif("v-b", "Prix accepté", "Essai");
    const cloches = (await depots().notifications.lister()).filter((n) => n.titre === "Prix accepté");
    expect(cloches).toHaveLength(2);
    const { canauxPour } = await import("@/services/notifications");
    for (const n of cloches) expect(canauxPour(n, { canal: "push" } as never, { push: true })).toEqual({ push: false, email: false, emailSiPushEchoue: false });
    expect(cloches.every((n) => !n.envoi?.emailForce)).toBe(true);
    expect((await depots().evenements.lister()).filter((e) => e.type === "budget" && e.message === "Essai")).toHaveLength(3);
  });
});

describe("TÉMOINS — mode bloquant : comme avant", () => {
  beforeEach(async () => {
    await ecrireParametre(CLE_MODE_BUDGET, "bloquant");
  });

  it("avecAccordAutomatique n'appelle `appel` qu'une fois : l'accord reste refusé, aucune relance", async () => {
    const appel = vi.fn(async () => ({ statut: "accord-requis" as const, centimes: 700 }));
    const issue = await modeBudget.avecAccordAutomatique(appel, undefined);
    expect(issue.statut).toBe("accord-requis");
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("verifierBudgetEtCredits lève CONFIRMATION_REQUISE au-dessus du seuil, et pour le double réel", async () => {
    await expect(credits.verifierBudgetEtCredits(estimation(2000), false, "Cette vidéo", { origine: "studio" })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    await expect(credits.verifierBudgetEtCredits(estimationDouble(150), false, "Cette vidéo")).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect(await journalDuPrix()).toHaveLength(0);
  });

  it("lancerAvecAccord sans accord rend accord-requis, rien n'est lancé", async () => {
    const lancer = vi.fn(async () => ({ travailId: "trav-essai" }));
    expect(await lancerAvecAccord("v-essai", undefined, 500, { lancer })).toMatchObject({ statut: "accord-requis", centimes: 500 });
    expect(lancer).not.toHaveBeenCalled();
  });
});
