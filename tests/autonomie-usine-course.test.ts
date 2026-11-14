/**
 * AUT-C — course : le jugement et l'inscription de l'accord sont dans la même section `sousVerrouCredits` (plan § 2.4, § 3).
 * Des lancements SIMULTANÉS de l'Usine ne dépassent jamais le plafond. Dépôts en mémoire, aucun réseau, 0 €.
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
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { moisParis } = await import("@/services/couts");

const MDP = "aut-c-course";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const estimation = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });
const PLAFOND = 10_000;
const MOIS = () => moisParis();

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
  await ecrireParametre("usine.autonomie", { actif: true, plafondCents: PLAFOND, le: new Date().toISOString(), version: 1 });
});

afterEach(() => {
  credits.injecterLecteursPourEssai(null);
});

describe("course entre commandes simultanées", () => {
  it("deux `reserverPourUsine` à 60 % du plafond en même temps : exactement un passe", async () => {
    const r = await Promise.allSettled([
      credits.reserverPourUsine(estimation(6_000), undefined, "Cette vidéo", { travailId: "c-a" }),
      credits.reserverPourUsine(estimation(6_000), undefined, "Cette vidéo", { travailId: "c-b" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const refus = r.filter((x) => x.status === "rejected") as PromiseRejectedResult[];
    expect(refus).toHaveLength(1);
    expect(refus[0].reason).toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    expect(await A.usageDuMoisUsine(MOIS())).toBe(6_000);
  });

  it("dix lancements de 15 % en même temps : six passent, jamais plus (≤ 100 %)", async () => {
    const r = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => credits.reserverPourUsine(estimation(1_500), undefined, "Cette vidéo", { travailId: `c-${i}` })));
    const passes = r.filter((x) => x.status === "fulfilled").length;
    expect(passes).toBe(6);
    for (const x of r) if (x.status === "rejected") expect(x.reason).toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
    const utilise = await A.usageDuMoisUsine(MOIS());
    expect(utilise).toBe(9_000);
    expect(utilise).toBeLessThanOrEqual(PLAFOND);
    expect(await lireParametre<string[]>(`usine.autonomie.index.${MOIS()}`, [])).toHaveLength(6);
  });

  it("même travailId deux fois en même temps (double clic) : un seul accord compté", async () => {
    const r = await Promise.allSettled([
      credits.reserverPourUsine(estimation(6_000), undefined, "Cette vidéo", { travailId: "c-meme" }),
      credits.reserverPourUsine(estimation(6_000), undefined, "Cette vidéo", { travailId: "c-meme" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(2);
    expect(await lireParametre<string[]>(`usine.autonomie.index.${MOIS()}`, [])).toEqual(["c-meme"]);
    expect(await A.usageDuMoisUsine(MOIS())).toBe(6_000);
    expect(await lireParametre(`budget.engage.c-meme`, null)).toMatchObject({ centimes: 6_000 });
  });
});
