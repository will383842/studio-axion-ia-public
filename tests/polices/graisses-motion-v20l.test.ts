// POLICES-P6-a-v20l : motion design — Manrope s'arrête à 800 (900 n'existe pas) et l'espace fine insécable (U+202F)
// n'est pas dans le fichier de police. Lecture de texte seule, chemin CALCULÉ (piège tsc/remotion).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(import.meta.dirname, "../..");
const DOSSIER = join(RACINE, ["studio-rendu", "compositions", "commune", "motion"].join("/"));
const GRAISSE_MAX = 800;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) ? [chemin] : [];
  });
}
const SOURCES = fichiers(DOSSIER).map((f) => ({ f: f.slice(DOSSIER.length + 1), lignes: readFileSync(f, "utf8").split("\n") }));

describe("POLICES-P6-a-v20l : motion design, graisses et espaces", () => {
  it("(a) le dossier motion contient des fichiers (le test lit bien quelque chose)", () => {
    expect(SOURCES.length).toBeGreaterThan(20);
  });

  it("(b) aucune graisse CSS au-dessus de 800 (fontWeight, graisse={…}, graisse:)", () => {
    const trop: string[] = [];
    for (const { f, lignes } of SOURCES) {
      lignes.forEach((l, i) => {
        for (const m of l.matchAll(/(?:fontWeight\s*:\s*|graisse\s*[=:]\s*\{?\s*)(\d{3})\b/g)) {
          if (Number(m[1]) > GRAISSE_MAX) trop.push(`${f}:${i + 1} ${m[1]}`);
        }
      });
    }
    expect(trop).toEqual([]);
  });

  it("(c) aucune espace fine insécable (U+202F), ni littérale ni écrite \\u202f, dans le dossier motion", () => {
    const fines: string[] = [];
    for (const { f, lignes } of SOURCES) {
      lignes.forEach((l, i) => {
        if (l.includes(" ") || /\\u202f/i.test(l)) fines.push(`${f}:${i + 1}`);
      });
    }
    expect(fines).toEqual([]);
  });

  it("(d) les valeurs 900 passées aux fonctions de mesure restent inchangées (hors périmètre)", () => {
    const mesure = SOURCES.find((s) => s.f === "MotionIconeMot.tsx")!.lignes.join("\n");
    expect(mesure).toMatch(/mesurer\([^)]*900/);
  });

  it("(e) formaterNombre remplace les séparateurs de Intl (U+202F) par U+00A0, présent dans Manrope", () => {
    const src = SOURCES.find((s) => s.f === "noyau.tsx")!.lignes.join("\n");
    expect(src).toMatch(/\.format\(v\)\.replace\(\/\\s\/g, "\\u00a0"\)/);
    const brut = new Intl.NumberFormat("fr-FR").format(1250);
    expect(brut.replace(/\s/g, "\u00a0")).toBe("1\u00a0250");
  });
});
