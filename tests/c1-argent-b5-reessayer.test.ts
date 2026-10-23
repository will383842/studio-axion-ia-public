/**
 * CORRECTEUR 1 (argent) — B5 : « Réessayer » relance une fabrication payante. Avant de réactiver le travail, le budget
 * du mois et les crédits sont revérifiés sur le coût RESTANT (ce qui n'est pas déjà payé). Faux lecteurs de solde,
 * aucune clé, aucun réseau.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const fabrication = await import("@/services/fabrication");
const travaux = await import("@/services/travaux");
const credits = await import("@/services/credits");
const couts = await import("@/services/couts");
const boucle = await import("@/services/boucle");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "c1-argent-b5";

beforeAll(async () => {
  process.env.SESSION_SECRET = "b".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  credits.injecterLecteursPourEssai(null);
  await auth.seConnecter(MDP, false);
  for (const x of await depots().travaux.lister((t) => t.statut === "en_cours" || t.statut === "en_file")) await depots().travaux.enregistrer({ ...x, statut: "termine" });
  await ecrireParametre("budget.seuilConfirmation", { centimes: 1_000_000, devise: "EUR" });
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
  vi.useRealTimers();
});

function heygen(solde: number): LecteurCredit {
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
      return { ok: true, finCle: "…essai", message: "ok", testeLe: new Date().toISOString() };
    },
  };
}

/** Lance v-03 avec un échec simulé à une étape (« montage » par défaut), puis fait tourner la boucle jusqu'à l'échec. */
async function travailEnEchec(etape = "montage"): Promise<string> {
  const { travailId } = await fabrication.lancerFabrication("v-03", { confirme: true, simulerEchecEtape: etape });
  vi.useFakeTimers({ toFake: ["Date"] });
  for (let i = 0; i < 200; i++) {
    const t = await depots().travaux.obtenir(travailId);
    if (t?.statut === "echec") break;
    vi.setSystemTime(Date.now() + 5_000);
    await boucle.tourDeBoucle();
  }
  vi.useRealTimers();
  expect((await depots().travaux.obtenir(travailId))?.statut).toBe("echec");
  return travailId;
}

describe("B5 · « Réessayer » revérifie le budget et les crédits", () => {
  it("budget du mois atteint depuis l'échec : la relance est refusée, rien n'est réactivé", async () => {
    const travailId = await travailEnEchec();
    const depense = (await couts.resumeBudget()).depense.centimes;
    await ecrireParametre("budget.mensuel", { centimes: depense, devise: "EUR" });
    await expect(travaux.reessayerTravail(travailId)).rejects.toMatchObject({ code: "BUDGET_DEPASSE" });
    expect((await depots().travaux.obtenir(travailId))?.statut).toBe("echec");
    expect(await depots().reservations.compter((r) => r.travailId === travailId && r.statut === "active")).toBe(0);
    expect((await couts.resumeBudget()).engage.centimes).toBe(0);
  });

  it("crédit HeyGen épuisé depuis l'échec : la relance est refusée (crédit insuffisant)", async () => {
    credits.injecterLecteursPourEssai([heygen(1_000_000)], ["heygen"]);
    for (const v of await depots().voix.lister()) await depots().voix.modifier(v.id, { fournisseur: "heygen" });
    // Échec à la voix : la voix HeyGen reste à payer.
    const travailId = await travailEnEchec("voix");
    credits.injecterLecteursPourEssai([heygen(1)], ["heygen"]);
    // Le solde lu au lancement date de plus de 5 min : il est relu avant la relance.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 10 * 60_000);
    await expect(travaux.reessayerTravail(travailId)).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
    expect((await depots().travaux.obtenir(travailId))?.statut).toBe("echec");
  });

  it("au-delà du seuil : la relance demande une confirmation, puis repart une fois confirmée", async () => {
    const travailId = await travailEnEchec();
    await ecrireParametre("budget.seuilConfirmation", { centimes: 0, devise: "EUR" });
    const refus = await travaux.reessayerTravail(travailId).catch((e: { code?: string; montant?: number }) => e);
    expect(refus).toMatchObject({ code: "CONFIRMATION_REQUISE" });
    // Seconde relecture paquet 4 (R2) : au-delà du seuil, c'est le MONTANT vu qui confirme (`true` ne suffit plus).
    await expect(travaux.reessayerTravail(travailId, { confirme: true })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE" });
    const r = await travaux.reessayerTravail(travailId, { confirme: (refus as { montant: number }).montant });
    expect(r.statut).not.toBe("echec");
  });

  it("seul le coût RESTANT compte : ce qui est déjà payé ne bloque pas la relance", async () => {
    const travailId = await travailEnEchec();
    const deja = (await depots().depenses.lister((d) => d.travailId === travailId)).reduce((s, d) => s + d.total.centimes, 0);
    expect(deja).toBeGreaterThan(0);
    const t = (await depots().travaux.obtenir(travailId))!;
    const v = (await depots().versions.obtenir(t.versionId!))!;
    const { moteurDeCommande } = await import("@/moteurs");
    const total = (await moteurDeCommande(v.commande).estimer(v.commande)).total.centimes;
    const depense = (await couts.resumeBudget()).depense.centimes;
    // Pas assez pour la vidéo entière (refusée au lancement), assez pour ce qui reste à payer.
    await ecrireParametre("budget.mensuel", { centimes: depense + total - 1, devise: "EUR" });
    const r = await travaux.reessayerTravail(travailId);
    expect(r.statut).not.toBe("echec");
  });
});
