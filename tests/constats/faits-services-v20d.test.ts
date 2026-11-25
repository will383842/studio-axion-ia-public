// Constat v20d : prouve par lecture du TEXTE des sources (aucun import) que S-01, S-02, S-07, S-08, S2-13, C7-16 et G4-10 sont faits sur master.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const chemin = (...p: string[]) => join(RACINE, ...p);
const lire = (...p: string[]) => readFileSync(chemin(...p), "utf8");

describe("S-01 fait sur master", () => {
  const f = ["src", "domaine", "pannes-rendues.ts"];
  it("le module existe", () => expect(existsSync(chemin(...f))).toBe(true));
  it("liste fermée des 5 codes de panne rendue", () => {
    const t = lire(...f);
    expect(t).toContain("export const CODES_PANNE_RENDUE");
    for (const c of ["TABLEAU_NON_RELIE", "CAS_CONCRET_NON_RELIE", "FACECAM_NON_RELIE", "FACECAM_ANIMEE_NON_RELIE", "IV_NON_RELIE"]) expect(t).toContain(`"${c}"`);
    expect(t).toContain("export function estPanneRendue");
  });
});

describe("S-02 fait sur master", () => {
  const f = ["src", "domaine", "action-utile.ts"];
  it("le module existe", () => expect(existsSync(chemin(...f))).toBe(true));
  it("exporte actionUtileApresRefus avec les 4 familles de codes", () => {
    const t = lire(...f);
    expect(t).toContain("export function actionUtileApresRefus");
    for (const p of ["TABLEAU_", "CAS_CONCRET_", "IV_", "FACECAM_"]) expect(t).toContain(`"${p}"`);
  });
});

describe("S-07 fait sur master", () => {
  const f = ["src", "briques", "animation-element", "index.ts"];
  it("le module existe", () => expect(existsSync(chemin(...f))).toBe(true));
  it("exporte completerUids et creerUid", () => {
    const t = lire(...f);
    expect(t).toContain("export function completerUids");
    expect(t).toMatch(/function creerUid/);
  });
});

describe("S-08 fait sur master", () => {
  const f = ["src", "moteurs", "montage-cas-concret", "animation-ecran.ts"];
  it("le module existe", () => expect(existsSync(chemin(...f))).toBe(true));
  it("exporte appliquerAnimationEcran", () => {
    const t = lire(...f);
    expect(t).toContain("export function appliquerAnimationEcran");
    expect(t).toContain("PHRASE_VITESSE_ECRAN");
  });
});

describe("S2-13 fait sur master", () => {
  const f = ["tests", "retouche-chat", "v4-inchange.test.ts"];
  it("le test de garde existe", () => expect(existsSync(chemin(...f))).toBe(true));
  it("S2-13a (garde d'imports) et S2-13b (identité) sont présents", () => {
    const t = lire(...f);
    expect(t).toContain("S2-13a · garde « v4 inchangée »");
    expect(t).toContain("S2-13b · identité");
    expect(t).toContain("avancerChaineV4");
  });
});

describe("C7-16 fait sur master", () => {
  it("le rôle de compréhension est écrit", () => {
    const f = ["src", "services", "retouche-chat", "comprendre.ts"];
    expect(existsSync(chemin(...f))).toBe(true);
    const t = lire(...f);
    expect(t).toContain("export const MODELE_RETOUCHE_CHAT");
    expect(t).toContain("export async function comprendreDemande");
  });
  it("l'appel Claude n'est PAS branché (attend Williams)", () => {
    const f = ["src", "services", "retouche-chat", "studio.ts"];
    expect(existsSync(chemin(...f))).toBe(true);
    const t = lire(...f);
    expect(t).toContain("export const appelNonBranche");
    expect(t).toContain("LLM du chat de retouche non branché");
    expect(t).toMatch(/appeler: options\.appeler \?\? appelNonBranche/);
  });
});

describe("G4-10 fait sur master", () => {
  const f = ["studio-rendu", "compositions", "donnees", "TableauDeBordVideo.tsx"];
  it("la composition existe", () => expect(existsSync(chemin(...f))).toBe(true));
  it("elle porte G4-10a et est inscrite UNE fois dans Racine.tsx (MontageDonnees, G4-09b-v20h)", () => {
    expect(lire(...f)).toContain("G4-10a");
    const racine = chemin("studio-rendu", "compositions", "Racine.tsx");
    if (existsSync(racine)) expect(readFileSync(racine, "utf8").match(/<Composition id="MontageDonnees" component=\{TableauDeBordVideo\}/g)).toHaveLength(1);
  });
});

describe("garde de forme", () => {
  it("ce fichier n'importe aucun module de src/, studio-rendu/ ni outils/", () => {
    const t = readFileSync(__filename, "utf8");
    const imports = t.split("\n").filter((l) => /^\s*import\s/.test(l) || /\bimport\(/.test(l) || /\brequire\(/.test(l));
    expect(imports.filter((l) => /["'](@\/|.*\b(src|studio-rendu|outils)\/)/.test(l))).toEqual([]);
  });
});
