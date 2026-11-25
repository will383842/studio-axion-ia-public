/**
 * BR-TABLEAU-RACCORDS-c-v20j · le réglage `tableau.raccords` (éteint par défaut, seul `true` exact allume) est lu par le service
 * et passe l'option `raccords: true` aux outils du moteur tableau. Chemin réel : `servicesTableau().outils`, dépôts en mémoire.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reinitialiserDepots } from "@/donnees/memoire";
import { ecrireParametre } from "@/services/_commun";
import { servicesTableau } from "@/moteurs/montage-tableau";
import { PARAM_RACCORDS_TABLEAU } from "@/services/tableau-branchements";

/** Les branchements réels (voix, R2, studio-rendu) sont doublés : seul ce que la chaîne lit pour les outils compte ici. */
vi.mock("@/services/tableau-outils", async (original) => {
  const vrai = await original<typeof import("@/services/tableau-outils")>();
  return { ...vrai, branchementsReels: async () => ({ env: "dev", voix: { fournisseurVoix: "simulation" }, scenes: {}, montage: {} }) };
});

const COMMANDE = { videoId: "v-raccords", formatId: "tableau-anime", distribution: [{ role: "voix", source: "double", personnageId: "williams" }], entrees: { tableau: { sorties: ["vertical"] } }, reseaux: [] } as never;

async function outils() {
  await import("@/services/tableau-branchements");
  return (await servicesTableau().outils!(COMMANDE, "trav-raccords"))!;
}

describe("BR-TABLEAU-RACCORDS-c-v20j · réglage tableau.raccords", () => {
  beforeEach(() => reinitialiserDepots());

  it("(a) réglage absent, false, « true », 1, null : pas de clé raccords dans les outils (éteint = comme avant)", async () => {
    expect("raccords" in (await outils())).toBe(false);
    for (const v of [false, "true", 1, null, "oui", {}]) {
      await ecrireParametre(PARAM_RACCORDS_TABLEAU, v);
      expect("raccords" in (await outils()), String(JSON.stringify(v))).toBe(false);
    }
  });

  it("(b) tableau.raccords = true : les outils portent raccords: true", async () => {
    await ecrireParametre(PARAM_RACCORDS_TABLEAU, true);
    expect((await outils()).raccords).toBe(true);
    // 2e appel : même résultat (lu à chaque fabrication) ; retour à false : l'option disparaît.
    expect((await outils()).raccords).toBe(true);
    await ecrireParametre(PARAM_RACCORDS_TABLEAU, false);
    expect("raccords" in (await outils())).toBe(false);
  });

  it("(c) la clé est « tableau.raccords » ; le service la lit avec le défaut false ; seul import modifié : _commun", () => {
    expect(PARAM_RACCORDS_TABLEAU).toBe("tableau.raccords");
    const src = readFileSync("src/services/tableau-branchements.ts", "utf8");
    expect(src).toMatch(/lireParametre<unknown>\(PARAM_RACCORDS_TABLEAU, false\)\.catch\(\(\) => false\)\) === true/);
    expect(src).toContain('import { depots, lireParametre } from "./_commun";');
  });

  it("(a bis) lecture du réglage qui lève : pas de raccords, la fabrication n'est pas arrêtée", async () => {
    vi.resetModules();
    vi.doMock("@/services/_commun", async (original) => ({ ...(await original<typeof import("@/services/_commun")>()), lireParametre: async () => { throw new Error("lecture impossible"); } }));
    const { servicesTableau: services } = await import("@/moteurs/montage-tableau");
    await import("@/services/tableau-branchements");
    const o = await services().outils!(COMMANDE, "trav-raccords");
    vi.doUnmock("@/services/_commun");
    expect(o && "raccords" in o).toBe(false);
  });
});
