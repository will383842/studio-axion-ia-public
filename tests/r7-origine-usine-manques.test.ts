/**
 * ARG-ORIGINE-USINE, trou n° 2 : `manquesPour` ignorait l'origine. Un solde seulement « suivi » (deviné : recharges déclarées moins
 * dépenses, ex. fal.ai) n'est jamais opposé au Studio (décision du 08/11), mais l'Usine reste bloquante : son crédit suivi doit
 * l'arrêter (CREDIT_INSUFFISANT), pas seulement l'absence de budget. Tout simulé : aucun réseau, aucune clé.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import type { LigneCout } from "@/domaine/types";
import type { LecteurCredit } from "@/fournisseurs/types";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const { reglerBudgetUsine } = await import("@/services/budget-mensuel");
const { moisParis } = await import("@/services/couts");
const { ecrireParametre } = await import("@/services/_commun");

const MDP = "r7-origine-usine-manques";
const eur = (c: number) => ({ centimes: c, devise: "EUR" as const });
const voix: LigneCout = { etape: "Voix", fournisseur: "heygen", unite: "caractere", quantite: 10_000, prixUnitaire: eur(0.02), total: eur(200), nature: "estime" };
const estimation = { lignes: [voix], total: eur(200) };

beforeAll(async () => preparerMotDePasse(MDP));
beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  await ecrireParametre("budget.mensuel", eur(1_000_000));
  await reglerBudgetUsine({ budget_mensuel_cents: 1_000_000, mois: moisParis() });
  // Lecteur « suivi » (comme fal.ai) : 1 $ rechargé, la voix en demande bien plus.
  const suivi: LecteurCredit = { fournisseur: "heygen", nom: "Suivi", mode: "suivi", urlRecharge: "https://exemple.invalid", variableCle: "X_KEY", async testerConnexion() { return { ok: true, finCle: "…0000", message: "ok", testeLe: new Date().toISOString() }; } };
  credits.injecterLecteursPourEssai([suivi], ["heygen"]);
  const debut = new Date(Date.now() - 3600_000).toISOString();
  await depots().recharges.enregistrer({ id: "r1", fournisseur: "heygen", centimes: 100, devise: "USD", date: debut, creeLe: debut, modifieLe: debut });
});

describe("manquesPour suit l'origine de la commande", () => {
  it("sans origine (Studio) : le solde suivi n'est jamais opposé ; origine « usine » : il l'est", async () => {
    expect((await credits.manquesPour([voix])).manques).toHaveLength(0);
    expect((await credits.manquesPour([voix], "studio")).manques).toHaveLength(0);
    expect((await credits.manquesPour([voix], "usine")).manques.length).toBeGreaterThan(0);
  });

  it("garde commune : l'Usine confirmée s'arrête sur le crédit suivi (CREDIT_INSUFFISANT) ; le Studio passe", async () => {
    await expect(credits.verifierBudgetEtCredits(estimation, 200, "Cette vidéo", { origine: "usine" })).rejects.toMatchObject({ code: "CREDIT_INSUFFISANT" });
    await expect(credits.verifierBudgetEtCredits(estimation, undefined, "Cette vidéo")).resolves.toBeUndefined();
  });
});
