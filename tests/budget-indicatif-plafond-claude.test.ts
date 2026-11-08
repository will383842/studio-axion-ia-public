/**
 * Budget INDICATIF · plafond Claude du mois pour les faces caméra (simple et animée) : en mode indicatif il ne déclenche
 * plus la « version simple » (la version complète est fabriquée) ; le mode bloquant n'existe plus (08/11/2026), seule l'Usine reste bloquante.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", async () => (await import("./helpers/next-mocks")).mockHeaders);
vi.mock("next/navigation", async () => (await import("./helpers/next-mocks")).mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { plafondClaudeDuMoisAtteint } = await import("@/services/plafond-claude");

beforeEach(async () => {
  reinitialiserDepots();
  // Plafond Claude du mois minuscule + une dépense Claude du mois : le plafond est atteint.
  await ecrireParametre("claude.plafondMensuelUsd", 0.01);
  const date = new Date().toISOString();
  const ligne = { etape: "Script", fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: { centimes: 100, devise: "EUR" as const }, total: { centimes: 100, devise: "EUR" as const }, nature: "reel" as const };
  await depots().depenses.enregistrer({ id: "dep-pc-1", lignes: [ligne], total: ligne.total, date, creeLe: date, modifieLe: date } as never);
});

describe("plafondClaudeDuMoisAtteint", () => {
  it("réglage « bloquant » sans effet (08/11/2026) : jamais atteint, la version complète est fabriquée", async () => {
    await ecrireParametre("budget.mode", "bloquant");
    expect(await plafondClaudeDuMoisAtteint()).toBe(false);
  });
  it("indicatif mais commande de l'Usine : le plafond reste atteint", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    expect(await plafondClaudeDuMoisAtteint("usine")).toBe(true);
  });
  it("indicatif : jamais atteint (repère seulement), la version complète est fabriquée", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    expect(await plafondClaudeDuMoisAtteint()).toBe(false);
  });
});
