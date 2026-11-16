import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import {
  PLAFONDS_PAR_DEFAUT,
  type Emprise,
  type HabillagePlan,
  type PlafondsHabillage,
  type PlanHabille,
  type SensTransition,
} from "@/briques/motion/habillage-commun";

const DOSSIER = join(__dirname, "../../../src/briques/motion/habillage-commun");

describe("habillage-commun : contrat et plafonds de repli", () => {
  it("les plafonds par défaut sont bornés et éteints", () => {
    const p: PlafondsHabillage = PLAFONDS_PAR_DEFAUT;
    expect(Number.isInteger(p.transitionsRichesMax)).toBe(true);
    expect(p.transitionsRichesMax).toBeGreaterThanOrEqual(0);
    expect(p.transitionsRichesMax).toBeLessThanOrEqual(3);
    expect(p.partCoupesFranchesMin).toBeGreaterThanOrEqual(0.9);
    expect(p.partCoupesFranchesMin).toBeLessThanOrEqual(1);
    expect(p.pleinCadrePermis).toBe(false);
    expect(p.fondsAnimes).toBe(false);
    expect(p.lumieres).toBe(false);
  });

  it("un PlanValide sans habillageCommun est assignable à PlanHabille et inversement", () => {
    const plan = {} as PlanValide;
    const habille: PlanHabille = plan;
    const retour: PlanValide = habille;
    expect(retour).toBe(plan);
    const h: HabillagePlan = { pleinCadrePermis: false, version: "habillage-1", transitions: { s1: { entree: "x" } } };
    const avec: PlanHabille = { ...plan, habillageCommun: h };
    expect(avec.habillageCommun?.version).toBe("habillage-1");
    const e: Emprise = "boite";
    const s: SensTransition = "sortie";
    expect([e, s]).toEqual(["boite", "sortie"]);
  });

  it("aucun import @/ dans le dossier", () => {
    const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".ts"));
    expect(fichiers.length).toBeGreaterThan(0);
    for (const f of fichiers) {
      const src = readFileSync(join(DOSSIER, f), "utf8");
      expect(src).not.toMatch(/from\s+["']@\//);
    }
  });
});
