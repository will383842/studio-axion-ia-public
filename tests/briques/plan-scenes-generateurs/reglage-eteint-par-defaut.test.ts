/**
 * GV-MD-04 — Garde de la règle de fer « éteint par défaut » pour le plan de scènes. Depuis GV2-55 (cas concret, face caméra)
 * et ALLUMER-PLAN-FA-v21m (face caméra animée), plus aucun générateur n'est éteint par défaut : la garde l'écrit, et la
 * liste ETEINTS est vide. Le coupe-circuit `false` reste (reglage-allume-par-defaut.test.ts). Ce test ne
 * lit aucune base : la lecture est un double injecté. Il n'allume rien et ne change aucun défaut.
 */
import { describe, expect, it } from "vitest";
import { ALLUME_PAR_DEFAUT, CLES_REGLAGE_PLAN_SCENES, GENERATEURS_PLAN, planScenesActif, type IdGenerateurPlan } from "@/briques/plan-scenes-generateurs/reglage";

// Depuis ALLUMER-PLAN-FA-v21m, plus aucun générateur n'est éteint par défaut (tous : reglage-allume-par-defaut.test.ts).
const ETEINTS: IdGenerateurPlan[] = [];

describe("plan de scènes : réglage éteint par défaut", () => {
  it("les trois générateurs et leurs trois clés de réglage sont ceux attendus", () => {
    expect([...GENERATEURS_PLAN]).toEqual(["cas-concret", "facecam", "facecam-animee"]);
    expect(CLES_REGLAGE_PLAN_SCENES).toEqual({
      "cas-concret": "planScenes.casConcret",
      facecam: "planScenes.facecam",
      "facecam-animee": "planScenes.facecamAnimee",
    });
  });

  it("plus aucun générateur n'est éteint par défaut : la liste ETEINTS est vide et chaque défaut est true", () => {
    expect(ETEINTS).toEqual([]);
    for (const g of GENERATEURS_PLAN) expect(ALLUME_PAR_DEFAUT[g]).toBe(true);
  });

  it("le seul moyen d'éteindre est le coupe-circuit : false écrit éteint les trois", async () => {
    for (const g of GENERATEURS_PLAN) expect(await planScenesActif(g, async () => false)).toBe(false);
  });
});
