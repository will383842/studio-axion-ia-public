/**
 * AUT-G (suite de la relecture) — l'usage d'une clé par dépense reste compté TANT QUE le travail est engagé, quel que soit le
 * temps écoulé ; et la forme de la clé passée à la réservation est tenue aux 4 sites de voix (le vrai `credits.ts`).
 */
import { readFileSync } from "node:fs";
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
const { moisParis } = await import("@/services/couts");

const MDP = "aut-g-temps";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const ligne = (c: number): LigneCout => ({ etape: "Voix", fournisseur: "simulation", unite: "forfait", quantite: 1, prixUnitaire: eur(c), total: eur(c), nature: "estime" });
const est = (c: number) => ({ lignes: [ligne(c)], total: eur(c) });

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
  await ecrireParametre("usine.autonomie", { actif: true, plafondCents: 2000, le: new Date().toISOString(), version: 1 });
});
afterEach(() => {
  vi.useRealTimers();
  credits.injecterLecteursPourEssai(null);
});

describe("AUT-G : la part des voix reste au registre tant que le travail est engagé", () => {
  for (const minutes of [16, 60]) {
    it(`après ${minutes} min, usage 19 € : 5 € et 18 € sont REFUSÉES`, async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      await credits.verifierEtReserverSelonOrigine("usine", est(1500), undefined, "Cette vidéo", { travailId: "T", videoId: "v" });
      await credits.verifierEtReserverSelonOrigine("usine", est(200), 200, "Cette vidéo", { travailId: "T", videoId: "v", cleUsine: "T#voix_1" });
      await credits.verifierEtReserverSelonOrigine("usine", est(200), 200, "Cette vidéo", { travailId: "T", videoId: "v", cleUsine: "T#voix_2" });
      vi.setSystemTime(Date.now() + minutes * 60_000);
      expect(await A.usageDuMoisUsine(moisParis())).toBe(1900);
      for (const c of [500, 1800]) {
        await expect(credits.verifierEtReserverSelonOrigine("usine", est(c), undefined, "Autre", { travailId: "U", videoId: "w" })).rejects.toMatchObject({ code: "USINE_PLAFOND_ATTEINT" });
      }
    });
  }
});

describe("AUT-G : les 4 sites de voix passent une clé `travailId#…` à la réservation", () => {
  for (const f of ["image-video", "tableau-branchements", "cas-concret-branchements", "tutoriel-branchements"]) {
    it(`${f}.ts : cleUsine = \`\${travailId}#\${nouvelId("voix")}\``, () => {
      const src = readFileSync(`src/services/${f}.ts`, "utf8");
      expect(src).toMatch(/cleUsine:\s*`\$\{(?:dep\.)?travailId\}#\$\{nouvelId\("voix"\)\}`/);
    });
  }
});
