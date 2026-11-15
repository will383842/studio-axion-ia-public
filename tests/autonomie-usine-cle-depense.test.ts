/**
 * AUT-G — une clé de registre PAR dépense (plafond de l'Usine non dépassable). Sonde de l'audit : 15 € lancés + 2 lectures de
 * voix à 2 € + une autre commande de 18 € sous un plafond de 20 € : la commande doit être REFUSÉE. Vrai `credits.ts`,
 * dépôts en mémoire, lecteurs de solde vides, aucun réseau, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LigneCout } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const A = await import("@/services/autonomie-usine");
const { ecrireParametre } = await import("@/services/_commun");
const { moisParis, engagerBudget, budgetEngage } = await import("@/services/couts");

const MDP = "aut-g-cle";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const est = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
const PLAFOND = 2000; // essai seulement : 20 € écrits dans le dépôt mémoire, jamais dans le code livré
const usage = () => A.usageDuMoisUsine(moisParis());

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
  await ecrireParametre("usine.autonomie", { actif: true, plafondCents: PLAFOND, le: new Date().toISOString(), version: 1 });
});
afterEach(() => credits.injecterLecteursPourEssai(null));

describe("AUT-G : la sonde de l'audit", () => {
  it("15 € lancés + 2 lectures de voix à 2 € (clé par dépense) : usage 19 €, la commande de 18 € est REFUSÉE", async () => {
    await credits.verifierEtReserverSelonOrigine("usine", est(1500), undefined, "Cette vidéo", { travailId: "T", videoId: "v" });
    await credits.verifierEtReserverSelonOrigine("usine", est(200), 200, "Cette vidéo", { travailId: "T", videoId: "v", cleUsine: "T#1" });
    await credits.verifierEtReserverSelonOrigine("usine", est(200), 200, "Cette vidéo", { travailId: "T", videoId: "v", cleUsine: "T#2" });
    expect(await usage()).toBe(1900);
    await expect(credits.verifierEtReserverSelonOrigine("usine", est(1800), undefined, "Autre", { travailId: "U", videoId: "w" })).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect(await usage()).toBe(1900);
    expect(await budgetEngage()).toBe(1900); // l'engagement du travail s'additionne aussi (15 + 2 + 2)
  });

  it("sans clé par dépense (ancien comportement) la même sonde laisse passer : le test détecte le retour à « remplacer »", async () => {
    // Même sonde, les voix SUR LA CLÉ DU TRAVAIL, sans `ajouter` : elles ne s'additionnent pas au registre. Le garde-fou est donc la clé par dépense.
    await credits.verifierEtReserverSelonOrigine("usine", est(1500), undefined, "Cette vidéo", { travailId: "T", videoId: "v" });
    await credits.verifierEtReserverSelonOrigine("usine", est(200), 200, "Cette vidéo", { travailId: "T", videoId: "v" });
    expect(await usage()).toBeLessThan(1900);
  });

  it("le Studio (sans origine) ignore la clé par dépense : engagement et registre comme avant", async () => {
    await credits.verifierEtReserverSelonOrigine(undefined, est(1500), 1500, "Cette vidéo", { travailId: "S", videoId: "v" });
    await credits.verifierEtReserverSelonOrigine(undefined, est(200), 200, "Cette vidéo", { travailId: "S", videoId: "v", cleUsine: "S#1" });
    expect(await usage()).toBe(0);
    expect(await budgetEngage()).toBe(200); // remplace, comme avant
  });
});

describe("AUT-G : engagement cumulatif et jugement qui ajoute", () => {
  it("engagerBudget cumuler: ajoute à l'engagement actif ; sans cumuler il remplace (inchangé)", async () => {
    await engagerBudget("X", eur(1500));
    await engagerBudget("X", eur(200), undefined, { cumuler: true });
    await engagerBudget("X", eur(200), undefined, { cumuler: true });
    expect(await budgetEngage()).toBe(1900);
    await engagerBudget("X", eur(300));
    expect(await budgetEngage()).toBe(300);
  });

  it("jugerSousPlafondUsine avec « ajouter » : ce que la clé occupe déjà + le besoin", async () => {
    await credits.verifierEtReserverSelonOrigine("usine", est(700), undefined, "Cette vidéo", { travailId: "K", videoId: "v" });
    const rempl = await A.jugerSousPlafondUsine({ cle: "K", besoin: 700 });
    const ajout = await A.jugerSousPlafondUsine({ cle: "K", besoin: 700, ajouter: true });
    expect(rempl.apres).toBe(700);
    expect(ajout.apres).toBe(1400);
  });
});

describe("AUT-G : deux dépenses simultanées sur la même clé", () => {
  it("deux depenserSelonOrigine « usine » en vol sur la même clé sont comptés 2 fois, la 3e de 7 € est refusée", async () => {
    let lacher!: () => void;
    const portail = new Promise<void>((r) => (lacher = r));
    const d = { travailId: "D", videoId: "v" };
    const a = credits.depenserSelonOrigine("usine", est(700), 700, "Écoute", d, async () => { await portail; return "a"; });
    const b = credits.depenserSelonOrigine("usine", est(700), 700, "Écoute", d, async () => { await portail; return "b"; });
    await vi.waitFor(async () => expect(await usage()).toBe(1400));
    await expect(credits.verifierEtReserverSelonOrigine("usine", est(700), 700, "Autre", { travailId: "E", videoId: "w" })).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    lacher();
    await expect(Promise.all([a, b])).resolves.toEqual(["a", "b"]);
  });

  it("Studio : depenserSelonOrigine sans origine ne touche pas au registre de l'Usine", async () => {
    await expect(credits.depenserSelonOrigine(undefined, est(700), 700, "Écoute", { travailId: "F", videoId: "v" }, async () => "ok")).resolves.toBe("ok");
    expect(await usage()).toBe(0);
  });
});
