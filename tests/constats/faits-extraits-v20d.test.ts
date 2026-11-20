// CONSTAT-FAITS-EXTRAITS-v20d : preuve par lecture du texte des sources (aucun import des fichiers lus).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const lire = (chemin: string): string => {
  const complet = join(RACINE, ...chemin.split("/"));
  expect(existsSync(complet), `fichier absent : ${chemin}`).toBe(true);
  return readFileSync(complet, "utf8");
};

describe("X4-11 fait sur master", () => {
  const t = lire("src/briques/archive-extraits/attente-publication.ts");
  it("liste des origines proposables avant publication", () => {
    expect(t).toContain("ORIGINES_AVANT_PUBLICATION");
    expect(t).toMatch(/"ecran-demo"[\s\S]*"capture-cas"[\s\S]*"scene"/);
  });
  it("fonction de politique exportée", () => {
    expect(t).toMatch(/export function plageProposableAvantPublication/);
  });
});

describe("X4-12 fait sur master", () => {
  const t = lire("src/app/(studio)/bibliotheque/source-extraits/actions-note.ts");
  it("action garderQuandMemeAction exportée", () => {
    expect(t).toMatch(/export async function garderQuandMemeAction/);
  });
  it("action changerSujetAction exportée et geste du service appelé", () => {
    expect(t).toMatch(/export async function changerSujetAction/);
    expect(t).toContain("garderQuandMemeExtrait(");
  });
});

describe("X4-13 fait sur master", () => {
  const t = lire("src/app/(studio)/bibliotheque/page.tsx");
  it("tuile EXTRAITS de type source-extraits", () => {
    expect(t).toMatch(/const EXTRAITS = \{ type: "source-extraits"/);
    expect(t).toContain("X4-13b");
  });
  it("tuile ajoutée seulement si l'archive est active", () => {
    expect(t).toMatch(/archiveActive \? \[\.\.\.types, EXTRAITS\]/);
  });
});

describe("X4-14 fait sur master", () => {
  const t = lire("src/briques/bibliotheque-video/pioche-extraits.ts");
  it("type CandidatNote exporté", () => {
    expect(t).toMatch(/export type CandidatNote/);
  });
  it("fonction choisirExtrait exportée", () => {
    expect(t).toMatch(/export function choisirExtrait\(/);
    expect(t).toMatch(/export interface BesoinExtrait/);
  });
});

describe("X3-09 fait sur master", () => {
  const t = lire("src/assistant/etapes/Reglages.tsx");
  it("patchAnimations exportée (X3-09b)", () => {
    expect(t).toMatch(/export function patchAnimations\(/);
    expect(t).toContain("X3-09b");
  });
  it("« Aucun » coupe aussi les bruitages", () => {
    expect(t).toMatch(/cran === "aucun"\s*\?\s*\{ dosageMotion: cran, bruitages: "aucun" \}/);
  });
});

describe("X3-12 fait sur master", () => {
  const t = lire("src/services/retouche-chat/retouches-dosage.ts");
  it("retouchesDosage exportée", () => {
    expect(t).toMatch(/export function retouchesDosage\(plan: PlanValide\): RetoucheRapide\[\]/);
  });
  it("retouches construites depuis des opérations lues", () => {
    expect(t).toContain("lireOperations(");
    expect(t).toContain("liste.push(");
  });
});

describe("X2-10 fait sur master", () => {
  const refus = lire("src/services/variete-commune/refus.ts");
  const cas = lire("src/services/variete-commune/refus-commun-cas-concret.ts");
  it("refus commun : X2-10a, éteint par défaut, garde facultative par défaut verifier", () => {
    expect(refus).toContain("X2-10a");
    expect(refus).toContain("X2-10b");
    expect(refus).toMatch(/export async function refusCommunPour/);
    expect(refus).toMatch(/\(d\.garde \?\? verifier\)\(/);
  });
  it("cas concret dérivé de refusCommunPour", () => {
    expect(cas).toMatch(/export type DemandeRefusCommunCasConcret = Parameters<typeof refusCommunPour>\[0\]/);
    expect(cas).toMatch(/export async function refusCommunCasConcret/);
  });
});

describe("garde de forme", () => {
  it("ce fichier n'importe aucun module de src/, studio-rendu/ ni outils/", () => {
    const soi = readFileSync(join(RACINE, "tests", "constats", "faits-extraits-v20d.test.ts"), "utf8");
    const imports = soi.split("\n").filter((l) => /^\s*import\s/.test(l));
    expect(imports.length).toBeGreaterThan(0);
    for (const l of imports) expect(l).not.toMatch(/from\s+["'](@\/|\.\.?\/|src\/|studio-rendu|outils)/);
    expect(soi).not.toMatch(/await import\(/);
  });
});
