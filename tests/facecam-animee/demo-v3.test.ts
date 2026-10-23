/**
 * FACE CAMÉRA ANIMÉE — DÉMO v3 (~22 s, 1080 × 1920) : le plan de `studio-rendu/.../demo-v3/` (8 éléments ACTIFS, choisis selon les
 * règles) passe `verifierPlan` sans erreur et est rendable ; `plan-demo-v3.json` est à jour (sous-titres et bruitages viennent du
 * réalisateur). La composition est enregistrée. Aucun rendu ici.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ficheV3 } from "@/moteurs/montage-facecam-animee/realisateur/catalogue-v3";
import { verifierPlan } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import { controlerSuiteV3, resoudreElementsV3 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v3";
import { schemaPlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { planDemoV3 } from "../../outils/facecam-animee-v3/generer-plan-demo";
import {
  DUREE_DEMO_V3_SEC, ELEMENTS_DEMO_V3, FIN_DEMO_V3_SEC, FPS_DEMO_V3, HAUTEUR_DEMO_V3, LARGEUR_DEMO_V3, TRANSCRIPTION_DEMO_V3,
} from "../../studio-rendu/compositions/interface-claire/demo-v3/sequence-demo";

const DOSSIER = join(process.cwd(), "studio-rendu/compositions/interface-claire");

describe("démo v3 · la séquence respecte les règles v3", () => {
  const plan = planDemoV3();

  it("1080 × 1920, 30 i/s, ~22 s ; au moins 6 éléments ACTIFS et variés (5 familles, 6 emplacements)", () => {
    expect([LARGEUR_DEMO_V3, HAUTEUR_DEMO_V3, FPS_DEMO_V3]).toEqual([1080, 1920, 30]);
    expect(DUREE_DEMO_V3_SEC).toBeGreaterThanOrEqual(20);
    expect(DUREE_DEMO_V3_SEC).toBeLessThanOrEqual(24);
    const fiches = ELEMENTS_DEMO_V3.map((e) => ficheV3(e.id)!);
    expect(fiches).toHaveLength(8);
    expect(fiches.every((f) => f?.actif)).toBe(true);
    expect(new Set(fiches.map((f) => f.id)).size).toBe(8);
    expect(new Set(fiches.map((f) => f.famille)).size).toBe(5);
    expect(new Set(fiches.map((f) => f.emplacement)).size).toBeGreaterThanOrEqual(5);
  });

  it("D0 : chaque élément existe, est actif, a la durée de sa fiche et tient avant l'écran de fin", () => {
    expect(resoudreElementsV3(ELEMENTS_DEMO_V3, DUREE_DEMO_V3_SEC).erreurs).toEqual([]);
    expect(Math.max(...ELEMENTS_DEMO_V3.map((e) => e.fin))).toBeLessThanOrEqual(FIN_DEMO_V3_SEC);
  });

  it("aucune erreur sur la suite (V1 à V7, D2, D11 à D15) avec la transcription de la démo", () => {
    const r = controlerSuiteV3(resoudreElementsV3(ELEMENTS_DEMO_V3, DUREE_DEMO_V3_SEC).elements, { duree: DUREE_DEMO_V3_SEC, finDebut: FIN_DEMO_V3_SEC, yeux: plan.prise.yeux }, TRANSCRIPTION_DEMO_V3);
    expect(r.erreurs, r.erreurs.join("\n")).toEqual([]);
    expect(r.mesures.coupsDePoing).toBe(1);
    expect(r.mesures.premierCoupDePoingSec).toBeGreaterThanOrEqual(8);
    expect(r.mesures.premierCouvrantSec).toBeGreaterThanOrEqual(3);
  });

  it("`verifierPlan` : le plan complet est valide, SANS erreur et rendable ; ni zoom, ni mouvement de prise", () => {
    expect(schemaPlanFacecamAnimee.safeParse(plan).success).toBe(true);
    const r = verifierPlan(plan, TRANSCRIPTION_DEMO_V3);
    expect(r.erreurs, r.erreurs.join("\n")).toEqual([]);
    expect(r.rendable).toBe(true);
    expect(plan.zooms).toEqual([]);
    expect(plan.mouvements ?? []).toEqual([]);
    expect([plan.cartes, plan.fenetres, plan.calques, plan.motions ?? []].every((t) => t.length === 0)).toBe(true);
  });

  it("aucune musique : tous les sons du plan sont des bruitages de sons/", () => {
    for (const [, son] of plan.sons) {
      expect(son).not.toMatch(/musi/i);
      expect(existsSync(join(DOSSIER, `sons/${son}.wav`)), son).toBe(true);
    }
  });

  it("aucun chiffre ni mot non dit : « Villeexemple » absent, aucun chiffre affiché", () => {
    const affiche = ELEMENTS_DEMO_V3.flatMap((e) => [...(e.mots ?? []), ...(e.lignes ?? []).map((l) => l.texte)]).join(" ");
    expect(affiche).not.toMatch(/villeexemple/i);
    expect(affiche).not.toMatch(/\d/);
  });

  it("`plan-demo-v3.json` est à jour (régénérer avec `npx tsx outils/facecam-animee-v3/generer-plan-demo.ts`)", () => {
    const json = JSON.parse(readFileSync(join(DOSSIER, "demo-v3/plan-demo-v3.json"), "utf8"));
    expect(json).toEqual(JSON.parse(JSON.stringify(plan)));
  });

  it("composition : enregistrée dans Compositions.tsx, importe React, image de prise 1080 × 1920", () => {
    const comp = readFileSync(join(DOSSIER, "Compositions.tsx"), "utf8");
    expect(comp).toContain('demoV3: "InterfaceClaireDemoV3"');
    expect(comp).toMatch(/<Composition id=\{COMPOSITIONS_INTERFACE_CLAIRE\.demoV3\}/);
    expect(readFileSync(join(DOSSIER, "demo-v3/DemoV3.tsx"), "utf8")).toMatch(/^\s*import React\b/m);
    const png = readFileSync(join(DOSSIER, "demo-v2/prise-commune-1080x1920.png"));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1920]);
  });

  it("la vidéo de démo enregistrée dans docs/ reste sous 15 Mo (si elle est là)", () => {
    const f = join(process.cwd(), "docs/facecam-animee-v3/demo/demo-v3-20s.mp4");
    if (existsSync(f)) expect(statSync(f).size).toBeLessThan(15 * 1024 * 1024);
  });
});
