/** Crédit Claude restant estimé — service et actions : affichage seulement, jamais une clé entière, aucune marque touchée. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { CLE_ESSAI_CLAUDE } from "../helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.stubGlobal("fetch", (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const cc = await import("@/services/credit-claude");
const actions = await import("@/app/(studio)/reglages/actions-credit-claude");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { paramEpuise } = await import("@/domaine/source-claude");
const { paramCycleCredit } = await import("@/domaine/credit-claude");

const MDP = "credit-restant";
const CLE_1 = "sk-ant-fausse-cle-un-AAAA1111BBBB";
const CLE_2 = "sk-ant-fausse-cle-deux-CCCC2222DDDD";
const CLE_API = "sk-ant-fausse-cle-api-EEEE3333FFFF";
const ENV = { ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_2: CLE_2, ANTHROPIC_API_KEY_3: CLE_1, ANTHROPIC_API_KEY_PAYANTE: CLE_API };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

describe("vueCreditClaude", () => {
  it("ne contient aucune clé entière, seulement la fin", async () => {
    await cc.enregistrerReleveCredit("abonnement-1", 12345);
    const json = JSON.stringify(await cc.vueCreditClaude(ENV));
    for (const cle of [CLE_1, CLE_2, CLE_API, CLE_ESSAI_CLAUDE]) expect(json).not.toContain(cle);
    expect(json).toContain("…BBBB");
    expect(json).toContain("…DDDD");
  });

  it("signale le doublon et n'additionne pas deux fois la même clé", async () => {
    for (const s of ["abonnement-1", "abonnement-3"] as const) await cc.enregistrerCycleCredit(s, { montantCentimes: 20000, debut: "2020-01-01", expireLe: null, prochainLe: null });
    const v = await cc.vueCreditClaude(ENV);
    expect(v.comptes.map((c) => c.doublon)).toEqual([false, false, true]);
    expect(v.totalTexte).toMatch(/^200[,.]00/);
  });

  it("rien de saisi : « À renseigner », l'API est éteinte en mode abonnements", async () => {
    const v = await cc.vueCreditClaude({});
    expect(v.totalTexte).toBe("À renseigner");
    expect(v.comptes.every((c) => c.etat === "a-renseigner")).toBe(true);
    expect(v.api.eteinte).toBe(true);
  });
});

describe("enregistrer… : écrit des paramètres d'affichage, rien d'autre", () => {
  it("un relevé ne touche ni les marques d'épuisement ni le solde du fournisseur", async () => {
    const marque = { depuis: "2026-10-01T00:00:00.000Z" };
    await ecrireParametre(paramEpuise("abonnement-2"), marque);
    const avant = await Promise.all((["abonnement-1", "abonnement-2", "abonnement-3"] as const).map((s) => lireParametre(paramEpuise(s), null)));
    await cc.enregistrerReleveCredit("abonnement-2", 5000);
    await cc.enregistrerCycleCredit("abonnement-2", { montantCentimes: 20000, debut: "2026-10-01", expireLe: null, prochainLe: null });
    const apres = await Promise.all((["abonnement-1", "abonnement-2", "abonnement-3"] as const).map((s) => lireParametre(paramEpuise(s), null)));
    expect(apres).toEqual(avant);
    expect((await credits.soldeFournisseur("anthropic")).solde).toBeNull();
    expect(await depots().recharges.lister()).toEqual([]);
  });
});

describe("actions : refus", () => {
  const cycle = { dollars: 200, debut: "2026-10-01", expireLe: "2026-11-01", prochainLe: null };
  it("refuse la source api et toute source inconnue", async () => {
    expect((await actions.definirCycleCreditClaudeAction("api", cycle)).ok).toBe(false);
    expect((await actions.releverCreditClaudeAction("api", 10)).ok).toBe(false);
    expect((await actions.releverCreditClaudeAction("abonnement-9", 10)).ok).toBe(false);
  });
  it("refuse un montant hors de 0 à 1000 $", async () => {
    for (const d of [-1, 1000.01, Number.NaN, Infinity]) {
      expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, dollars: d })).ok).toBe(false);
      expect((await actions.releverCreditClaudeAction("abonnement-1", d)).ok).toBe(false);
    }
  });
  it("refuse des dates invalides ou une expiration avant le début", async () => {
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, debut: "pas-une-date" })).ok).toBe(false);
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, debut: "2026-02-31" })).ok).toBe(false);
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, expireLe: "2026-10-01" })).ok).toBe(false);
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, expireLe: "2026-09-01" })).ok).toBe(false);
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, prochainLe: "xx" })).ok).toBe(false);
    expect(await lireParametre(paramCycleCredit("abonnement-1"), null)).toBeNull();
  });
  it("accepte une saisie valide, 0 et 1000 compris", async () => {
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", cycle)).ok).toBe(true);
    expect((await actions.releverCreditClaudeAction("abonnement-1", 0)).ok).toBe(true);
    expect((await actions.releverCreditClaudeAction("abonnement-1", 1000)).ok).toBe(true);
  });
  it("exige une session", async () => {
    reinitialiserRequete();
    await expect(actions.releverCreditClaudeAction("abonnement-1", 10)).rejects.toBeTruthy();
  });
});
