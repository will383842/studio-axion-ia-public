/**
 * NEW-ARG-06 — aucun montant dans la cloche, le journal ni le texte du comité.
 * Deux volets : (1) les messages visibles ne citent plus aucune somme ; (2) les DÉCISIONS (refus, autorisation,
 * valeurs enregistrées, nombre `centimesEur`) restent celles d'avant. Dépôts en mémoire, aucun réseau, données fictives.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const comite = await import("@/services/comite-editorial");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { creerLecteurFal } = await import("@/fournisseurs/credits/suivis");
const dom = await import("@/domaine/credits");
const { reglerBudgetUsine } = await import("@/services/budget-mensuel");

const MDP = "new-arg-06";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
let n = 0;
const demande = () => ({ videoId: `v-na6-${++n}`, travailId: `trv-na6-${n}` });
/** Aucun symbole ni mot monétaire, aucun chiffre collé à une monnaie. */
const SANS_MONTANT = (t: string) => {
  expect(t).not.toMatch(/€|\$|\beuros?\b|\bdollars?\b|\busd\b|\beur\b/i);
  expect(t).not.toMatch(/\d\s*(€|\$|euros?|dollars?)/i);
};
const journal = async () => (await depots().evenements.lister()).map((e) => e.message ?? "");

/** Valeur de `centimesEur` relevée AVANT le changement de texte (le nombre ne doit pas bouger). */
const CENTIMES_EUR_AVANT = 31; // relevé sur master : texte d'alors « ≈ 0,31 € au plus »

beforeAll(async () => {
  process.env.SESSION_SECRET = "k".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai([], []);
  await auth.seConnecter(MDP, false);
  await ecrireParametre("budget.mensuel", eur(1_000_000));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
});

describe("journal : refus de l'Usine (plafond du mois)", () => {
  it("le début de phrase est gardé, aucun montant ; la décision (refus + rien réservé) est la même", async () => {
    await ecrireParametre("usine.autonomie", { actif: true, plafondCents: 3_000, le: new Date().toISOString(), version: 1 });
    const d = demande();
    const avant = await depots().reservations.compter();
    await expect(credits.reserverPourUsine(estimation(3_001), undefined, "Cette vidéo", d)).rejects.toMatchObject({
      code: "USINE_PLAFOND_ATTEINT",
      message: "Plafond du mois de l'Usine atteint : cette commande le dépasserait, rien n'est parti. Le plafond se règle dans l'Usine.",
    });
    expect(await depots().reservations.compter()).toBe(avant);
    expect(await lireParametre(`budget.engage.${d.travailId}`, null)).toBeNull();
    const refus = (await journal()).filter((m) => m.startsWith("Refus de l'Usine (plafond du mois)"));
    expect(refus).toEqual(["Refus de l'Usine (plafond du mois) : Cette vidéo"]);
    for (const m of refus) SANS_MONTANT(m);
  });

  it("au plafond exact : toujours accepté (autorisation inchangée) ; +1 centime : refus", async () => {
    await ecrireParametre("usine.autonomie", { actif: true, plafondCents: 3_000, le: new Date().toISOString(), version: 1 });
    await expect(credits.reserverPourUsine(estimation(3_000), undefined, "Cette vidéo", demande())).resolves.toBeUndefined();
    await expect(credits.reserverPourUsine(estimation(1), undefined, "Cette vidéo", demande())).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
  });

  it("autonomie éteinte : décision inchangée (confirmation requise), aucun journal de refus", async () => {
    await reglerBudgetUsine({ budget_mensuel_cents: 100_000 });
    await expect(credits.reserverPourUsine(estimation(3_000), undefined, "Cette vidéo", demande())).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    expect((await journal()).some((m) => m.startsWith("Refus de l'Usine"))).toBe(false);
  });
});

describe("journal : recharge déclarée", () => {
  it("« Recharge X enregistrée », sans montant ; la valeur enregistrée et les refus de saisie sont inchangés", async () => {
    credits.injecterLecteursPourEssai([creerLecteurFal({ FAL_KEY: "fal_essai_0123456789abcdef" })], ["fal"]);
    await credits.declarerRecharge("fal", 2000);
    const lignes = (await journal()).filter((m) => m.startsWith("Recharge "));
    expect(lignes).toEqual(["Recharge fal.ai enregistrée"]);
    for (const m of lignes) SANS_MONTANT(m);
    const recharges = await depots().recharges.lister();
    expect(recharges).toHaveLength(1);
    expect(recharges[0]).toMatchObject({ fournisseur: "fal", centimes: 2000, devise: "USD" });
    // Refus de saisie inchangés.
    for (const mauvais of [0, -5, 1_000_001, Number.NaN]) {
      await expect(credits.declarerRecharge("fal", mauvais)).rejects.toMatchObject({ code: "MONTANT_INVALIDE" });
    }
    expect(await depots().recharges.compter()).toBe(1);
  });
});

describe("cloche et e-mail : crédits bientôt expirés", () => {
  it("« Une partie de vos crédits X expire le JJ/MM/AAAA. » : date gardée, aucun montant ; un seul rappel", async () => {
    credits.injecterLecteursPourEssai([creerLecteurFal({ FAL_KEY: "fal_essai_0123456789abcdef" })], ["fal"]);
    const achat = new Date(Date.now() - 340 * 86_400_000).toISOString();
    const expireLe = dom.expirationParDefaut("fal", achat)!;
    await depots().recharges.enregistrer({ id: "r-na6", fournisseur: "fal", centimes: 2500, devise: "USD", date: achat, expireLe, creeLe: achat, modifieLe: achat });
    await credits.surveillerCredits({ force: true });
    await credits.surveillerCredits({ force: true });
    const alertes = await depots().notifications.lister((x) => x.type === "credit" && x.titre.includes("bientôt expirés"));
    expect(alertes).toHaveLength(1);
    expect(alertes[0].titre).toBe("Crédits fal.ai bientôt expirés");
    expect(alertes[0].message).toBe(`Une partie de vos crédits fal.ai expire le ${new Date(expireLe).toLocaleDateString("fr-FR")}.`);
    expect(alertes[0].message).toMatch(/\d{2}\/\d{2}\/\d{4}\.$/);
    SANS_MONTANT(alertes[0].titre);
    SANS_MONTANT(alertes[0].message.replace(/\d{2}\/\d{2}\/\d{4}/, "DATE"));
  });
});

describe("comité éditorial : prix du jugement à la demande", () => {
  it("texte sans montant, « au plus » gardé ; `centimesEur` (nombre) inchangé ", async () => {
    await ecrireParametre(comite.PARAM_COMITE, true);
    const prix = await comite.prixJugementDirect();
    expect(prix.centimesEur).toBe(CENTIMES_EUR_AVANT);
    expect(prix.texte).toBe("Prix au plus fixé avant le lancement");
    expect(prix.texte).toMatch(/au plus/);
    SANS_MONTANT(prix.texte);
    // Le refus « prix vu trop bas » (garde d'argent, code non touché) est prouvé par tests/comite-editorial.test.ts (faux Claude).
  });
});
