/**
 * L1-09 (chantier Usine, 18/10) — plafond mensuel global et budget envoyé par l'Usine (porte v2, § 3 quater, appel 5).
 *  - le plafond du mois se règle UNIQUEMENT dans le studio (`budget.mensuel`, Will connecté) ;
 *  - l'Usine envoie un budget du mois TOUJOURS sous ce plafond (`reglerBudgetUsine`, seul endroit d'écriture) ;
 *  - `plafond_cents` d'une commande est borné par le plafond d'UN SUJET du studio (L3-0, détail dans l3-0-prerequis-argent) ;
 *  - sans budget reçu pour le mois, aucune fabrication commandée par l'Usine ne part ; la commande de Will n'est pas touchée ;
 *  - au passage commun (`verifierEtReserver`) : dépassement → refus AVANT toute réservation, et alerte à Will ;
 *  - réglage illisible → refus ; sommes en centimes entiers ; reprise du même travail sans double comptage.
 * Dépôts en mémoire, lecteurs de solde vides, aucune clé, aucun réseau, 0 €.
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
const couts = await import("@/services/couts");
const budget = await import("@/services/budget-mensuel");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");

const MDP = "l1-09-budget-mensuel";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
let n = 0;
const demande = () => ({ videoId: `v-l109-${++n}`, travailId: `trv-l109-${n}` });
const moisCourant = () => couts.moisParis();

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
  // Mois propre : aucune dépense réelle, seuil de confirmation hors jeu.
  for (const d of await depots().depenses.lister()) await depots().depenses.supprimer(d.id);
  await ecrireParametre("budget.seuilConfirmation", eur(1_000_000));
  await ecrireParametre("budget.mensuel", eur(100));
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

const notificationsBudget = async () => (await depots().notifications.lister()).filter((x) => x.type === "budget");

describe("plafond du mois du studio (commande de Will)", () => {
  it("plafond de test à 100 centimes : exactement au plafond passe, le 2e lancement est refusé avant toute réservation", async () => {
    await credits.verifierEtReserver(estimation(100), true, "Cette vidéo", demande());
    const d2 = demande();
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", d2)).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    expect(await depots().reservations.compter((r) => r.travailId === d2.travailId)).toBe(0);
    expect(await lireParametre(`budget.engage.${d2.travailId}`, null)).toBeNull();
  });

  it("dépassement : refus ET alerte à Will (notification « budget »), une seule fois par jour", async () => {
    await credits.verifierEtReserver(estimation(90), true, "Cette vidéo", demande());
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    const notes = await notificationsBudget();
    expect(notes.filter((x) => x.titre.includes("refusée"))).toHaveLength(1);
  });

  it("deux lancements simultanés sur le même disponible : un seul passe (verrou)", async () => {
    const r = await Promise.allSettled([credits.verifierEtReserver(estimation(60), true, "A", demande()), credits.verifierEtReserver(estimation(60), true, "B", demande())]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(r.filter((x) => x.status === "rejected")).toHaveLength(1);
  });

  it("reprise du MÊME travail : son engagement ne compte pas deux fois", async () => {
    const d = demande();
    await credits.verifierEtReserver(estimation(60), true, "Cette vidéo", d);
    await credits.verifierEtReserver(estimation(60), true, "Cette vidéo", d);
    expect((await couts.resumeBudget()).engage.centimes).toBe(60);
  });

  it.each([
    ["absent de forme", { devise: "EUR" }],
    ["négatif", eur(-5)],
    ["non entier", eur(10.5)],
    ["texte", { centimes: "100", devise: "EUR" }],
    ["NaN", { centimes: Number.NaN, devise: "EUR" }],
  ])("réglage du plafond illisible (%s) → refus, rien de réservé", async (_nom, valeur) => {
    await ecrireParametre("budget.mensuel", valeur);
    const d = demande();
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", d)).rejects.toMatchObject({ code: "BUDGET_ILLISIBLE" });
    expect(await depots().reservations.compter((r) => r.travailId === d.travailId)).toBe(0);
  });

  it("Will ne peut pas écrire un plafond qui ne soit pas un entier de centimes ≥ 0", async () => {
    await expect(couts.definirBudget(Number.NaN)).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
    await expect(couts.definirBudget(-1)).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
    await expect(couts.definirBudget(12.5)).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
    expect(await lireParametre("budget.mensuel", null)).toEqual(eur(100));
  });

  it("aucun flottant dans la somme : des lignes en fractions de centime sont comptées au centime supérieur", async () => {
    // 100,2 c au plafond de 100 c : refusé (101 c au pire), jamais « arrondi à 100 ».
    await expect(credits.verifierEtReserver({ lignes: [ligne(33.4), ligne(33.4), ligne(33.4)], total: eur(100.2) }, true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    await ecrireParametre("budget.mensuel", eur(101));
    await credits.verifierEtReserver({ lignes: [ligne(33.4), ligne(33.4), ligne(33.4)], total: eur(100.2) }, true, "Cette vidéo", demande());
    const vue = await couts.resumeBudget();
    expect(Number.isInteger(vue.engage.centimes)).toBe(true);
    expect(Number.isInteger(vue.restant.centimes)).toBe(true);
    expect(vue.engage.centimes).toBe(101);
    // 100,2 c → 101 c engagés (pire cas) : plus rien ne passe sous 101 c.
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
  });

  it("bornes du mois à Paris : une dépense du 31 octobre 23 h 30 UTC compte en novembre", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T22:30:00Z")); // 23 h 30 à Paris (heure d'hiver) : encore octobre
    await depots().depenses.enregistrer({ id: "dep-oct", date: new Date().toISOString(), lignes: [], total: eur(80), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
    await expect(credits.verifierEtReserver(estimation(30), true, "Cette vidéo", demande())).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    vi.setSystemTime(new Date("2026-10-31T23:30:00Z")); // 0 h 30 à Paris : novembre, le compteur repart
    await credits.verifierEtReserver(estimation(30), true, "Cette vidéo", demande());
  });
});

describe("budget envoyé par l'Usine (porte v2, appel 5)", () => {
  it("unité en centimes entiers : un montant non entier, négatif ou texte est refusé (champ budget_mensuel_cents)", async () => {
    for (const v of [12.5, -1, Number.NaN, "50", null]) {
      await expect(budget.reglerBudgetUsine({ budget_mensuel_cents: v as number, mois: moisCourant() })).rejects.toMatchObject({ code: "CHAMP_INVALIDE", champ: "budget_mensuel_cents" });
    }
    expect(await budget.lireBudgetUsine()).toBeNull();
  });

  it("mois mal formé ou passé → refus (champ mois)", async () => {
    for (const mois of ["2026-13", "26-10", "", couts.decalerMois(moisCourant(), -1)]) {
      await expect(budget.reglerBudgetUsine({ budget_mensuel_cents: 50, mois })).rejects.toMatchObject({ code: "CHAMP_INVALIDE", champ: "mois" });
    }
  });

  it("valeur de l'Usine au-dessus du plafond du studio → refus, rien n'est écrit", async () => {
    await expect(budget.reglerBudgetUsine({ budget_mensuel_cents: 101, mois: moisCourant() })).rejects.toMatchObject({ code: "CHAMP_INVALIDE", champ: "budget_mensuel_cents" });
    expect(await budget.lireBudgetUsine()).toBeNull();
    // Égal au plafond : accepté.
    expect(await budget.reglerBudgetUsine({ budget_mensuel_cents: 100, mois: moisCourant() })).toMatchObject({ deja: false });
  });

  it("plafond du studio illisible → l'Usine ne peut rien régler", async () => {
    await ecrireParametre("budget.mensuel", eur(Number.NaN));
    await expect(budget.reglerBudgetUsine({ budget_mensuel_cents: 10, mois: moisCourant() })).rejects.toMatchObject({ code: "BUDGET_ILLISIBLE" });
  });

  it("rejeu idempotent : même budget, même mois → deja: true, une seule écriture au journal", async () => {
    const corps = { budget_mensuel_cents: 70, mois: moisCourant() };
    expect(await budget.reglerBudgetUsine(corps)).toMatchObject({ deja: false, budget_mensuel_cents: 70, mois: corps.mois });
    expect(await budget.reglerBudgetUsine(corps)).toMatchObject({ deja: true, budget_mensuel_cents: 70 });
    const journal = (await depots().evenements.lister()).filter((j) => j.message.includes("Usine"));
    expect(journal).toHaveLength(1);
    // Baisser reste possible (nouvelle écriture).
    expect(await budget.reglerBudgetUsine({ ...corps, budget_mensuel_cents: 40 })).toMatchObject({ deja: false, budget_mensuel_cents: 40 });
  });

  it("budget absent → aucune fabrication commandée par l'Usine ne part (rien réservé) ; la commande de Will passe", async () => {
    const d = demande();
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", d, { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    expect(await depots().reservations.compter((r) => r.travailId === d.travailId)).toBe(0);
    expect(await lireParametre(`budget.engage.${d.travailId}`, null)).toBeNull();
    await credits.verifierEtReserver(estimation(1), true, "Cette vidéo", demande());
  });

  it("budget d'un AUTRE mois (reçu le mois dernier) = absent pour ce mois", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 80, mois: "2026-10" });
    vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
    expect(await budget.lireBudgetUsine()).toBeNull();
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", demande(), { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
  });

  it("dépassement du budget de l'Usine → refus (budget_mensuel_atteint) et alerte à Will ; la commande de Will reste sous SON plafond", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 50, mois: moisCourant() });
    await credits.verifierEtReserver(estimation(40), true, "Cette vidéo", demande(), { origine: "usine" });
    const d = demande();
    await expect(credits.verifierEtReserver(estimation(11), true, "Cette vidéo", d, { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_MENSUEL_ATTEINT" });
    expect(await depots().reservations.compter((r) => r.travailId === d.travailId)).toBe(0);
    expect((await notificationsBudget()).some((x) => x.titre.includes("Usine"))).toBe(true);
    // Will, lui, peut encore lancer jusqu'à son plafond de 100 c.
    await credits.verifierEtReserver(estimation(60), true, "Cette vidéo", demande());
  });

  it("Will baisse son plafond sous le budget de l'Usine : c'est le plus bas qui tient", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 100, mois: moisCourant() });
    await couts.definirBudget(30);
    await expect(credits.verifierEtReserver(estimation(31), true, "Cette vidéo", demande(), { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    await credits.verifierEtReserver(estimation(30), true, "Cette vidéo", demande(), { origine: "usine" });
  });

  it("budget de l'Usine illisible en base → refus", async () => {
    await ecrireParametre(`budget.usine.${moisCourant()}`, { budget_mensuel_cents: "beaucoup", mois: moisCourant() });
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", demande(), { origine: "usine" })).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
  });
});

describe("plafond_cents d'une commande de l'Usine", () => {
  it("borné par le plafond d'un sujet (135 centimes par défaut, L3-0) ; entier strictement positif", async () => {
    expect(await budget.verifierPlafondCommande(100)).toBe(100);
    expect(await budget.verifierPlafondCommande(1)).toBe(1);
    for (const v of [136, 0, -3, 2.5, Number.NaN, "10"]) {
      await expect(budget.verifierPlafondCommande(v as number)).rejects.toMatchObject({ code: "CHAMP_INVALIDE", champ: "plafond_cents" });
    }
  });
});
