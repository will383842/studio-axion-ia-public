/**
 * L1-09 (chantier Usine, 18/10) — plafond mensuel global et budget envoyé par l'Usine (porte v2, § 3 quater, appel 5).
 *  - le plafond du mois se règle UNIQUEMENT dans le studio (`budget.mensuel`, Will connecté) ;
 *  - l'Usine envoie un budget du mois TOUJOURS sous ce plafond (`reglerBudgetUsine`, seul endroit d'écriture) ;
 *  - `plafond_cents` d'une commande est borné par le plafond d'UN SUJET du studio (L3-0, détail dans l3-0-prerequis-argent) ;
 *  - sans budget reçu pour le mois, aucune fabrication commandée par l'Usine ne part ; la commande de Will n'est pas touchée ;
 *  - au passage commun (`verifierEtReserver`), commande de Will : dépassement → SIGNALÉ seulement (décision du 08/11/2026 :
 *    aucun budget ne bloque), la réservation et l'engagement sont posés, Will est prévenu une fois par jour ;
 *  - réglage illisible → prévient, ne refuse plus ; sommes en centimes entiers ; reprise du même travail sans double comptage.
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

const journalBudget = async (motif: string) => (await depots().evenements.lister()).filter((e) => e.type === "budget" && e.message.includes(`(${motif})`));
const cloches = async (motif: RegExp) => (await depots().notifications.lister()).filter((x) => motif.test(x.titre));
const notificationsBudget = async () => (await depots().notifications.lister()).filter((x) => x.type === "budget");
/** Cloche du dépassement indicatif (la fabrication continue) : une par jour et par motif. */
const clochesIndicatif = async () => (await depots().notifications.lister()).filter((x) => x.type === "credit" && /indicatif/i.test(x.titre));

describe("plafond du mois du studio (commande de Will)", () => {
  it("plafond de test à 100 centimes : exactement au plafond passe ; le 2e lancement passe aussi (signalé), son engagement est posé", async () => {
    await credits.verifierEtReserver(estimation(100), true, "Cette vidéo", demande());
    expect(await clochesIndicatif()).toHaveLength(0);
    const d2 = demande();
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", d2)).resolves.toBeUndefined();
    expect(await lireParametre(`budget.engage.${d2.travailId}`, null)).not.toBeNull();
    expect((await couts.resumeBudget()).engage.centimes).toBe(101);
    expect(await clochesIndicatif()).toHaveLength(1);
  });

  it("dépassement : aucun refus, alerte à Will une seule fois par jour (même avec le réglage « bloquant »)", async () => {
    await ecrireParametre("budget.mode", "bloquant");
    await credits.verifierEtReserver(estimation(90), true, "Cette vidéo", demande());
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).resolves.toBeUndefined();
    await expect(credits.verifierEtReserver(estimation(20), true, "Cette vidéo", demande())).resolves.toBeUndefined();
    expect(await clochesIndicatif()).toHaveLength(1);
    expect((await notificationsBudget()).filter((x) => x.titre.includes("refusée"))).toHaveLength(0);
  });

  it("deux lancements simultanés sur le même disponible : les deux passent, chacun compté (verrou : aucun engagement perdu), un seul signalé", async () => {
    const r = await Promise.allSettled([credits.verifierEtReserver(estimation(60), true, "A", demande()), credits.verifierEtReserver(estimation(60), true, "B", demande())]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(2);
    expect((await couts.resumeBudget()).engage.centimes).toBe(120);
    expect(await clochesIndicatif()).toHaveLength(1);
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
  ])("réglage du plafond illisible (%s) → aucun refus, Will est prévenu", async (_nom, valeur) => {
    await ecrireParametre("budget.mensuel", valeur);
    const d = demande();
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", d)).resolves.toBeUndefined();
    expect((await depots().notifications.lister()).filter((x) => x.type === "credit" && /illisible/i.test(x.titre))).toHaveLength(1);
  });

  it("Will ne peut pas écrire un plafond qui ne soit pas un entier de centimes ≥ 0", async () => {
    await expect(couts.definirBudget(Number.NaN)).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
    await expect(couts.definirBudget(-1)).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
    await expect(couts.definirBudget(12.5)).rejects.toMatchObject({ code: "CHAMP_INVALIDE" });
    expect(await lireParametre("budget.mensuel", null)).toEqual(eur(100));
  });

  it("aucun flottant dans la somme : des lignes en fractions de centime sont comptées au centime supérieur", async () => {
    // 100,2 c au plafond de 100 c : compté 101 c au pire, jamais « arrondi à 100 » : le dépassement est signalé (pas de refus).
    await expect(credits.verifierEtReserver({ lignes: [ligne(33.4), ligne(33.4), ligne(33.4)], total: eur(100.2) }, true, "Cette vidéo", demande())).resolves.toBeUndefined();
    expect(await clochesIndicatif()).toHaveLength(1);
    const vue = await couts.resumeBudget();
    expect(Number.isInteger(vue.engage.centimes)).toBe(true);
    expect(Number.isInteger(vue.restant.centimes)).toBe(true);
    expect(vue.engage.centimes).toBe(101);
    expect(vue.restant.centimes).toBe(0);
  });

  it("bornes du mois à Paris : une dépense du 31 octobre 23 h 30 UTC compte en novembre", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T22:30:00Z")); // 23 h 30 à Paris (heure d'hiver) : encore octobre
    await depots().depenses.enregistrer({ id: "dep-oct", date: new Date().toISOString(), lignes: [], total: eur(80), creeLe: new Date().toISOString(), modifieLe: new Date().toISOString() });
    expect((await couts.resumeBudget()).depense.centimes).toBe(80);
    // 80 + 30 > 100 en octobre : signalé (plus de refus).
    await expect(credits.verifierEtReserver(estimation(30), true, "Cette vidéo", demande())).resolves.toBeUndefined();
    expect(await clochesIndicatif()).toHaveLength(1);
    vi.setSystemTime(new Date("2026-10-31T23:30:00Z")); // 0 h 30 à Paris : novembre, le compteur repart
    expect((await couts.resumeBudget()).depense.centimes).toBe(0);
    await credits.verifierEtReserver(estimation(30), true, "Cette vidéo", demande());
    // Sous le plafond de novembre : aucune nouvelle alerte.
    expect(await clochesIndicatif()).toHaveLength(1);
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

  it("budget absent → alerte + journal, plus de refus d'argent pour l'Usine (le quota de quantité garde) ; la commande du fondateur passe", async () => {
    const d = demande();
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", d, { origine: "usine" })).resolves.toBeUndefined();
    expect(await journalBudget("usine-absent")).toHaveLength(1);
    expect(await cloches(/Aucun budget du mois reçu/)).toHaveLength(1);
    expect(await depots().reservations.compter((r) => r.travailId === d.travailId)).toBe(0);
    await credits.verifierEtReserver(estimation(1), true, "Cette vidéo", demande());
  });

  it("budget d'un AUTRE mois (reçu le mois dernier) = absent pour ce mois", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T10:00:00Z"));
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 80, mois: "2026-10" });
    vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
    expect(await budget.lireBudgetUsine()).toBeNull();
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", demande(), { origine: "usine" })).resolves.toBeUndefined();
    expect(await journalBudget("usine-absent")).toHaveLength(1);
    expect(await cloches(/Aucun budget du mois reçu/)).toHaveLength(1);
  });

  it("dépassement du budget de l'Usine → alerte au fondateur + journal, sans refus d'argent ; la commande du fondateur reste sous SON plafond", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 50, mois: moisCourant() });
    await credits.verifierEtReserver(estimation(40), true, "Cette vidéo", demande(), { origine: "usine" });
    const d = demande();
    await expect(credits.verifierEtReserver(estimation(11), true, "Cette vidéo", d, { origine: "usine" })).resolves.toBeUndefined();
    expect(await depots().reservations.compter((r) => r.travailId === d.travailId)).toBe(0);
    expect(await journalBudget("usine-atteint")).toHaveLength(1);
    expect((await cloches(/Usine/)).length).toBeGreaterThan(0);
    // Will, lui, peut encore lancer jusqu'à son plafond de 100 c.
    await credits.verifierEtReserver(estimation(60), true, "Cette vidéo", demande());
  });

  it("le fondateur baisse son plafond sous le budget de l'Usine : le dépassement alerte et se journalise, sans refus", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 100, mois: moisCourant() });
    await couts.definirBudget(30);
    await expect(credits.verifierEtReserver(estimation(31), true, "Cette vidéo", demande(), { origine: "usine" })).resolves.toBeUndefined();
    expect(await journalBudget("mois")).toHaveLength(1);
    expect((await cloches(/Budget indicatif du mois dépassé/)).length).toBeGreaterThan(0);
    await credits.verifierEtReserver(estimation(30), true, "Cette vidéo", demande(), { origine: "usine" });
  });

  it("budget de l'Usine illisible en base → traité comme absent : alerte + journal, sans refus d'argent", async () => {
    await ecrireParametre(`budget.usine.${moisCourant()}`, { budget_mensuel_cents: "beaucoup", mois: moisCourant() });
    await expect(credits.verifierEtReserver(estimation(1), true, "Cette vidéo", demande(), { origine: "usine" })).resolves.toBeUndefined();
    expect(await journalBudget("usine-absent")).toHaveLength(1);
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
