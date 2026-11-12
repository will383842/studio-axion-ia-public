/**
 * L1-08 : contrat d'isolation. Le plan n'importe jamais de fournisseur (réseau, modèle d'IA, diffuseur).
 * Lecture statique des sources ; aucun appel réel.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const racine = process.cwd();
function sources(dossier: string): string[] {
  const d = join(racine, dossier);
  if (!existsSync(d)) return [];
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sources(join(dossier, e.name)) : /\.tsx?$/.test(e.name) ? [join(dossier, e.name)] : []));
}
const FICHIERS_PLAN = ["src/services/plan-editorial.ts", ...sources("src/domaine/plan-editorial")];

/** Tous les imports d'un fichier (statiques, dynamiques, require, export from). */
export function imports(code: string): string[] {
  const res: string[] = [];
  const re = /(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) res.push(m[1]);
  return res;
}
const estFournisseur = (s: string) => /(^|\/)fournisseurs(\/|$)/.test(s);

describe("contrat d'isolation du plan", () => {
  it("le service existe et est inspecté", () => {
    expect(FICHIERS_PLAN).toContain("src/services/plan-editorial.ts");
    expect(existsSync(join(racine, "src/services/plan-editorial.ts"))).toBe(true);
  });
  it("aucun fichier du plan n'importe src/fournisseurs", () => {
    for (const f of FICHIERS_PLAN) {
      const fautifs = imports(readFileSync(join(racine, f), "utf8")).filter(estFournisseur);
      expect(fautifs, f).toEqual([]);
    }
  });
  it("le détecteur reconnaît les formes d'import fautives", () => {
    for (const code of [
      'import x from "@/fournisseurs/claude";', 'import("../fournisseurs/aligneur")', 'const a = require("../../fournisseurs/x")',
      'export * from "@/fournisseurs/catalogue";', "import '@/fournisseurs/claude/client'",
    ]) expect(imports(code).some(estFournisseur), code).toBe(true);
    expect(imports('import x from "@/domaine/types";').some(estFournisseur)).toBe(false);
  });
  it("aucun appel réseau ni module réseau dans le service", () => {
    const code = readFileSync(join(racine, "src/services/plan-editorial.ts"), "utf8");
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(imports(code).filter((s) => /^(node:)?(http|https|net|child_process)$/.test(s))).toEqual([]);
  });
  it("le contrat écrit existe", () => {
    expect(existsSync(join(racine, "docs/plan-editorial/CONTRAT-USINE.md"))).toBe(true);
  });
});
