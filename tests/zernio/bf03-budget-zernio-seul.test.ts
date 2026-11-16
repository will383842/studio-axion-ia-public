/** BF-03 · le budget affiché ne porte plus que la clé du nouvel outil ; le réglage en base n'est ni réécrit ni nettoyé. */
import { readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const MDP = "essai-bf03-123";

beforeAll(async () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const empreinte = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(empreinte).toString("base64");
});

const actions = await import("@/app/(studio)/reglages/actions-zernio");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");

const CHEMIN = "src/app/(studio)/reglages/actions-zernio.ts";
// Les anciens noms sont assemblés en morceaux : le fichier de test ne les porte pas en clair.
const ANCIEN_MONTANT = ["buf", "fer"].join("");
const ANCIENNE_DATE = ["fin", "Buf", "fer"].join("");
const PARAM_BUDGET = "zernio.budget_info";

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("bf03 · la source ne porte plus l'ancien budget", () => {
  const source = readFileSync(CHEMIN, "utf8");
  const interfaceBudget = /export interface BudgetInfo \{[^}]*\}/.exec(source)?.[0] ?? "";

  it("l'interface BudgetInfo existe et ne garde que la clé zernio", () => {
    expect(interfaceBudget).not.toBe("");
    expect(interfaceBudget).toContain("zernio: number | null;");
    expect(interfaceBudget).not.toContain(`${ANCIEN_MONTANT}:`);
    expect(interfaceBudget).not.toContain(ANCIENNE_DATE);
  });

  it("l'ancienne date par défaut n'est plus dans la source", () => {
    expect(source).not.toContain(ANCIENNE_DATE);
    expect(source).not.toContain('"20/11"');
  });
});

describe("bf03 · lireConnexionsZernioAction rend un budget à la seule clé zernio", () => {
  it("réglage absent : seule la clé zernio, à nul", async () => {
    const r = await actions.lireConnexionsZernioAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.donnees.budget).toEqual({ zernio: null });
  });

  it("réglage encore garni d'anciennes clés : elles sont ignorées, et le réglage reste intact", async () => {
    const ancien = { zernio: 5, [ANCIEN_MONTANT]: 7, [ANCIENNE_DATE]: "20/11" };
    await ecrireParametre(PARAM_BUDGET, ancien);
    const r = await actions.lireConnexionsZernioAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.donnees.budget)).toEqual(["zernio"]);
      expect(r.donnees.budget).toEqual({ zernio: 5 });
    }
    expect(await lireParametre(PARAM_BUDGET, null)).toEqual(ancien);
  });
});
