/**
 * Constat v20d : G12-07, G12-09a, G12-09b, C8-Z08 et G3-06a sont faits sur master.
 * Lecture du TEXTE des sources seulement (aucun import des fichiers lus). Si une pièce est retirée, le test rougit.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const chemin = (...p: string[]): string => join(RACINE, ...p);
const lire = (...p: string[]): string => readFileSync(chemin(...p), "utf8");
const MOTEUR = ["src", "moteurs", "montage-facecam-animee"];

describe("G12-07 fait sur master", () => {
  it("projet-v4.ts existe et exporte projetMontageV4", () => {
    expect(existsSync(chemin(...MOTEUR, "projet-v4.ts"))).toBe(true);
    expect(lire(...MOTEUR, "projet-v4.ts")).toMatch(/export function projetMontageV4\(/);
  });
  it("index.ts importe et utilise projetMontageV4", () => {
    const t = lire(...MOTEUR, "index.ts");
    expect(t).toContain('import { projetMontageV4 } from "./projet-v4"');
    expect(t).toMatch(/\.\.\.projetMontageV4\(etat\)/);
  });
});

describe("G12-09a fait sur master", () => {
  it("retouche-gratuite.ts existe et exporte lireProjetGardeV4", () => {
    expect(existsSync(chemin(...MOTEUR, "retouche-gratuite.ts"))).toBe(true);
    expect(lire(...MOTEUR, "retouche-gratuite.ts")).toMatch(/export function lireProjetGardeV4\(/);
  });
  it("reprise-rendu-v4.ts existe et exporte etatRepriseAuRenduV4", () => {
    expect(existsSync(chemin(...MOTEUR, "reprise-rendu-v4.ts"))).toBe(true);
    expect(lire(...MOTEUR, "reprise-rendu-v4.ts")).toMatch(/export function etatRepriseAuRenduV4\(/);
  });
});

describe("G12-09b fait sur master", () => {
  it("index.ts porte la clé de retouche gratuite et la mention G12-09b", () => {
    const t = lire(...MOTEUR, "index.ts");
    expect(t).toMatch(/export const CLE_RETOUCHE_GRATUITE_FA = Symbol\.for\(/);
    expect(t).toContain("G12-09b-a");
  });
  it("le service facecam-animee-retouche.ts existe et exporte actualiserRetoucheGratuiteFA", () => {
    expect(existsSync(chemin("src", "services", "facecam-animee-retouche.ts"))).toBe(true);
    const t = lire("src", "services", "facecam-animee-retouche.ts");
    expect(t).toMatch(/export async function actualiserRetoucheGratuiteFA\(/);
    expect(t).toContain("CLE_RETOUCHE_GRATUITE_FA");
  });
});

describe("C8-Z08 fait sur master", () => {
  it("zoom-prise.ts existe et exporte filtreZoomPrise", () => {
    expect(existsSync(chemin("studio-rendu", "src", "composition", "zoom-prise.ts"))).toBe(true);
    expect(lire("studio-rendu", "src", "composition", "zoom-prise.ts")).toMatch(/export function filtreZoomPrise\(/);
  });
  it("facecam-v4.ts porte zoomsPrise et le branche dans le filtre de montage", () => {
    const t = lire("studio-rendu", "src", "operations", "facecam-v4.ts");
    expect(t).toMatch(/zoomsPrise\?: \{ fenetres: FenetreZoomRendu\[\]/);
    expect(t).toMatch(/export function lireZoomsPriseV4\(/);
  });
});

describe("G3-06a fait sur master", () => {
  const f = ["src", "app", "(studio)", "demo-facecam", "actions-lancement.ts"];
  it("actions-lancement.ts existe et exporte lancerDemoFacecam", () => {
    expect(existsSync(chemin(...f))).toBe(true);
    expect(lire(...f)).toMatch(/export async function lancerDemoFacecam\(/);
  });
  it("le lancement exige un accord (lancerAvecAccord) et refuse si la démo est fermée", () => {
    const t = lire(...f);
    expect(t).toContain("lancerAvecAccord(");
    expect(t).toContain('code: "DEMO_FERMEE"');
    expect(t).toContain("G3-06a-b");
  });
});

describe("garde de forme", () => {
  it("ce fichier n'importe aucun module de src/, studio-rendu/ ni outils/", () => {
    const moi = lire("tests", "constats", "faits-facecam-animee-v20d.test.ts");
    const imports = moi.split("\n").filter((l) => /^\s*import\b/.test(l));
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) expect(l).not.toMatch(/from\s+["'](?:@\/|\.{1,2}\/|(?:src|studio-rendu|outils)\/)/);
    expect(moi).not.toMatch(/await import\(/);
  });
});
