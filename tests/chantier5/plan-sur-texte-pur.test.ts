/**
 * C5-5.03 : `planScenes` facultatif sur le calque texte et deux fonctions pures (`imagePlanAuTemps`, `planDessinableSur`).
 * `imagePlanAuTemps` réécrit la règle de `sceneActive` sans importer `rendu.tsx` : ce test garantit l'alignement.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { imagePlanAuTemps, planDessinableSur, type ProprietesTexteComposition } from "@/briques/composition/scene";
import { PLAN_DEMO } from "@/briques/plan-scenes/demo";
import { dureeImagesPlan, sceneActive } from "@/briques/plan-scenes/rendu";
import { validerPlan } from "@/briques/plan-scenes/validateur";

const RACINE = join(__dirname, "..", "..");
const plan = validerPlan(PLAN_DEMO).plan;
const fps = plan.format.fps;

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const nom of readdirSync(dossier)) {
    if (nom === "node_modules" || nom === "dist") continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, sortie);
    else if (/\.(ts|tsx)$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

describe("imagePlanAuTemps", () => {
  it("est égale à sceneActive sur chaque image du plan de démonstration", () => {
    const n = dureeImagesPlan(plan);
    for (let image = 0; image <= n; image++) {
      const r = imagePlanAuTemps(plan, image / fps);
      expect(r !== null).toBe(sceneActive(plan, image) !== undefined);
      if (r !== null) expect(r).toBe(image);
    }
  });

  it("gère les bords : coupe, temps négatif, après la fin", () => {
    const coupe = plan.scenes[2]; // coupe franche : la scène 1 finit où la 2 commence
    const imageCoupe = Math.ceil((coupe.debutMs * fps) / 1000);
    expect(imagePlanAuTemps(plan, imageCoupe / fps)).toBe(imageCoupe);
    expect(imagePlanAuTemps(plan, (imageCoupe - 1) / fps)).toBe(imageCoupe - 1);
    expect(imagePlanAuTemps(plan, -0.04)).toBeNull();
    // trou entre deux scènes (la scène 0 finit avant le début de la 1) : aucune image
    const trou = Math.ceil((plan.scenes[0].finMs * fps) / 1000) / fps;
    expect(imagePlanAuTemps(plan, trou)).toBeNull();
    expect(imagePlanAuTemps(plan, plan.dureeMs / 1000 + 5)).toBeNull();
  });
});

describe("planDessinableSur", () => {
  const p = { format: { largeur: 1080, hauteur: 1920, fps: 25 as const } };
  it("vrai seulement si largeur et hauteur sont égales", () => {
    expect(planDessinableSur(p, { largeur: 1080, hauteur: 1920 })).toBe(true);
    expect(planDessinableSur(p, { largeur: 1080, hauteur: 1350 })).toBe(false);
    expect(planDessinableSur(p, { largeur: 1080, hauteur: 1080 })).toBe(false);
    expect(planDessinableSur(p, { largeur: 1920, hauteur: 1080 })).toBe(false);
  });
});

describe("garde d'imports et d'éteint", () => {
  it("planScenes est facultatif sur le calque texte", () => {
    const sans: Pick<ProprietesTexteComposition, "planScenes"> = {};
    expect(sans.planScenes).toBeUndefined();
  });
  it("aucun fichier de studio-rendu n'importe texte-derriere ni plan-scenes-generateurs", () => {
    for (const f of fichiers(join(RACINE, "studio-rendu"))) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/briques\/composition\/texte-derriere|plan-scenes-generateurs\//);
    }
  });
  it("scene.ts n'importe ni rendu.tsx ni zod ni @/", () => {
    const src = readFileSync(join(RACINE, "src/briques/composition/scene.ts"), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*(import|export)\b.*\bfrom\b/.test(l));
    for (const l of imports) expect(l).not.toMatch(/plan-scenes\/rendu|"zod"|"@\//);
  });
});
