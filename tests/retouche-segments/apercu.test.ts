import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { OperationRetouche } from "@/briques/operations";
import { appliquerOperations, phraseImpact } from "@/services/retouche-chat";
import { PHRASES } from "@/briques/retouche-portee";
import { apercuRetouche, DUREE_RETOUCHE_SEC } from "@/services/retouche-segments";

const plan0 = (): PlanValide => validerPlan(PLAN_DEMO, { mots: PLAN_DEMO.mots, format: PLAN_DEMO.format, facecam: false }).plan;
const dyn = (ids: string[]): OperationRetouche[] => [{ type: "ajouter-dynamisme", intensite: "leger", sceneIds: ids }];

describe("aperçu avant retouche (pur, non branché)", () => {
  it("gratuite : durée en minutes au supérieur, scènes refaites sur N", () => {
    const ancien = plan0();
    const operations = dyn(["s1", "s3"]);
    const nouveau = appliquerOperations(ancien, operations).plan;
    const a = apercuRetouche({ generateur: "demo-facecam", ancien, nouveau, operations });
    expect(a.famille).toBe("gratuite");
    expect(a.scenes).toEqual(["s1", "s3"]);
    expect(a.total).toBe(ancien.scenes.length);
    expect(a.dureeSec).toBe(124);
    expect(a.phrase).toBe(`Gratuit · environ 3 min · 2 scènes sur ${ancien.scenes.length}`);
  });

  it("voix : refusée, phrase de D4-F5, aucun montant", () => {
    const ancien = plan0();
    const operations: OperationRetouche[] = [{ type: "modifier-script", ancien: "38", nouveau: "40" }];
    const a = apercuRetouche({ generateur: "demo-facecam", ancien, nouveau: ancien, operations });
    expect(a.famille).toBe("refusee");
    expect(a.portees).toContain("voix");
    expect(a.phrase).toBe(`Payant : refusé. ${PHRASES.voix}`);
    expect(a.phrase).not.toMatch(/€|euro|\d+\s?\$/i);
  });

  it("générateur inconnu : durée nulle et phrase sans durée", () => {
    const ancien = plan0();
    const operations = dyn(["s1"]);
    const nouveau = appliquerOperations(ancien, operations).plan;
    const a = apercuRetouche({ generateur: "inconnu", ancien, nouveau, operations });
    expect(a.dureeSec).toBeNull();
    expect(a.phrase).toBe(`Gratuit · 1 scène sur ${ancien.scenes.length}`);
    expect(a.phrase).not.toMatch(/min/);
  });

  it("aucune opération : 0 scène, cohérent avec phraseImpact", () => {
    const ancien = plan0();
    const a = apercuRetouche({ generateur: "tutoriel-outil", ancien, nouveau: ancien, operations: [] });
    expect(a.scenes).toEqual([]);
    expect(a.dureeSec).toBe(120);
    expect(a.phrase).toBe(`Gratuit · environ 2 min · 0 scène sur ${ancien.scenes.length}`);
    expect(phraseImpact({ scenes: [], total: a.total, voixTouchee: false })).toContain("Aucune scène");
  });

  it("table des durées : une ligne par générateur annoncé", () => {
    expect(DUREE_RETOUCHE_SEC).toEqual({ "demo-facecam": 124, "tutoriel-outil": 120 });
  });

  it("garde statique : aucun import d'argent, de fournisseur ni de Claude", () => {
    for (const f of ["apercu.ts", "index.ts"]) {
      const src = readFileSync(`src/services/retouche-segments/${f}`, "utf8");
      expect(src).not.toMatch(/fournisseurs\/|credits|couts|generation-claude/);
    }
  });
});
