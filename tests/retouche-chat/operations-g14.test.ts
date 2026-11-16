import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import { TYPES_OPERATIONS_RETOUCHE, type OperationRetouche } from "@/briques/operations";
import { PORTEE_CHAT } from "@/briques/retouche-portee";
import { appliquerOperations } from "@/services/retouche-chat/appliquer";
import { lireOperations } from "@/services/retouche-chat/schema";
import { exporterPlanLisible } from "@/services/retouche-chat/export-plan";
import { readFileSync } from "node:fs";
import { ADAPTATEURS_RETOUCHE } from "@/services/retouche-chat/generateurs";

const NEUVES = ["couper-mots", "changer-sous-titre", "retirer-scene", "changer-son", "deplacer"] as const;
const plan0 = (): PlanValide => validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;

describe("G14-02 : liste, schéma strict, portées, export", () => {
  it("les cinq types sont dans LA liste, portée final, aucune voix", () => {
    for (const t of NEUVES) {
      expect(TYPES_OPERATIONS_RETOUCHE).toContain(t);
      expect(PORTEE_CHAT[t]).toBe("final");
    }
    expect(TYPES_OPERATIONS_RETOUCHE).toHaveLength(17);
  });
  it("le schéma strict lit les cinq ; un champ en trop les écarte", () => {
    const bonnes = [
      { type: "couper-mots", premier: 2, dernier: 4 },
      { type: "changer-sous-titre", motIndex: 3, nouveau: "Pro" },
      { type: "retirer-scene", sceneId: "s2" },
      { type: "changer-son", sceneId: "s2", sonId: "studio/impact-1" },
      { type: "deplacer", sceneId: "s3", apresSceneId: "s1" },
    ];
    const r = lireOperations(bonnes);
    expect(r.remarques).toEqual([]);
    expect(r.operations).toHaveLength(5);
    for (const b of bonnes) expect(lireOperations([{ ...b, code: "x" }]).operations).toEqual([]);
    expect(lireOperations([{ type: "couper-mots", premier: -1, dernier: 2 }]).operations).toEqual([]);
  });
  it("l'export lisible nomme les cinq et compte les opérations", () => {
    const t = exporterPlanLisible(plan0());
    for (const n of NEUVES) expect(t).toContain(n);
    expect(t).toContain("(17, rien d'autre)");
  });
  it("COMMUNES inchangé : aucune des cinq n'est offerte à un générateur", () => {
    for (const a of Object.values(ADAPTATEURS_RETOUCHE)) for (const n of NEUVES) expect(a.operations as readonly string[], `${a.id} / ${n}`).not.toContain(n);
    const src = readFileSync("src/services/retouche-chat/generateurs.ts", "utf8");
    const communes = /const COMMUNES[^\n]*/.exec(src)?.[0] ?? "";
    expect(communes).toContain('"ajuster-zoom"');
    for (const n of NEUVES) expect(communes).not.toContain(`"${n}"`);
  });
});

describe("G14-02 : appliquer", () => {
  it("opérations d'aujourd'hui : plan identique au caractère près (liste vide)", () => {
    const p = plan0();
    expect(JSON.stringify(appliquerOperations(p, []).plan)).toBe(JSON.stringify(appliquerOperations(p, []).plan));
    const r = appliquerOperations(p, [{ type: "ajuster-zoom", sceneId: "s2", facteur: 1.3 }]);
    expect(r.operations).toHaveLength(1);
  });
  it("retirer-scene : la scène disparaît, le plan reste valide, mots recouverts", () => {
    const p = plan0();
    const r = appliquerOperations(p, [{ type: "retirer-scene", sceneId: "s2" }]);
    expect(r.plan.scenes.map((s) => s.id)).not.toContain("s2");
    expect(r.plan.scenes).toHaveLength(p.scenes.length - 1);
    expect(r.plan.mots).toEqual(p.mots);
    expect(r.operations).toHaveLength(1);
    expect(validerPlan(r.plan, { mots: r.plan.mots, format: r.plan.format, facecam: false }).remarques.filter((x) => x.code === "PLAN_ILLISIBLE")).toEqual([]);
  });
  it("retirer-scene : scène inconnue ou dernière scène → remarque, plan inchangé", () => {
    const p = plan0();
    const r = appliquerOperations(p, [{ type: "retirer-scene", sceneId: "zz" }]);
    expect(r.remarques.some((x) => x.code === "OPERATION_IGNOREE")).toBe(true);
    expect(r.plan.scenes.map((s) => s.id)).toEqual(p.scenes.map((s) => s.id));
    const seule = appliquerOperations(p, p.scenes.slice(0, -1).map((s) => ({ type: "retirer-scene", sceneId: s.id }) as OperationRetouche));
    const derniere = seule.plan.scenes[0]!.id;
    const r2 = appliquerOperations(seule.plan, [{ type: "retirer-scene", sceneId: derniere }]);
    expect(r2.plan.scenes).toHaveLength(1);
    expect(r2.remarques.some((x) => x.code === "OPERATION_IGNOREE")).toBe(true);
  });
  it("deplacer : la scène change de place, minutage et voix inchangés", () => {
    const p = plan0();
    const r = appliquerOperations(p, [{ type: "deplacer", sceneId: "s3", apresSceneId: "s1" }]);
    expect(r.plan.scenes.map((s) => s.id)).toEqual(["s1", "s3", "s2"]);
    expect(r.plan.mots).toEqual(p.mots);
    expect(r.plan.scenes.map((s) => [s.debutMs, s.finMs])).toEqual(p.scenes.map((s) => [s.debutMs, s.finMs]));
    expect(r.plan.scenes.map((s) => s.mots)).toEqual(p.scenes.map((s) => s.mots));
    expect(r.operations).toHaveLength(1);
  });
  it("deplacer : scène inconnue, sur elle-même → remarque, plan inchangé", () => {
    const p = plan0();
    for (const op of [{ type: "deplacer", sceneId: "zz", apresSceneId: "s1" }, { type: "deplacer", sceneId: "s1", apresSceneId: "s1" }, { type: "deplacer", sceneId: "s1", apresSceneId: "zz" }] as OperationRetouche[]) {
      const r = appliquerOperations(p, [op]);
      expect(r.remarques.some((x) => x.code === "OPERATION_IGNOREE")).toBe(true);
      expect(r.plan.scenes.map((s) => s.id)).toEqual(p.scenes.map((s) => s.id));
    }
  });
  it("changer-son : hors liste → remarque avec la phrase de refus ; dans la liste → pas encore rendu, plan inchangé", () => {
    const p = plan0();
    const hors = appliquerOperations(p, [{ type: "changer-son", sceneId: "s2", sonId: "studio/nouveau-son" }]);
    expect(hors.operations).toEqual([]);
    expect(hors.remarques.find((x) => x.code === "OPERATION_IGNOREE")?.message).toContain("pas dans la liste des sons");
    const dans = appliquerOperations(p, [{ type: "changer-son", sceneId: "s2", sonId: "studio/impact-1" }]);
    expect(dans.operations).toEqual([]);
    expect(dans.remarques.find((x) => x.code === "OPERATION_IGNOREE")?.message).toContain("pas encore appliquée");
    expect(JSON.stringify(dans.plan)).toBe(JSON.stringify(appliquerOperations(p, []).plan));
  });
  it("couper-mots et changer-sous-titre : jamais modifier-script ; remarque claire, plan et mots inchangés", () => {
    const p = plan0();
    const ref = JSON.stringify(appliquerOperations(p, []).plan);
    for (const op of [{ type: "couper-mots", premier: 1, dernier: 2 }, { type: "changer-sous-titre", motIndex: 1, nouveau: "Pro" }] as OperationRetouche[]) {
      const r = appliquerOperations(p, [op]);
      expect(r.operations).toEqual([]);
      expect(r.remarques.find((x) => x.code === "OPERATION_IGNOREE")?.message).toContain("pas encore appliquée pour ce générateur");
      expect(JSON.stringify(r.plan)).toBe(ref);
    }
  });
});
