/**
 * L2-13 (CORRECTIF du 12/11, 14 h 30) — le refus de l'origine « usine » reste ENTIER pour TOUS les fournisseurs.
 * BUDGET_USINE_ABSENT, BUDGET_MENSUEL_ATTEINT et BUDGET_DEPASSE ne sont levés pour personne d'autre que l'Usine ; l'origine
 * Studio (le fondateur) ne les voit jamais : elle passe avec une alerte (cloche) et une ligne de journal.
 * Chaque voie de commande automatique est une entrée de la table ci-dessous (comité éditorial, écriture, vidéo, maquette,
 * retouche, format, décor, prononciations, image-vidéo, lot d'images, relance, réseaux, voix) ; elles aboutissent toutes à
 * l'une des cinq portes de credits.ts. Les services eux-mêmes sont prouvés dans comite-editorial, l3-01-ecriture-usine,
 * l3-0-prerequis-argent et l3-0-relecture-argent. Dépôts en mémoire, aucun réseau, aucun montant affiché.
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

const MDP = "plafond-origine-usine";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
let n = 0;
const demande = () => ({ videoId: `v-pf-${++n}`, travailId: `trv-pf-${n}` });

type Origine = "usine" | undefined;
interface Voie {
  nom: string;
  /** Appelle la porte de credits.ts qu'utilise cette voie, avec l'origine donnée. */
  appeler: (origine: Origine, centimes: number) => Promise<unknown>;
}
const voies: Voie[] = [
  { nom: "comité éditorial, écriture, vidéo, retouche, format, réseaux (verifierEtReserverSelonOrigine)", appeler: (o, c) => credits.verifierEtReserverSelonOrigine(o, estimation(c), true, "Cette vidéo", demande()) },
  { nom: "décor, maquette, prononciations (depenserSelonOrigine)", appeler: (o, c) => credits.depenserSelonOrigine(o, estimation(c), true, "Ce décor", demande(), async () => "payé") },
  { nom: "relance d'un travail (reactiverSelonOrigine)", appeler: async (o, c) => {
      const d = demande();
      await credits.verifierEtReserver(estimation(1), true, "Cette vidéo", d);
      await credits.libererReservation(d.travailId, "liberee");
      return credits.reactiverSelonOrigine(o, d.travailId, estimation(c), true, "Cette relance", {}, async (reactiver) => reactiver());
    } },
  { nom: "lot d'images, image-vidéo (reserverLot)", appeler: (o, c) => credits.reserverLot(`lot-pf-${++n}`, [ligne(c)], eur(c), true, { origine: o }) },
  { nom: "dépense directe réseaux / image-vidéo (verifierBudgetEtCredits)", appeler: (o, c) => credits.verifierBudgetEtCredits(estimation(c), true, "Cette vidéo", { origine: o }) },
];

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
  await ecrireParametre("budget.seuilConfirmation", eur(1_000_000));
  await ecrireParametre("budget.mensuel", eur(100));
});
afterEach(() => credits.injecterLecteursPourEssai(null));

const lignesBudget = async () => (await depots().evenements.lister()).filter((e) => e.type === "budget").map((e) => e.message);
const rien = async () => expect(await depots().reservations.lister()).toEqual([]);

describe.each(voies)("voie : $nom", ({ appeler }) => {
  it("Usine, aucun budget reçu : refusée (BUDGET_USINE_ABSENT), rien n'est réservé", async () => {
    await expect(appeler("usine", 10)).rejects.toMatchObject({ code: "BUDGET_USINE_ABSENT" });
    await rien();
  });

  it("Usine, budget du mois atteint : refusée (BUDGET_MENSUEL_ATTEINT), rien n'est réservé", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 5, mois: couts.moisParis() });
    await expect(appeler("usine", 10)).rejects.toMatchObject({ code: "BUDGET_MENSUEL_ATTEINT" });
    await rien();
  });

  it("Usine, plafond du studio dépassé : refusée (BUDGET_DEPASSE), rien n'est réservé", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 100, mois: couts.moisParis() });
    await expect(appeler("usine", 500)).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    await rien();
  });

  it("Usine, sous son budget : passe", async () => {
    await budget.reglerBudgetUsine({ budget_mensuel_cents: 100, mois: couts.moisParis() });
    await expect(appeler("usine", 10)).resolves.not.toThrow();
  });

  it("Studio, au-delà du plafond du mois : passe avec une alerte (cloche) et une ligne de journal, sans montant", async () => {
    await expect(appeler(undefined, 500)).resolves.not.toThrow();
    expect((await depots().notifications.lister()).some((x) => /indicatif/i.test(x.titre))).toBe(true);
    expect((await lignesBudget()).some((m) => m.includes("(mois)"))).toBe(true);
    for (const t of [...(await depots().notifications.lister()).map((x) => `${x.titre} ${x.message}`), ...(await lignesBudget())]) expect(t).not.toMatch(/\d\s?(€|\$|EUR|USD)/);
  });

  it("Studio, sans budget de l'Usine : jamais BUDGET_USINE_ABSENT", async () => {
    expect(await lireParametre(`budget.usine.${couts.moisParis()}`, null)).toBeNull();
    await expect(appeler(undefined, 10)).resolves.not.toThrow();
  });
});
