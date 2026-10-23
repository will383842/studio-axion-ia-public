/** Crédit Claude restant estimé — corrections de la relecture (ordre, total, dates, textes, gardes). */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import { consommeDepuis, restantEstime, totalRestant } from "@/domaine/credit-claude";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const cc = await import("@/services/credit-claude");
const actions = await import("@/app/(studio)/reglages/actions-credit-claude");
const { ecrireParametre } = await import("@/services/_commun");

const CLE_1 = "sk-ant-fausse-cle-un-AAAA1111BBBB";
const CLE_2 = "sk-ant-fausse-cle-deux-CCCC2222DDDD";
const CLE_API = "sk-ant-fausse-cle-api-EEEE3333FFFF";
const ENV = { ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_2: CLE_2, ANTHROPIC_API_KEY_3: CLE_1, ANTHROPIC_API_KEY_PAYANTE: CLE_API };
const CYCLE = { montantCentimes: 20000, debut: "2026-10-01", expireLe: null, prochainLe: null };

async function depense(centimes: number, date: string, sourceClaude?: "abonnement-1" | "abonnement-2" | "abonnement-3" | "api") {
  await depots().depenses.enregistrer({ id: `dep-${Math.random()}`, lignes: [{ fournisseur: "anthropic", nature: "reel", total: { centimes, devise: "EUR" } }], total: { centimes, devise: "EUR" }, date, sourceClaude, creeLe: date, modifieLe: date } as never);
}

beforeAll(async () => {
  await preparerMotDePasse("credit-corr");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-19T12:00:00.000Z"));
  await auth.seConnecter("credit-corr", false);
  await ecrireParametre("taux.usdEur", 1);
});

afterEach(() => vi.useRealTimers());

describe("1) ordre, doublon et dépenses partagées", () => {
  it("ordre [3,1,2], comptes 1 et 3 sur la même clé : le total est le restant du compte 3 avec les dépenses des DEUX comptes", async () => {
    await ecrireParametre("claude.sources", { mode: "abonnements", ordre: ["abonnement-3", "abonnement-1", "abonnement-2"], desactives: [] });
    await cc.enregistrerCycleCredit("abonnement-1", CYCLE);
    await cc.enregistrerCycleCredit("abonnement-3", CYCLE);
    await depense(1000, "2026-10-10T00:00:00.000Z", "abonnement-1");
    await depense(2000, "2026-10-11T00:00:00.000Z", "abonnement-3");
    const v = await cc.vueCreditClaude(ENV);
    expect(v.totalTexte).toMatch(/^170[,.]00/);
    expect(v.comptes.map((c) => [c.source, c.doublon])).toEqual([["abonnement-3", false], ["abonnement-1", true], ["abonnement-2", false]]);
  });

  it("compte 1 désactivé + compte 3 sur la même clé : aucun badge doublon incohérent", async () => {
    await ecrireParametre("claude.sources", { mode: "abonnements", ordre: ["abonnement-1", "abonnement-2", "abonnement-3"], desactives: ["abonnement-1"] });
    await cc.enregistrerCycleCredit("abonnement-3", CYCLE);
    const v = await cc.vueCreditClaude(ENV);
    expect(v.comptes.every((c) => !c.doublon)).toBe(true);
    expect(v.totalTexte).toMatch(/^200[,.]00/);
  });
});

describe("2) total : jamais 0,00 $ sans compte additionné", () => {
  it("totalRestant renvoie le nombre de comptes réellement additionnés", () => {
    const c = (source: "abonnement-1" | "abonnement-2" | "api", cle: string | null, restant: number | null) => ({ source, cle, desactive: false, etat: "estime" as const, restantCentimes: restant });
    expect(totalRestant([c("abonnement-1", "k1", 100), c("abonnement-2", "k1", 900)])).toMatchObject({ centimes: 100, comptes: 1 });
    expect(totalRestant([c("abonnement-1", "kp", 100), c("api", "kp", null)])).toMatchObject({ centimes: 0, comptes: 0 });
    expect(totalRestant([c("abonnement-1", null, 100)])).toMatchObject({ comptes: 0 });
  });

  it("le cycle saisi sur un compte du groupe (même clé) vaut pour le compte compté une fois : total = ce cycle, pas deux fois", async () => {
    await cc.enregistrerCycleCredit("abonnement-3", CYCLE);
    // Le compte 2 (autre clé) n'a rien de saisi : le total est partiel, et le dit.
    expect((await cc.vueCreditClaude(ENV)).totalTexte).toMatch(/^200,00\s\$ sur 1 compte renseigné$/);
  });

  it("le seul compte estimé porte la clé payante → « À renseigner »", async () => {
    await cc.enregistrerCycleCredit("abonnement-3", CYCLE);
    const v = await cc.vueCreditClaude({ ANTHROPIC_API_KEY_3: CLE_API, ANTHROPIC_API_KEY_PAYANTE: CLE_API });
    expect(v.totalTexte).toBe("À renseigner");
  });
});

describe("3) dates : dates seules AAAA-MM-JJ, bornes, instants", () => {
  const cycle = { dollars: 200, debut: "2026-10-01", expireLe: "2026-11-01", prochainLe: null as string | null };
  it("refuse un instant avec fuseau, et les années 0001 / 9999", async () => {
    for (const debut of ["2026-10-01T00:00:00+02:00", "0001-01-01", "9999-12-31", "2023-12-31", "2101-01-01"]) {
      expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, debut, expireLe: null })).ok).toBe(false);
    }
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, expireLe: "2026-11-01T00:00:00+02:00" })).ok).toBe(false);
  });
  it("« prochain crédit » doit venir après le début", async () => {
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, prochainLe: "2026-10-01" })).ok).toBe(false);
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, prochainLe: "2026-09-01" })).ok).toBe(false);
    expect((await actions.definirCycleCreditClaudeAction("abonnement-1", { ...cycle, prochainLe: "2026-11-11" })).ok).toBe(true);
  });
  it("consommeDepuis compare des instants : 00:00+02:00 = 22:00Z la veille", () => {
    const d = [{ date: "2026-09-30T22:30:00.000Z", sourceClaude: undefined, lignes: [{ fournisseur: "anthropic", nature: "reel", total: { centimes: 700 } }] }] as never;
    expect(consommeDepuis(d, "abonnement-1", "2026-10-01T00:00:00+02:00", 1)).toBe(700);
    expect(consommeDepuis(d, "abonnement-1", "2026-10-01", 1)).toBe(700);
    expect(consommeDepuis(d, "abonnement-1", "2026-10-01T00:00:00.000Z", 1)).toBe(0);
  });
  it("consommeDepuis additionne plusieurs comptes", () => {
    const l = [{ fournisseur: "anthropic", nature: "reel", total: { centimes: 100 } }];
    const d = [{ date: "2026-10-10T00:00:00.000Z", sourceClaude: "abonnement-3", lignes: l }, { date: "2026-10-10T00:00:00.000Z", sourceClaude: "abonnement-1", lignes: l }, { date: "2026-10-10T00:00:00.000Z", sourceClaude: "abonnement-2", lignes: l }] as never;
    expect(consommeDepuis(d, ["abonnement-1", "abonnement-3"], "2026-10-01", 1)).toBe(200);
  });
});

describe("4-5) textes", () => {
  it("dépassement : « 0 $ (dépensé plus que le crédit noté : à recaler avec la Console) »", async () => {
    await cc.enregistrerCycleCredit("abonnement-2", { ...CYCLE, montantCentimes: 1000 });
    await depense(5000, "2026-10-10T00:00:00.000Z", "abonnement-2");
    const c = (await cc.vueCreditClaude(ENV)).comptes.find((x) => x.source === "abonnement-2")!;
    expect(c.restantTexte).toBe("0 $ (dépensé plus que le crédit noté : à recaler avec la Console)");
  });
  it("hors total : doublon, clé payante, sans clé, désactivé", async () => {
    await ecrireParametre("claude.sources", { mode: "abonnements", ordre: ["abonnement-1", "abonnement-2", "abonnement-3"], desactives: ["abonnement-2"] });
    const v = await cc.vueCreditClaude({ ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_2: CLE_2, ANTHROPIC_API_KEY_3: CLE_API, ANTHROPIC_API_KEY_PAYANTE: CLE_API });
    const t = (s: string) => v.comptes.find((c) => c.source === s)!.horsTotalTexte;
    expect(t("abonnement-1")).toBeNull();
    expect(t("abonnement-2")).toMatch(/hors (du )?total/i);
    expect(t("abonnement-3")).toMatch(/API payante/);
    expect(t("abonnement-3")).toContain("…FFFF");
    await ecrireParametre("claude.sources", { mode: "abonnements", ordre: ["abonnement-1", "abonnement-2", "abonnement-3"], desactives: [] });
    const w = await cc.vueCreditClaude({ ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_3: CLE_1 });
    expect(w.comptes.find((c) => c.source === "abonnement-3")!.horsTotalTexte).toMatch(/hors total/i);
    expect(w.comptes.find((c) => c.source === "abonnement-2")!.horsTotalTexte).toMatch(/clé/i);
  });
});

describe("6) garde statique et session", () => {
  it("definirCycleCreditClaudeAction exige une session", async () => {
    reinitialiserRequete();
    await expect(actions.definirCycleCreditClaudeAction("abonnement-1", { dollars: 200, debut: "2026-10-01" })).rejects.toBeTruthy();
  });
  it("aucun import de credit-claude dans credits.ts, generation-claude.ts, source-claude.ts", () => {
    for (const f of ["src/services/credits.ts", "src/services/generation-claude.ts", "src/services/source-claude.ts", "src/domaine/source-claude.ts", "src/domaine/credits.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/credit-claude/);
    }
  });
});

describe("8) un relevé sans cycle périme après 35 jours", () => {
  const conso = () => 0;
  it("frais : estimé ; vieux de plus de 35 jours : à renseigner", () => {
    const releve = { centimes: 5000, le: "2026-09-20T00:00:00.000Z" };
    expect(restantEstime({ cycle: null, releve, consomme: conso, maintenant: "2026-10-19T12:00:00.000Z" }).etat).toBe("estime");
    expect(restantEstime({ cycle: null, releve, consomme: conso, maintenant: "2026-10-26T12:00:00.000Z" })).toMatchObject({ etat: "a-renseigner", restantCentimes: null });
  });
});
