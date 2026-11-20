/**
 * Constat v20d : C2-U15, C2-U17, C2-U20b, C5-5.22 et N-01 sont faits sur master.
 * Preuve par lecture du TEXTE des sources (aucun import des fichiers lus).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const chemin = (relatif: string): string => join(RACINE, ...relatif.split("/"));
const lire = (relatif: string): string => readFileSync(chemin(relatif), "utf8");

describe("C2-U15 fait sur master", () => {
  for (const f of ["captures.mts", "planches.py", "planche-texte-ecran.mts", "planche-repere-epaule.mts"]) {
    it(`outils/captures-sous-titres/${f} existe et n'est pas vide`, () => {
      const p = `outils/captures-sous-titres/${f}`;
      expect(existsSync(chemin(p))).toBe(true);
      expect(lire(p).trim().length).toBeGreaterThan(0);
    });
  }
});

describe("C2-U17 fait sur master", () => {
  const texte = lire("src/briques/bibliotheque-video/catalogue/texte.ts");
  it("le catalogue du texte existe et exporte LIGNES_TEXTE", () => {
    expect(existsSync(chemin("src/briques/bibliotheque-video/catalogue/texte.ts"))).toBe(true);
    expect(texte).toContain("LIGNES_TEXTE");
  });
  it("les lignes de texte livrées sont à « eteint »", () => {
    for (const cle of ["texteSurlignageMarqueur", "texteStyleVarie", "textePave", "texteNomOutil", "texteRepereEpaule", "texteSortieAnimee"]) {
      expect(texte).toMatch(new RegExp(`id: ID\\.${cle},\\s*etat: "eteint"`));
    }
  });
});

describe("C2-U20b fait sur master", () => {
  it("LigneEscalier.tsx existe et exporte LigneEscalier", () => {
    const p = "studio-rendu/compositions/sous-titres/LigneEscalier.tsx";
    expect(existsSync(chemin(p))).toBe(true);
    expect(lire(p)).toMatch(/export const LigneEscalier\b/);
  });
  it("son test existe et nomme LigneEscalier", () => {
    const p = "tests/briques/sous-titres/ligne-escalier.test.tsx";
    expect(existsSync(chemin(p))).toBe(true);
    expect(lire(p)).toContain("LigneEscalier");
  });
  it("texteEscalier est à « eteint » au catalogue", () => {
    expect(lire("src/briques/bibliotheque-video/catalogue/texte.ts")).toMatch(/id: ID\.texteEscalier,\s*etat: "eteint"/);
  });
});

describe("C5-5.22 fait sur master", () => {
  it("la ligne planScenesFacecam du catalogue des calques est à « eteint »", () => {
    const p = "src/briques/bibliotheque-video/catalogue/calques.ts";
    expect(existsSync(chemin(p))).toBe(true);
    expect(lire(p)).toMatch(/\{\s*id: ID\.planScenesFacecam,\s*etat: "eteint"/);
  });
  it("l'identifiant plan-scenes.facecam existe dans noms.ts", () => {
    expect(lire("src/briques/bibliotheque-video/noms.ts")).toMatch(/planScenesFacecam:\s*"plan-scenes\.facecam"/);
  });
});

describe("N-01 fait sur master", () => {
  it("N-01a : liaison-facade.test.ts existe et lit le catalogue et la façade", () => {
    const p = "tests/bibliotheque-video/liaison-facade.test.ts";
    expect(existsSync(chemin(p))).toBe(true);
    const t = lire(p);
    expect(t).toContain("CATALOGUE_CAPACITES");
    expect(t).toContain("briquesDuMoteur");
  });
  it("N-01b : liaison-plan-scenes.test.tsx existe et parle du plan de scènes", () => {
    const p = "tests/bibliotheque-video/liaison-plan-scenes.test.tsx";
    expect(existsSync(chemin(p))).toBe(true);
    expect(lire(p)).toContain("N-01b");
    expect(lire(p)).toMatch(/plan de scènes/);
  });
});

describe("garde de forme", () => {
  it("n'importe aucun module de src/, studio-rendu/ ni outils/", () => {
    const moi = readFileSync(__filename, "utf8");
    const imports = moi.split("\n").filter((l) => /^\s*import\b/.test(l));
    for (const l of imports) expect(l).not.toMatch(/["'](@\/|(\.\.\/)+(src|studio-rendu|outils)\b)/);
  });
});
