/** EXP-04 : le générateur de carrousels/infographies est éteint par défaut et refuse AVANT toute réservation de crédit. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const espion = vi.hoisted(() => ({ reserver: vi.fn() }));
vi.mock("@/services/credits", async (importer) => ({ ...(await importer<typeof import("@/services/credits")>()), reserverCredits: espion.reserver }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const credits = await import("@/services/credits");
const { CLES_INTERRUPTEURS_VISUELS, generateurAllume, exigerGenerateurAllume } = await import("@/visuels/interrupteur");

beforeEach(() => {
  reinitialiserDepots();
  espion.reserver.mockClear();
});

/** Simule le point d'entrée d'une génération : le garde passe d'abord, la réservation ensuite. */
async function lancer(famille: "carrousels" | "infographies") {
  await exigerGenerateurAllume(famille);
  await credits.reserverCredits({ travailId: "travail-exemple", lignes: [] });
}

describe("interrupteur visuels", () => {
  it("deux clés, dans la table des paramètres", () => {
    expect([...CLES_INTERRUPTEURS_VISUELS].sort()).toEqual(["carrousels.actif", "infographies.actif"]);
  });
  it("réglage absent → éteint", async () => {
    expect(await generateurAllume("carrousels")).toBe(false);
    expect(await generateurAllume("infographies")).toBe(false);
  });
  it("seul le booléen exact true allume", async () => {
    await ecrireParametre("carrousels.actif", "true");
    expect(await generateurAllume("carrousels")).toBe(false);
    await ecrireParametre("carrousels.actif", true);
    expect(await generateurAllume("carrousels")).toBe(true);
    expect(await generateurAllume("infographies")).toBe(false);
  });
  it.each(["carrousels", "infographies"] as const)("%s éteint → GENERATEUR_ETEINT, 0 appel à reserverCredits", async (famille) => {
    await expect(lancer(famille)).rejects.toMatchObject({ code: "GENERATEUR_ETEINT", message: "Le générateur est éteint (Réglages › Carrousels)" });
    expect(espion.reserver).toHaveBeenCalledTimes(0);
  });
  it("allumé → le garde laisse passer, la réservation a lieu", async () => {
    await ecrireParametre("infographies.actif", true);
    await lancer("infographies");
    expect(espion.reserver).toHaveBeenCalledTimes(1);
  });
});
