/**
 * GV2-55 — Le plan de scènes est ALLUMÉ par défaut pour le cas concret et le face caméra : seul le booléen exact `false`
 * l'éteint (coupe-circuit). Aucune base lue : la lecture est un double injecté.
 */
import { describe, expect, it } from "vitest";
import { ALLUME_PAR_DEFAUT, CLES_REGLAGE_PLAN_SCENES, planScenesActif, type IdGenerateurPlan } from "@/briques/plan-scenes-generateurs/reglage";

const ALLUMES: IdGenerateurPlan[] = ["cas-concret", "facecam"];

describe("plan de scènes : réglage allumé par défaut (cas concret et face caméra)", () => {
  it("les défauts déclarés sont ceux attendus", () => {
    expect(ALLUME_PAR_DEFAUT).toEqual({ "cas-concret": true, facecam: true, "facecam-animee": false });
  });

  it("la lecture se fait avec la bonne clé et la valeur par défaut true", async () => {
    for (const g of ALLUMES) {
      const lectures: Array<[string, unknown]> = [];
      await planScenesActif(g, async (id, defaut) => (lectures.push([id, defaut]), defaut));
      expect(lectures).toEqual([[CLES_REGLAGE_PLAN_SCENES[g], true]]);
    }
  });

  it("sans réglage posé (la lecture rend le défaut) : allumé", async () => {
    for (const g of ALLUMES) expect(await planScenesActif(g, async (_id, defaut) => defaut)).toBe(true);
  });

  it("false : éteint", async () => {
    for (const g of ALLUMES) expect(await planScenesActif(g, async () => false)).toBe(false);
  });

  it("valeur étrange (\"false\", 0, null, {}…) : allumé, seul false éteint", async () => {
    const etranges: unknown[] = ["false", "oui", "0", 0, 1, null, undefined, {}, [], [false], { valeur: false }, "", true];
    for (const g of ALLUMES) for (const v of etranges) expect(await planScenesActif(g, async () => v)).toBe(true);
  });

  it("lecture en échec (exception ou promesse refusée) : allumé, sans exception", async () => {
    for (const g of ALLUMES) {
      expect(await planScenesActif(g, async () => { throw new Error("base indisponible"); })).toBe(true);
      expect(await planScenesActif(g, () => Promise.reject(new Error("base indisponible")))).toBe(true);
    }
  });

  it("chaque générateur est indépendant des deux autres", async () => {
    for (const g of ALLUMES) {
      const seulCoupe = async (id: string, defaut: unknown) => (id === CLES_REGLAGE_PLAN_SCENES[g] ? false : defaut);
      for (const autre of ALLUMES) expect(await planScenesActif(autre, seulCoupe)).toBe(autre !== g);
      expect(await planScenesActif("facecam-animee", seulCoupe)).toBe(false);
    }
  });
});
