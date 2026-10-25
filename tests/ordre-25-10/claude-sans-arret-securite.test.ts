/**
 * Lot 4 « le prix ne bloque jamais » (règle produit du 25/10/2026) : les plafonds Claude (par vidéo, par sujet) et le plafond
 * de voix du cas concret ne s'arrêtent plus à 5 × en mode indicatif : la fabrication continue et le dépassement est signalé
 * (journal + cloche, jamais de push ni d'e-mail). Mode bloquant : arrêt comme avant. Les arrêts anti-boucle restent.
 * Dépôts en mémoire, faux Claude, aucun réseau, 0 €.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { preparerMotDePasse } from "../helpers/g1a";
import type { GenerationScript } from "@/domaine/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const gc = await import("@/services/generation-claude");
const { jugerPlafond } = await import("@/services/budget-mensuel");
const { verifierPartVoix } = await import("@/moteurs/montage-cas-concret/fabriquer");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "claude-sans-arret-securite";
beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
});

let n = 0;
async function generation(plafondUsd = 1.5): Promise<GenerationScript> {
  const le = new Date().toISOString();
  const g: GenerationScript = { id: `gen-asc-${++n}`, scriptMaitreId: `suj-asc-${n}`, hachageContexte: "h", plafondUsd, portee: "sujet", etapes: [], statut: "en-cours", essai: false, creeLe: le, modifieLe: le };
  await depots().generations.enregistrer(g);
  return g;
}
const cloches = async () => (await depots().notifications.lister()).filter((x) => x.type === "budget" && /dépassé|Plafond du sujet/.test(x.titre));

describe("plafond par vidéo (jugerPlafond)", () => {
  it("indicatif : 6 × le plafond ne s'arrête pas, il signale", async () => {
    const plafondCentimes = 150; // 1,5 $ ≈ 150 c
    const r = await jugerPlafond(plafondCentimes * 6, 1.5, true, "Ce texte", "vid-1", { sansPrix: true });
    expect(r).not.toBe("arret-securite");
    expect(r).toBe("depasse");
    expect(await cloches()).toHaveLength(1);
  });
  it("bloquant : refus comme avant", async () => {
    expect(await jugerPlafond(900, 1.5, false, "Ce texte", "vid-1")).toBe("bloque");
  });
});

describe("plafond du sujet (écriture Claude)", () => {
  it("indicatif : une dépense à 6 × le plafond est réservée et signalée, sans arrêt", async () => {
    const g = await generation();
    expect(await gc.reserverDansPlafondSujet(g.id, "a1", 9, true)).toEqual({ ok: true });
    expect(await cloches()).toHaveLength(1);
  });
  it("bloquant : refus comme avant", async () => {
    const g = await generation();
    expect(await gc.reserverDansPlafondSujet(g.id, "a1", 9)).toEqual({ ok: false, plafondUsd: 1.5 });
  });
  it("pire cas de la chaîne : indicatif à 6 × passe ; bloquant refuse", async () => {
    const g = await generation();
    expect(await gc.reserverPireCasChaine(g.id, { pireCasRestantUsd: 9, indicatif: true })).toEqual({ ok: true });
    const g2 = await generation();
    expect(await gc.reserverPireCasChaine(g2.id, { pireCasRestantUsd: 9 })).toMatchObject({ ok: false });
  });
});

describe("cas concret : voix", () => {
  const budget = { plafondVoix: { centimes: 10, prixLecture: () => 20 }, indicatif: { lecturesVoixMax: 3, facteurSecurite: 5 } };
  it("indicatif : au-delà de 5 × le prix confirmé, la lecture passe", () => {
    expect(() => verifierPartVoix(budget, [{ prise: "a", coutCentimes: 40 }] as never, { prise: "a", texte: "t" })).not.toThrow();
  });
  it("bloquant : le plafond de voix refuse comme avant", () => {
    expect(() => verifierPartVoix({ plafondVoix: budget.plafondVoix }, [{ prise: "a", coutCentimes: 40 }] as never, { prise: "a", texte: "t" })).toThrow();
  });
  it("l'arrêt anti-boucle (lecturesVoixMax) reste en indicatif", () => {
    const p = (prise: string) => ({ prise, coutCentimes: 1 });
    expect(() => verifierPartVoix(budget, [p("a"), p("a"), p("a")] as never, { prise: "a", texte: "t" })).toThrow(/déjà été lue 3 fois/);
  });
});

describe("arrêts qui restent", () => {
  it("le budget du mois de l'Usine reste bloquant même en indicatif", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    const { controlerBudgetDuMois } = await import("@/services/budget-mensuel");
    await expect(controlerBudgetDuMois(100, { origine: "usine" })).rejects.toMatchObject({ code: expect.stringMatching(/BUDGET_/) });
  });
});
