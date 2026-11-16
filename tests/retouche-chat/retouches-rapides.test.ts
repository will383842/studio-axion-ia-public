import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { appliquerOperations, impactRetouche, lireOperations } from "@/services/retouche-chat";
import { retouchesRapides } from "@/services/retouche-chat/retouches-rapides";

const valider = (p: unknown): PlanValide => validerPlan(p, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false, dureeMs: PLAN_DEMO.dureeMs }).plan;
const demo = valider(PLAN_DEMO);

describe("retouches rapides (S3-05)", () => {
  const liste = retouchesRapides(demo);

  it("propose entre 5 et 8 retouches aux ids uniques", () => {
    expect(liste.length).toBeGreaterThanOrEqual(5);
    expect(liste.length).toBeLessThanOrEqual(8);
    expect(new Set(liste.map((r) => r.id)).size).toBe(liste.length);
  });

  it("chaque retouche est valide au schéma, s'applique et change au moins une scène", () => {
    for (const r of liste) {
      expect(r.operations.length, r.id).toBeGreaterThan(0);
      expect(r.demande.length, r.id).toBeGreaterThan(0);
      const lu = lireOperations(r.operations);
      expect(lu.remarques, r.id).toEqual([]);
      expect(lu.operations).toHaveLength(r.operations.length);
      const res = appliquerOperations(demo, r.operations);
      expect(res.operations.length, r.id).toBe(r.operations.length);
      expect(impactRetouche(demo, res.plan, r.operations).scenes.length, r.id).toBeGreaterThan(0);
    }
  });

  it("jamais modifier-script, jamais ajouter-piece, aucun prix dans les libellés", () => {
    for (const r of liste) {
      expect(r.operations.some((o) => o.type === "modifier-script" || o.type === "ajouter-piece"), r.id).toBe(false);
      expect(`${r.libelle} ${r.demande}`).not.toMatch(/€|prix/i);
    }
  });

  it("plan sans zoom : « Zooms plus doux » est absent", () => {
    expect(liste.some((r) => r.id === "zooms-plus-doux")).toBe(true);
    const sansZoom = valider({ ...structuredClone(PLAN_DEMO), scenes: PLAN_DEMO.scenes.map((s) => ({ ...s, calques: s.calques?.filter((c) => c.piece !== "zoom-camera") })) });
    expect(retouchesRapides(sansZoom).some((r) => r.id === "zooms-plus-doux")).toBe(false);
  });

  it("fond : propose seulement le fond différent de l'actuel", () => {
    const noir = valider({ ...structuredClone(PLAN_DEMO), habillage: { fond: "noir", accent: "terracotta" } });
    const ids = retouchesRapides(noir).map((r) => r.id);
    expect(ids).toContain("fond-clair");
    expect(ids).not.toContain("fond-sombre");
    expect(liste.map((r) => r.id)).toContain("fond-sombre");
  });

  it("« Retirer la dernière pièce ajoutée » absente si aucune scène n'a de calque", () => {
    const sansCalque = valider({ ...structuredClone(PLAN_DEMO), scenes: PLAN_DEMO.scenes.filter((s) => !s.calques) });
    expect(retouchesRapides(sansCalque).some((r) => r.id === "retirer-derniere-piece")).toBe(false);
  });
});
