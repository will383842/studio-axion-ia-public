/**
 * Génère `plan-demo-v3.json` (le plan complet de la démo v3, dans `studio-rendu/.../demo-v3/`) à partir de `sequence-demo.ts` : sous-titres (`groupesSousTitres`) et
 * bruitages (`bruitagesDuPlan`) viennent du réalisateur, jamais écrits à la main. À lancer depuis la racine du dépôt :
 *   npx tsx outils/facecam-animee-v3/generer-plan-demo.ts
 * Hors de `studio-rendu/` exprès : il importe le réalisateur (`src/`), absent de l'image du conteneur de rendu. Le test `demo-v3.test.ts`
 * vérifie que le fichier est à jour.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CHARTE_FACECAM_ANIMEE } from "../../src/moteurs/montage-facecam-animee";
import { VERSION_PLAN_FACECAM_ANIMEE, type PlanFacecamAnimee } from "../../src/domaine/facecam-animee/plan";
import { bruitagesDuPlan } from "../../src/moteurs/montage-facecam-animee/realisateur/sons";
import { groupesSousTitres } from "../../src/moteurs/montage-facecam-animee/realisateur/sous-titres";
import { DUREE_DEMO_V3_SEC, ELEMENTS_DEMO_V3, FIN_ECRAN_DEMO_V3, FPS_DEMO_V3, HAUTEUR_DEMO_V3, LARGEUR_DEMO_V3, MOTS_FORTS_DEMO_V3, PRISE_DEMO_V3, TRANSCRIPTION_DEMO_V3 } from "../../studio-rendu/compositions/interface-claire/demo-v3/sequence-demo";

export function planDemoV3(): PlanFacecamAnimee {
  const base = {
    cartes: [], fenetres: [], calques: [], zooms: [] as [number, number, number][],
    elementsV3: [...ELEMENTS_DEMO_V3],
    fin: { ...FIN_ECRAN_DEMO_V3, tuiles: [...FIN_ECRAN_DEMO_V3.tuiles] },
  };
  return {
    version: VERSION_PLAN_FACECAM_ANIMEE,
    charte: CHARTE_FACECAM_ANIMEE,
    duree: DUREE_DEMO_V3_SEC,
    fps: FPS_DEMO_V3,
    largeur: LARGEUR_DEMO_V3,
    hauteur: HAUTEUR_DEMO_V3,
    prise: { ...PRISE_DEMO_V3 },
    groupes: groupesSousTitres(TRANSCRIPTION_DEMO_V3, { motsForts: [...MOTS_FORTS_DEMO_V3] }),
    ...base,
    sons: bruitagesDuPlan(base),
    pastilles: false,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.dirname, "generer-plan-demo.ts")) {
  writeFileSync(resolve(import.meta.dirname, "../../studio-rendu/compositions/interface-claire/demo-v3/plan-demo-v3.json"), `${JSON.stringify(planDemoV3(), null, 1)}\n`);
  console.log("plan-demo-v3.json écrit");
}
