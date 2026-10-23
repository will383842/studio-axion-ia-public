/** Crédit restant, lot 2 : restes des relectures de #568/#571 (mode abonnements partagé, groupe de clés, Réglages, test de clé). */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.stubGlobal("fetch", (async () => {
  throw new Error("réseau interdit");
}) as typeof fetch);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const cc = await import("@/services/credit-claude");
const sc = await import("@/services/source-claude");
const credits = await import("@/services/credits");
const { ecrireParametre, lireParametre } = await import("@/services/_commun");
const { paramCycleCredit } = await import("@/domaine/credit-claude");
const { PARAM_SOURCES_CLAUDE } = await import("@/domaine/source-claude");
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const { versSuiviFabrication } = await import("@/components/creation/vues-travail");
const actions = await import("@/app/(studio)/reglages/actions-credit-claude");

const MDP = "credit-restant-2";
const CLE_1 = "sk-ant-fausse-cle-un-AAAA1111BBBB";
const CLE_2 = "sk-ant-fausse-cle-deux-CCCC2222DDDD";
const CLE_API = "sk-ant-fausse-cle-api-EEEE3333FFFF";
const CYCLE = { montantCentimes: 20000, debut: "2020-01-01", expireLe: null, prochainLe: null };
const TOUS = ["abonnement-1", "abonnement-2", "abonnement-3"];
const VARS = ["ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY_2", "ANTHROPIC_API_KEY_3", "ANTHROPIC_API_KEY_PAYANTE"];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  vi.unstubAllEnvs();
  for (const v of VARS) vi.stubEnv(v, "");
  await auth.seConnecter(MDP, false);
  await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "abonnements", ordre: TOUS, desactives: [], changeLe: null });
});

describe("B1 — règle « mode abonnements » partagée", () => {
  it("seule la clé payante posée → pas abonnements ; clé 2 posée → abonnements", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY_PAYANTE", CLE_API);
    expect(await sc.abonnementsClaudeActifs()).toBe(false);
    const c = (await credits.vueCredits()).find((x) => x.fournisseur === "anthropic");
    // Mode abonnements réglé : jamais de « recharge » de l'API payante, mais aucun compte utilisable.
    expect(c?.abonnements).toBe(true);
    expect(c?.aucunCompte).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY_2", CLE_2);
    expect(await sc.abonnementsClaudeActifs()).toBe(true);
    const avec = (await credits.vueCredits()).find((x) => x.fournisseur === "anthropic");
    expect(avec?.abonnements).toBe(true);
    expect(avec?.aucunCompte).toBeUndefined();
  });
  it("mode api → jamais abonnements", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", CLE_1);
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "api", ordre: TOUS, desactives: [], changeLe: null });
    expect(await sc.abonnementsClaudeActifs()).toBe(false);
  });
  it("versSuiviFabrication transmet abonnementsClaude et aucunCompteClaude", () => {
    const t = { statut: "en_cours", progression: 10, resteSec: 0, etapes: [], abonnementsClaude: true, aucunCompteClaude: false, attenteCredit: "Claude" } as never;
    const s = versSuiviFabrication(t).suivi as Record<string, unknown>;
    expect(s.abonnementsClaude).toBe(true);
    const u = versSuiviFabrication({ ...(t as object), abonnementsClaude: false, aucunCompteClaude: true } as never).suivi as Record<string, unknown>;
    expect(u.aucunCompteClaude).toBe(true);
  });
  it("bandeau : mode abonnements sans compte utilisable, travail en attente → pas « rechargez »", async () => {
    const { ProgressionEtapes } = await import("@/components/ui/ProgressionEtapes");
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(createElement(ProgressionEtapes, { etapes: [], progression: 10, suivi: { attenteCredit: "Claude", abonnementsClaude: false, aucunCompteClaude: true } }));
    expect(html).not.toMatch(/Rechargez/i);
    expect(html).toContain("Aucun compte Claude actif : posez une clé d&#x27;abonnement ou passez en API payante");
  });
});

describe("B2 — groupe de comptes à clé partagée", () => {
  const ENV = { ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_2: CLE_1, ANTHROPIC_API_KEY_PAYANTE: CLE_API };
  it("le cycle saisi sur le compte 1 vaut pour le compte 2 (même clé) et le dit", async () => {
    await cc.enregistrerCycleCredit("abonnement-1", CYCLE);
    const v = await cc.vueCreditClaude(ENV);
    const c2 = v.comptes.find((c) => c.source === "abonnement-2")!;
    expect(c2.etat).toBe("estime");
    expect(c2.cycleSaisiSurTexte).toMatch(/saisi sur le compte 1/);
    expect(v.comptes.find((c) => c.source === "abonnement-1")!.cycleSaisiSurTexte).toBeNull();
  });
  it("doublon : message cohérent avec le total (compté sur le compte 1)", async () => {
    await cc.enregistrerCycleCredit("abonnement-1", CYCLE);
    const v = await cc.vueCreditClaude(ENV);
    expect(v.comptes.find((c) => c.source === "abonnement-2")!.horsTotalTexte).toMatch(/compte 1/);
    expect(v.totalTexte).toMatch(/^200,00\s\$$/);
  });
  it("compte dont la clé est la clé payante : « Clé payante : pas de restant »", async () => {
    await cc.enregistrerCycleCredit("abonnement-2", CYCLE);
    const v = await cc.vueCreditClaude({ ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_2: CLE_API, ANTHROPIC_API_KEY_PAYANTE: CLE_API });
    expect(v.comptes.find((c) => c.source === "abonnement-2")!.restantTexte).toBe("Clé payante : pas de restant");
  });
});

describe("B3 — Réglages, action, test de clé", () => {
  it("hors total distingue les motifs", async () => {
    await ecrireParametre(PARAM_SOURCES_CLAUDE, { mode: "abonnements", ordre: TOUS, desactives: ["abonnement-2"], changeLe: null });
    const v = await cc.vueCreditClaude({ ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_2: CLE_2, ANTHROPIC_API_KEY_3: CLE_1 });
    expect(v.comptes.find((c) => c.source === "abonnement-2")!.horsTotalTexte).toMatch(/désactivé/);
    expect(v.comptes.find((c) => c.source === "abonnement-3")!.horsTotalTexte).toMatch(/autre compte/);
  });
  it("définir un cycle sans cycle → erreur propre, pas de plantage", async () => {
    const r = await actions.definirCycleCreditClaudeAction("abonnement-1", undefined as never);
    expect(r.ok).toBe(false);
    // Erreur de saisie nommée (pas un TypeError avalé en panne générique).
    expect(JSON.stringify(r)).toMatch(/MONTANT_INVALIDE|montant/i);
    expect(await lireParametre(paramCycleCredit("abonnement-1"), null)).toBeNull();
    // Sans expiration ni prochain crédit : accepté, noté tel quel.
    const ok = await actions.definirCycleCreditClaudeAction("abonnement-1", { dollars: 200, debut: "2026-10-01" });
    expect(ok.ok).toBe(true);
    expect(await lireParametre(paramCycleCredit("abonnement-1"), null)).toMatchObject({ montantCentimes: 20000, expireLe: null, prochainLe: null });
  });
  it("« Clé acceptée » précise l'API payante quand c'est elle qui est testée", async () => {
    const ok = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const seule = await creerLecteurAnthropic({ ANTHROPIC_API_KEY_PAYANTE: CLE_API }, ok).testerConnexion();
    expect(seule.message).toBe("Clé acceptée (API payante, utilisée seulement en mode API)");
    const abo = await creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_1, ANTHROPIC_API_KEY_PAYANTE: CLE_API }, ok).testerConnexion();
    expect(abo.message).toBe("Clé acceptée");
  });
});
