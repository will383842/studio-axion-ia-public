import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { lireOperations } from "@/services/retouche-chat";
import { retouchesRapides } from "@/services/retouche-chat/retouches-rapides";

const valider = (p: unknown): PlanValide => validerPlan(p, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false, dureeMs: PLAN_DEMO.dureeMs }).plan;
const demo = valider(PLAN_DEMO);
const nu = valider({ ...structuredClone(PLAN_DEMO), scenes: PLAN_DEMO.scenes.map((s) => ({ ...s, calques: undefined })) });
const sombre = valider({ ...structuredClone(PLAN_DEMO), habillage: { ...PLAN_DEMO.habillage, fond: "noir" } });
const unique = valider({ ...structuredClone(PLAN_DEMO), scenes: PLAN_DEMO.scenes.slice(0, 2) });
const plans = [demo, nu, sombre, unique];
const ids = (p: PlanValide, o?: { dosageActif?: boolean }) => retouchesRapides(p, o).map((r) => r.id);

describe("retouches rapides + dosage (X3-12b-a)", () => {
  it("éteint : sans option, {}, false ou valeur étrangère = exactement la liste d'avant", () => {
    for (const p of plans) {
      const base = retouchesRapides(p);
      expect(retouchesRapides(p, {})).toEqual(base);
      expect(retouchesRapides(p, { dosageActif: false })).toEqual(base);
      expect(retouchesRapides(p, { dosageActif: "true" as never })).toEqual(base);
      expect(base.some((r) => r.id === "sans-animations" || r.id === "plus-calme")).toBe(false);
    }
  });

  it("allumé + plan à 3 pièces : « sans-animations » avant « retirer-derniere-piece »", () => {
    const i = demo.scenes.findIndex((s) => (s.calques ?? []).some((c) => c.piece !== "zoom-camera"));
    expect(i).toBeGreaterThanOrEqual(0);
    const calque = (demo.scenes[i].calques ?? []).find((c) => c.piece !== "zoom-camera");
    const trois = valider({ ...structuredClone(PLAN_DEMO), scenes: demo.scenes.map((s, k) => (k === i ? { ...s, calques: [calque, calque, calque] } : { ...s, calques: undefined })) });
    const l = ids(trois, { dosageActif: true });
    expect(l).toContain("sans-animations");
    expect(l.indexOf("sans-animations")).toBeLessThan(l.indexOf("retirer-derniere-piece"));
  });

  it("plan le plus chargé : 8 entrées, ordre attendu", () => {
    expect(ids(demo)).toHaveLength(6);
    expect(ids(demo, { dosageActif: true })).toEqual([
      "plus-dynamique",
      "beaucoup-plus-dynamique",
      "zooms-plus-doux",
      "fond-sombre",
      "transitions-plus-simples",
      "plus-calme",
      "sans-animations",
      "retirer-derniere-piece",
    ]);
  });

  it("longueur ≤ 8, ids uniques, opérations toutes valides", () => {
    for (const p of plans) {
      const liste = retouchesRapides(p, { dosageActif: true });
      expect(liste.length).toBeLessThanOrEqual(8);
      expect(new Set(liste.map((r) => r.id)).size).toBe(liste.length);
      for (const r of liste) {
        const lu = lireOperations(r.operations);
        expect(lu.remarques, r.id).toEqual([]);
        expect(lu.operations).toHaveLength(r.operations.length);
      }
    }
  });

  it("plan sans pièce ni zoom : pas de « sans-animations »", () => {
    expect(ids(nu, { dosageActif: true })).not.toContain("sans-animations");
  });

  it("sans « retirer-derniere-piece » : les entrées de dosage sont ajoutées à la fin", () => {
    const l = ids(unique, { dosageActif: true });
    if (!l.includes("retirer-derniere-piece") && l.includes("sans-animations")) expect(l[l.length - 1]).toBe("sans-animations");
    expect(l.length).toBeLessThanOrEqual(8);
  });

  it("garde : aucun import de comprendre.ts ni d'un client Claude", () => {
    const src = readFileSync("src/services/retouche-chat/retouches-rapides.ts", "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*(comprendre|anthropic|claude)[^"']*["']/i);
  });
});
