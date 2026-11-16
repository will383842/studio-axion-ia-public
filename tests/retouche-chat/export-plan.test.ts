import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { TYPES_OPERATIONS_RETOUCHE } from "@/briques/operations";
import { exporterPlanLisible, EXEMPLE_OPERATIONS } from "@/services/retouche-chat/export-plan";
import { lireOperations } from "@/services/retouche-chat/schema";

const plan = validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;

describe("export lisible du plan", () => {
  const texte = exporterPlanLisible(plan);
  it("contient chaque scène, les 12 types d'opération, aucun prix", () => {
    for (const s of plan.scenes) expect(texte).toContain(s.id);
    for (const t of TYPES_OPERATIONS_RETOUCHE) expect(texte).toContain(t);
    expect(texte).not.toContain("€");
  });
  it("est stable : deux appels, même texte", () => {
    expect(exporterPlanLisible(plan)).toBe(texte);
  });
  it("l'exemple JSON est relu sans remarque", () => {
    const brut = JSON.parse(EXEMPLE_OPERATIONS(plan)) as { operations: unknown[] };
    const r = lireOperations(brut.operations);
    expect(r.remarques).toEqual([]);
    expect(r.operations.length).toBeGreaterThan(0);
    expect(texte).toContain(EXEMPLE_OPERATIONS(plan));
  });
});
