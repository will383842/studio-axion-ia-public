/**
 * ARG-R7-SUITE : verrou de l'ÉCHEC FERMÉ. Décision du fondateur (08/11/2026) : le prix ne bloque jamais pour le studio, seule
 * l'Usine reste bloquante. Quand l'origine d'une vidéo est ILLISIBLE (lecture de ses versions en panne), elle est traitée comme
 * l'Usine : la confirmation du prix est exigée, jamais l'accord automatique du studio. Sans ce test, un changement qui lirait
 * « studio » par défaut ouvrirait la dépense sans que personne l'ait confirmée.
 * Tout simulé : aucun réseau, aucune clé.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const modeBudget = await import("@/services/mode-budget");
const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
const { moisParis } = await import("@/services/couts");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "r7-origine-illisible";
const total = { centimes: 250, devise: "EUR" as const };
const estimation = { lignes: [{ etape: "Essai", fournisseur: "simulation", unite: "appel" as const, quantite: 1, prixUnitaire: total, total, nature: "estime" as const }], total };

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  // Seuil bas (le prix de l'essai le dépasse) et budget du mois de l'Usine posé : le seul refus possible est la confirmation.
  await ecrireParametre("budget.seuilConfirmation", { centimes: 100, devise: "EUR" });
  await ecrireParametre("budget.mensuel", { centimes: 1_000_000, devise: "EUR" });
  await reglerBudgetUsine({ budget_mensuel_cents: 1_000_000, mois: moisParis() });
});

describe("origine ILLISIBLE = Usine : la confirmation du prix est exigée", () => {
  it("lecture des versions en panne → « usine » ; la garde de prix exige la confirmation (le studio, lui, passe)", async () => {
    // Témoin : une vidéo sans version est une commande du studio, le prix du jour vaut accord.
    expect(await modeBudget.origineDeLaVideo("sans-version")).toBe("studio");
    await expect(credits.verifierBudgetEtCredits(estimation, undefined, "Cette vidéo", { origine: await modeBudget.origineDeLaVideo("sans-version") })).resolves.toBeUndefined();

    // Origine illisible : la lecture des versions échoue.
    const panne = vi.spyOn(depots().versions, "lister").mockRejectedValue(new Error("lecture en panne"));
    const origine = await modeBudget.origineDeLaVideo("video-illisible");
    expect(origine).toBe("usine");
    expect(await modeBudget.budgetIndicatifPourVideo("video-illisible")).toBe(false);
    // La confirmation est exigée, comme pour l'Usine, avec le montant ; un montant juste la couvre.
    await expect(credits.verifierBudgetEtCredits(estimation, undefined, "Cette vidéo", { origine })).rejects.toMatchObject({ code: "CONFIRMATION_REQUISE", montant: 250 });
    await expect(credits.verifierBudgetEtCredits(estimation, 250, "Cette vidéo", { origine })).resolves.toBeUndefined();
    panne.mockRestore();
  });
});
