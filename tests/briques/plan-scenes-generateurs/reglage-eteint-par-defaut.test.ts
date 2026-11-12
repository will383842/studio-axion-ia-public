/**
 * GV-MD-04 — Garde de la règle de fer « éteint par défaut » pour le plan de scènes des trois générateurs (cas concret,
 * face caméra, face caméra animée). Le réglage est une valeur en base : seul le booléen exact `true` l'allume. Ce test ne
 * lit aucune base : la lecture est un double injecté. Il n'allume rien et ne change aucun défaut.
 */
import { describe, expect, it } from "vitest";
import { CLES_REGLAGE_PLAN_SCENES, GENERATEURS_PLAN, planScenesActif } from "@/briques/plan-scenes-generateurs/reglage";

describe("plan de scènes : réglage éteint par défaut", () => {
  it("les trois générateurs et leurs trois clés de réglage sont ceux attendus", () => {
    expect([...GENERATEURS_PLAN]).toEqual(["cas-concret", "facecam", "facecam-animee"]);
    expect(CLES_REGLAGE_PLAN_SCENES).toEqual({
      "cas-concret": "planScenes.casConcret",
      facecam: "planScenes.facecam",
      "facecam-animee": "planScenes.facecamAnimee",
    });
  });

  it("la lecture se fait avec la bonne clé et la valeur par défaut false", async () => {
    for (const g of GENERATEURS_PLAN) {
      const lectures: Array<[string, unknown]> = [];
      await planScenesActif(g, async (id, defaut) => (lectures.push([id, defaut]), defaut));
      expect(lectures).toEqual([[CLES_REGLAGE_PLAN_SCENES[g], false]]);
    }
  });

  it("sans réglage posé (la lecture rend le défaut) : éteint", async () => {
    for (const g of GENERATEURS_PLAN) {
      expect(await planScenesActif(g, async (_id, defaut) => defaut)).toBe(false);
    }
  });

  it("valeur étrange : éteint (seul le booléen true allume)", async () => {
    const etranges: unknown[] = ["oui", "true", "1", 1, 0, null, undefined, {}, [], [true], { valeur: true }, "", false];
    for (const g of GENERATEURS_PLAN) {
      for (const v of etranges) {
        expect(await planScenesActif(g, async () => v)).toBe(false);
      }
    }
  });

  it("lecture en échec (exception ou promesse refusée) : éteint, sans exception", async () => {
    for (const g of GENERATEURS_PLAN) {
      expect(await planScenesActif(g, async () => { throw new Error("base indisponible"); })).toBe(false);
      expect(await planScenesActif(g, () => Promise.reject(new Error("base indisponible")))).toBe(false);
    }
  });

  it("seul true allume, et chaque générateur est indépendant des deux autres", async () => {
    for (const g of GENERATEURS_PLAN) {
      expect(await planScenesActif(g, async () => true)).toBe(true);
      // Seule la clé du générateur testé est posée : les deux autres restent éteints.
      const seulCelui = async (id: string, defaut: unknown) => (id === CLES_REGLAGE_PLAN_SCENES[g] ? true : defaut);
      for (const autre of GENERATEURS_PLAN) {
        expect(await planScenesActif(autre, seulCelui)).toBe(autre === g);
      }
    }
  });
});
