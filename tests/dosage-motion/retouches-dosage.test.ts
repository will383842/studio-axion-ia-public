import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { retouchesDosage } from "@/services/retouche-chat/retouches-dosage";
import { appliquerOperations, lireOperations } from "@/services/retouche-chat";

const valider = (p: unknown): PlanValide => validerPlan(p, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false, dureeMs: PLAN_DEMO.dureeMs }).plan;
const demo = valider(PLAN_DEMO);
const nu = valider({ ...structuredClone(PLAN_DEMO), scenes: PLAN_DEMO.scenes.map((s) => ({ ...s, calques: undefined })) });

describe("retouches de dosage (X3-12a)", () => {
  it("plan démo : « Sans animations » = un retirer-piece par pièce, une transition, zooms à 1, tout valide", () => {
    const r = retouchesDosage(demo).find((x) => x.id === "sans-animations");
    expect(r).toBeDefined();
    const ops = r!.operations;
    const attendues = demo.scenes.flatMap((s) => (s.calques ?? []).filter((c) => c.piece !== "zoom-camera")).length;
    expect(attendues).toBeGreaterThan(0);
    expect(ops.filter((o) => o.type === "retirer-piece")).toHaveLength(attendues);
    expect(ops.filter((o) => o.type === "changer-transition")).toHaveLength(1);
    for (const o of ops.filter((o) => o.type === "ajuster-zoom")) expect((o as { facteur: number }).facteur).toBe(1);
    const lu = lireOperations(ops);
    expect(lu.remarques).toEqual([]);
    expect(lu.operations).toHaveLength(ops.length);
    expect(appliquerOperations(demo, ops).operations.length).toBe(ops.length);
  });

  it("plan à 3 pièces posées : 3 retirer-piece", () => {
    const [s0, ...reste] = demo.scenes;
    const base = { ...s0, niveau: 2 as const };
    const calque = (s0.calques ?? []).find((c) => c.piece !== "zoom-camera");
    if (!calque) return;
    const trois = valider({ ...structuredClone(PLAN_DEMO), scenes: [{ ...base, calques: [calque, calque, calque] }, ...reste.map((s) => ({ ...s, calques: undefined }))] });
    const r = retouchesDosage(trois).find((x) => x.id === "sans-animations");
    expect(r?.operations.filter((o) => o.type === "retirer-piece")).toHaveLength(3);
  });

  it("« Plus calme » : transition sobre + zooms adoucis, jamais sous 1", () => {
    const r = retouchesDosage(demo).find((x) => x.id === "plus-calme");
    expect(r).toBeDefined();
    for (const o of r!.operations) {
      expect(["changer-transition", "ajuster-zoom"]).toContain(o.type);
      if (o.type === "ajuster-zoom") expect(o.facteur).toBeGreaterThanOrEqual(1);
    }
    expect(lireOperations(r!.operations).remarques).toEqual([]);
  });

  it("plan sans pièce ni zoom : pas de « Sans animations »", () => {
    expect(retouchesDosage(nu).some((r) => r.id === "sans-animations")).toBe(false);
  });

  it("ordre fixe et même plan = même sortie", () => {
    const a = retouchesDosage(demo);
    expect(retouchesDosage(demo)).toEqual(a);
    expect(a.map((r) => r.id)).toEqual(["plus-calme", "sans-animations"].filter((id) => a.some((r) => r.id === id)));
  });

  it("garde : aucun import de comprendre.ts ni d'un client Claude", () => {
    const src = readFileSync("src/services/retouche-chat/retouches-dosage.ts", "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export .* from)/.test(l)).join("\n");
    expect(imports).not.toMatch(/comprendre|anthropic|claude/i);
    expect(src).not.toMatch(/fetch\(/);
  });
});
