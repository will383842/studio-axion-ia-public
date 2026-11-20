/**
 * FIX-GARDE-ECRAN-b-v20j : les lignes du Journal (budget indicatif, quota de quantité) n'affichent plus d'identifiant interne.
 * Dépôts en mémoire, aucun réseau, 0 €.
 */
import { beforeEach, describe, expect, it } from "vitest";

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { ecrireParametre } = await import("@/services/_commun");
const { signalerDepassementIndicatif } = await import("@/services/budget-mensuel");
const { reserverQuota, avecOrigineFournisseur } = await import("@/services/plafond-fournisseur");

const lignesBudget = async () => (await depots().evenements.lister((e) => e.type === "budget")).map((e) => e.message);

beforeEach(() => {
  reinitialiserDepots();
});

describe("budget indicatif : libellé lisible", () => {
  it("« plafond-sujet » devient « sujet »", async () => {
    await signalerDepassementIndicatif("plafond-sujet", "t", "m");
    const l = (await lignesBudget()).join("\n");
    expect(l).toContain("(sujet)");
    expect(l).not.toContain("plafond-sujet");
  });

  it("« mois » reste « mois », « video » devient « vidéo », motif inconnu → « repère »", async () => {
    await signalerDepassementIndicatif("mois", "t", "m");
    await signalerDepassementIndicatif("video", "t", "m");
    await signalerDepassementIndicatif("x-y", "t", "m");
    const l = (await lignesBudget()).join("\n");
    expect(l).toContain("(mois)");
    expect(l).toContain("(vidéo)");
    expect(l).toContain("(repère)");
    expect(l).not.toContain("x-y");
  });

  it("la clé de cloche reste bâtie sur le motif brut : deux appels le même jour = une seule cloche", async () => {
    await signalerDepassementIndicatif("plafond-sujet", "t", "m");
    await signalerDepassementIndicatif("plafond-sujet", "t", "m");
    const cloches = await depots().parametres.lister((p) => JSON.stringify(p).includes("indicatif-plafond-sujet"));
    expect(cloches.length).toBeGreaterThan(0);
    const autres = await depots().parametres.lister((p) => JSON.stringify(p).includes("indicatif-sujet"));
    expect(autres).toHaveLength(0);
  });
});

describe("quota de quantité : libellé lisible", () => {
  it("quota fal/image atteint : refus comme avant, texte « images »", async () => {
    await ecrireParametre("plafond.quotas-usine", [{ periode: "jour", reseau: "fal", type: "image", limite: 1 }]);
    await avecOrigineFournisseur("usine", async () => {
      expect(await reserverQuota("fal", "image", "a")).not.toBeNull();
      expect(await reserverQuota("fal", "image", "b")).toBeNull();
    });
    const l = (await lignesBudget()).join("\n");
    expect(l).toContain("Quota de quantité atteint (fal, images, par jour)");
    expect(l).not.toContain(", image,");
  });

  it("quota fal/clip : « clips vidéo »", async () => {
    await ecrireParametre("plafond.quotas-usine", [{ periode: "jour", reseau: "fal", type: "clip", limite: 1 }]);
    await avecOrigineFournisseur("usine", async () => {
      await reserverQuota("fal", "clip", "a");
      expect(await reserverQuota("fal", "clip", "b")).toBeNull();
    });
    expect((await lignesBudget()).join("\n")).toContain("clips vidéo");
  });
});
