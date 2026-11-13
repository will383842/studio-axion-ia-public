/**
 * NEW-ARG-04 : le Studio ne bloque jamais pour un prix. Plus d'arrêt à 5 fois le prix annoncé ; les garde-fous en NOMBRE
 * D'APPELS (une seule relance d'accord, lectures de voix plafonnées) et la porte de l'Usine restent actifs.
 * Dépôts en mémoire, aucun réseau, aucun appel réel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

const { reinitialiserDepots } = await import("@/donnees/memoire");
const mode = await import("@/services/mode-budget");
const mensuel = await import("@/services/budget-mensuel");
const { centimesDuPlafond } = await import("@/lib/montants");
const fabriquer = await import("@/moteurs/montage-cas-concret/fabriquer");

beforeEach(() => {
  reinitialiserDepots();
  reinitialiserRequete();
});

describe("NEW-ARG-04 : le prix ne bloque jamais", () => {
  it("R1 : un prix 10 fois au-dessus du prix annoncé ne bloque pas une vidéo demandée à la main", async () => {
    const plafondUsd = 2;
    const plafond = centimesDuPlafond(plafondUsd);
    for (const facteur of [1.01, 5, 5.01, 10, 100]) {
      expect(await mensuel.jugerPlafond(Math.ceil(plafond * facteur), plafondUsd, await mode.budgetIndicatifPour("studio"), "Voix")).toBe("ok");
    }
  });

  it("R2 : l'accord automatique suit le prix du jour, même 10 fois l'accord reçu (commande à la main)", async () => {
    expect(await mode.accordAutomatique(100, 1000, { origine: "studio" })).toBe(1000);
    expect(await mode.accordAutomatique(false, 100000, { origine: "studio" })).toBe(100000);
  });

  it("R3 : messageArretSecurite ne cite aucun prix ni facteur", () => {
    for (const m of [mode.messageArretSecurite(), mode.messageArretSecurite("12,00 €"), mode.MESSAGE_ARRET_SECURITE]) {
      expect(m).not.toMatch(/€|\d|fois|prix/i);
    }
  });

  it("R4 : le message du dépassement indicatif n'annonce plus d'arrêt à un multiple du prix", () => {
    for (const m of [mode.messageAuDelaDuBudgetIndicatif(), mode.messageAuDelaDuBudgetIndicatif("3,00 €")]) {
      expect(m).not.toMatch(/arr[êe]t de s[ée]curit[ée]|\d+ fois/i);
      expect(m).toContain("la fabrication continue");
    }
  });
});

describe("NEW-ARG-04 : les garde-fous restent", () => {
  it("R5 : anti-boucle en nombre d'appels, UNE SEULE relance d'accord, même si l'issue demande toujours un accord", async () => {
    const appel = vi.fn(async (_accord?: number) => ({ statut: "accord-requis", centimes: 5000 }));
    const issue = await mode.avecAccordAutomatique(appel, undefined, { origine: "studio" });
    expect(appel).toHaveBeenCalledTimes(2);
    expect(issue.statut).toBe("accord-requis");
  });

  it("R6 : une commande de l'Usine reste bloquante : accord inchangé, aucune relance", async () => {
    expect(await mode.budgetIndicatifPour("usine")).toBe(false);
    expect(await mode.accordAutomatique(100, 100000, { origine: "usine" })).toBe(100);
    const appel = vi.fn(async (_accord?: number) => ({ statut: "accord-requis", centimes: 5000 }));
    await mode.avecAccordAutomatique(appel, undefined, { origine: "usine" });
    expect(appel).toHaveBeenCalledTimes(1);
  });

  it("R7 : le plafond de lectures de voix (nombre d'appels) est inchangé", () => {
    expect(fabriquer.LECTURES_VOIX_MAX_INDICATIF).toBe(3);
  });
});
