/**
 * Q21 MESURABLE DEPUIS `src/` (décision de la direction) : le calcul d'emprise et de mise en page des composants vit
 * dans `src/briques/schema-motion/` (PUR, sans React, sans `remotion`, sans alias « @/ »), lu TEL QUEL par `studio-rendu`
 * (ré-exports) et par le contrôle Q21 du moteur. Mêmes fonctions, donc mêmes nombres : le rendu ne change pas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as partageEmprise from "@/briques/schema-motion/emprise";
import * as partageMiseEnPage from "@/briques/schema-motion/mise-en-page";
import * as partagePlan from "@/briques/schema-motion/plan-objets";
import * as partageTemps from "@/briques/schema-motion/temps";
import * as courbes from "@/briques/schema-motion/courbes";
import * as commun from "../../studio-rendu/compositions/cas-concret/plans/commun";
import * as renduEmprise from "../../studio-rendu/compositions/image-video/emprise";
import * as renduMiseEnPage from "../../studio-rendu/compositions/image-video/mise-en-page";
import * as renduPlan from "../../studio-rendu/compositions/image-video/plan-objets";
import * as renduPlanToile from "../../studio-rendu/compositions/image-video/plan";

const lire = (f: string) => readFileSync(join(process.cwd(), f), "utf8");
const PARTAGES = ["courbes", "temps", "chasse-anton", "mise-en-page", "plan-objets", "emprise"];

describe("module de mise en page partagé (studio-rendu et moteur)", () => {
  it("studio-rendu lit les MÊMES fonctions que le moteur (aucune copie)", () => {
    expect(renduEmprise.empriseMoment).toBe(partageEmprise.empriseMoment);
    expect(renduEmprise.empriseObjet).toBe(partageEmprise.empriseObjet);
    expect(renduEmprise.empriseEnsemble).toBe(partageEmprise.empriseEnsemble);
    expect(renduMiseEnPage.controlerMiseEnPage).toBe(partageMiseEnPage.controlerMiseEnPage);
    expect(renduMiseEnPage.zoneUtile).toBe(partageMiseEnPage.zoneUtile);
    expect(renduPlan.planCarteBenefice).toBe(partagePlan.planCarteBenefice);
    expect(renduPlan.planEnsemble).toBe(partagePlan.planEnsemble);
    expect(renduPlanToile.TEMPS_IV).toBe(partageTemps.TEMPS_IV);
    expect(renduPlanToile.couleurTrait).toBe(partageTemps.couleurTrait);
  });

  it("les fichiers partagés sont purs : ni React, ni remotion, ni alias « @/ », ni import de studio-rendu", () => {
    for (const f of PARTAGES) {
      const t = lire(`src/briques/schema-motion/${f}.ts`);
      expect(t, f).not.toMatch(/from ["'](react|remotion)["']/);
      expect(t, f).not.toMatch(/from ["']@\//);
      expect(t, f).not.toMatch(/from ["'][^"']*studio-rendu/);
    }
  });

  it("le Dockerfile du rendu copie tout le dossier partagé", () => {
    expect(lire("deploiement/studio-rendu/Dockerfile")).toMatch(/^COPY --chown=rendu:rendu src\/briques\/schema-motion \/app\/src\/briques\/schema-motion$/m);
  });

  it("courbes du plan des objets : mêmes valeurs que celles du cas concret (formules identiques)", () => {
    for (let k = -10; k <= 110; k++) {
      const x = k / 100;
      expect(courbes.c01(x)).toBe(commun.c01(x));
      expect(courbes.doux(x)).toBe(commun.doux(x));
      expect(courbes.va(x)).toBe(commun.va(x));
      expect(courbes.rebond(x)).toBe(commun.rebond(x));
      expect(courbes.progres(x, 0.2, 0.5)).toBe(commun.progres(x, 0.2, 0.5));
      expect(courbes.progres(x, 0.2, 0)).toBe(commun.progres(x, 0.2, 0));
    }
  });

  it("le service ne porte plus de phrase « mise en page non branchée »", () => {
    expect(lire("src/services/image-video.ts")).not.toMatch(/MISE_EN_PAGE_NON_BRANCHEE_IV/);
    expect(lire("src/moteurs/montage-image-video/controles.ts")).toMatch(/from "\.\/emprise-ligne"/);
    expect(lire("src/moteurs/montage-image-video/emprise-ligne.ts")).toMatch(/from "@\/briques\/schema-motion\/emprise"/);
  });
});
