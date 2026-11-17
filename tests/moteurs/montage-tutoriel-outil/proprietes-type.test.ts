/**
 * R0-TYPES : `ProprietesTutorielOutil` est un alias `type` (et non une `interface`) pour que Remotion l'accepte comme
 * propriétés de composition (`Record<string, unknown>`). Les propriétés construites passent aussi la validation zod
 * existante du plan de scènes.
 */
import { describe, expect, it } from "vitest";
import { schemaPlanStrict } from "@/briques/plan-scenes/schema";
import { validerPlan } from "@/briques/plan-scenes/validateur";
import { CARTE_FIN_AXION, DUREE_CARTE_FIN_MS, dureeImagesTutoriel, planCarteFin, type ProprietesTutorielOutil } from "@/moteurs/montage-tutoriel-outil/proprietes";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";

const plan = validerPlan(PLAN_DEMO).plan;
const proprietes: ProprietesTutorielOutil = { plan, fin: { ...CARTE_FIN_AXION }, finMs: DUREE_CARTE_FIN_MS };

describe("propriétés du tutoriel outil", () => {
  it("sont assignables à Record<string, unknown> (exigence de Remotion)", () => {
    // Échoue à la compilation (tsc) si ProprietesTutorielOutil redevient une interface.
    const pourRemotion: Record<string, unknown> = proprietes;
    expect(Object.keys(pourRemotion).sort()).toEqual(["fin", "finMs", "plan"]);
  });

  it("portent un plan valide pour le schéma zod strict, et la carte de fin aussi", () => {
    const { scenes, ...entete } = proprietes.plan;
    expect(schemaPlanStrict.safeParse({ ...entete, scenes: scenes.map(({ empreinte: _e, ...s }) => s) }).success).toBe(true);
    const carte = planCarteFin(proprietes);
    expect(carte.scenes.length).toBeGreaterThan(0);
    expect(dureeImagesTutoriel(proprietes)).toBeGreaterThan(0);
  });
});
