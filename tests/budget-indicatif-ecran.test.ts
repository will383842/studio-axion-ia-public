/**
 * Budget INDICATIF · écran « Fabriquer » : au-delà du budget du mois, le bouton n'est plus grisé ; l'aperçu le dit en
 * ambre (`budget.depasseIndicatif`) au lieu du rouge bloquant (`budget.depasse`). Mode bloquant : inchangé.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { decisionLancement } = await import("@/assistant/express/logique");
const { boutonFabriquerGrise } = await import("@/domaine/facecam-script");
const { reinitialiserDepots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const videos = await import("@/services/videos");
const scripts = await import("@/services/scripts");
const fabrication = await import("@/services/fabrication");
const { ecrireParametre } = await import("@/services/_commun");
const { centimes } = await import("@/lib/montants");

describe("fonctions pures de l'écran", () => {
  const base = { coutCentimes: 500, seuilCentimes: 1e9, resteCentimes: 100, aVerifier: [] as string[] };
  it("bloquant : coût au-dessus du reste du mois → carte « budget »", () => {
    expect(decisionLancement(base).genre).toBe("budget");
  });
  it("indicatif : plus de carte « budget », la vidéo part directement", () => {
    expect(decisionLancement({ ...base, budgetIndicatif: true }).genre).toBe("direct");
  });
  it("indicatif : le seuil de confirmation de prix reste (lancement fait à la main)", () => {
    expect(decisionLancement({ ...base, seuilCentimes: 100, budgetIndicatif: true }).genre).toBe("confirmer");
  });
  it("le bouton n'est grisé par le budget que s'il est bloquant", () => {
    expect(boutonFabriquerGrise({ aTexte: true, formatId: "avocat", budgetDepasse: true, refus: false })).toBe(true);
    expect(boutonFabriquerGrise({ aTexte: true, formatId: "avocat", budgetDepasse: false, refus: false })).toBe(false);
  });
});

describe("aperçu de fabrication selon budget.mode", () => {
  beforeAll(async () => {
    await preparerMotDePasse("essai-bi-ecran");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter("essai-bi-ecran", false);
  });

  async function brouillon() {
    await ecrireParametre("afficherExemples", false);
    const blocs = [{ id: "b1", blocRecette: "accroche", segments: [{ id: "s1", texte: "Votre employeur peut-il lire vos courriels ? La réponse est non, sauf exceptions. ".repeat(4) }] }];
    const scriptId = await scripts.enregistrerScript({ formatId: "avocat", sujet: "Courriels au travail", blocs } as never);
    return videos.creerBrouillon("avocat", { scriptId });
  }

  it("bloquant : budget du mois trop bas → depasse = true", async () => {
    await ecrireParametre("budget.mode", "bloquant");
    await ecrireParametre("budget.mensuel", centimes(1));
    const a = await fabrication.apercuFabrication(await brouillon());
    expect(a.budget.depasse).toBe(true);
    expect(a.budget.depasseIndicatif).toBe(false);
  });

  it("indicatif : même situation → plus de blocage, mais un repère ambre", async () => {
    await ecrireParametre("budget.mode", "indicatif");
    await ecrireParametre("budget.mensuel", centimes(1));
    const a = await fabrication.apercuFabrication(await brouillon());
    expect(a.budget.indicatif).toBe(true);
    expect(a.budget.depasse).toBe(false);
    expect(a.budget.depasseIndicatif).toBe(true);
  });
});
