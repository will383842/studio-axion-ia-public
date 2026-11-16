/**
 * G1-04 · Dossier modèle d'un nouveau générateur (`_gabarit`) et liste des 16 gestes dans le guide unique.
 * Lecture de texte seulement : le dossier modèle n'est importé par rien, il se copie.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../..");
const lire = (chemin: string) => readFileSync(join(RACINE, chemin), "utf8");

const FICHE = "src/formats/_gabarit/index.ts";
const COMPOSITION = "studio-rendu/compositions/_gabarit/Gabarit.tsx";
const GUIDE = "docs/formats/AJOUTER-UN-FORMAT.md";

function fichiersSous(dossier: string): string[] {
  const sortie: string[] = [];
  const marche = (d: string) => {
    for (const nom of readdirSync(d)) {
      if (nom === "node_modules" || nom === ".next") continue;
      const chemin = join(d, nom);
      if (statSync(chemin).isDirectory()) marche(chemin);
      else if (/\.(ts|tsx|mts|js|mjs)$/.test(nom)) sortie.push(chemin);
    }
  };
  marche(join(RACINE, dossier));
  return sortie;
}

const sansCommentaires = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

describe("G1-04 · dossier modèle _gabarit", () => {
  it("la fiche et la composition du modèle existent", () => {
    expect(existsSync(join(RACINE, FICHE))).toBe(true);
    expect(existsSync(join(RACINE, COMPOSITION))).toBe(true);
  });

  it("la fiche est masquée et non inscrite", () => {
    const code = sansCommentaires(lire(FICHE));
    expect(code).toContain('statut: "masque"');
    expect(code).toContain("sansPrix");
  });

  it("aucun fichier de src/ ni de studio-rendu/ n'importe _gabarit", () => {
    const fautes = [...fichiersSous("src"), ...fichiersSous("studio-rendu")]
      .filter((f) => !/[\\/]_gabarit[\\/]/.test(f) && !f.includes("gabarit-dossier.test"))
      .filter((f) => /from\s+["'][^"']*\/_gabarit(\/|["'])|import\(\s*["'][^"']*\/_gabarit/.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(RACINE, ""));
    expect(fautes).toEqual([]);
  });

  it("Racine.tsx et src/formats/index.ts ne citent pas _gabarit", () => {
    expect(lire("studio-rendu/compositions/Racine.tsx")).not.toContain("_gabarit");
    expect(lire("src/formats/index.ts")).not.toContain("_gabarit");
  });

  it("Gabarit.tsx : sans hexadécimal, sans Montserrat, sans import « @/ »", () => {
    const src = lire(COMPOSITION);
    const code = sansCommentaires(src);
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/Montserrat/i);
    expect(src).not.toMatch(/from\s+["']@\//);
    expect(src).not.toMatch(/import\(\s*["']@\//);
    expect(src).toContain("chargerManrope");
    expect(src).toContain("CHARTE_AXION");
  });
});

describe("G1-04 · guide « Ajouter un format » : les 16 gestes", () => {
  const guide = lire(GUIDE);
  const debut = guide.indexOf("Créer un nouveau générateur : les 16 gestes");
  const section = debut >= 0 ? guide.slice(debut, guide.indexOf("\n## ", debut + 5) > 0 ? guide.indexOf("\n## ", debut + 5) : undefined) : "";

  it("la section existe et numérote les gestes de 1 à 16", () => {
    expect(debut).toBeGreaterThanOrEqual(0);
    const numeros = [...section.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
    expect(numeros).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("les 3 gestes en zone fermée sont nommés en tête du guide, faits par une personne", () => {
    const tete = guide.slice(0, 1500);
    for (const zone of ["src/formats/index.ts", "deploiement/studio-rendu/Dockerfile", ".github/workflows/gv-tests-moteurs.yml"]) {
      expect(tete, zone).toContain(zone);
    }
    expect(tete).toMatch(/par une personne/);
  });

  it("le guide reste un seul document et cite le dossier modèle", () => {
    expect(section).toContain("src/formats/_gabarit/");
    expect(section).toContain("studio-rendu/compositions/_gabarit/Gabarit.tsx");
    expect(section).toContain("src/moteurs/gabarit/");
    expect(existsSync(join(RACINE, "docs/formats/CREER-UN-GENERATEUR.md"))).toBe(false);
  });
});
