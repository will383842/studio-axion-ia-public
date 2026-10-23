/**
 * GARDE-FOU DURABLE : `src/` se suffit à lui-même. L'image du studio (`Dockerfile`, contexte réduit par
 * `Dockerfile.dockerignore`) ne contient ni `studio-rendu/`, ni `tests/`, ni `outils/`, ni `docs/` : un fichier de `src/`
 * qui importe l'un d'eux passe les tests (les dossiers sont là) mais casse `pnpm build` à la mise en ligne. `scripts/`
 * est bien dans l'image, mais `src/` ne doit pas en dépendre non plus. Le garde-fou voisin `image-autonome.test.ts`
 * étend la règle à TOUT fichier TypeScript de l'image (`scripts/`, racine…), en lisant `Dockerfile.dockerignore`. Défaut constaté sur le tableau animé (TB-11 : `tableau-branchements.ts` importait `studio-rendu` et `scripts`).
 *
 * Tout import compte : statique (`import … from`, `export … from`, `import "…"`), dynamique (`import("…")`), `require`,
 * imports de types compris (`tsc` et `next build` les résolvent aussi). Chemins relatifs, et alias `@/` qui sortirait
 * de `src/`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = process.cwd();
const SRC = join(RACINE, "src");
/** Dossiers absents de l'image du studio (voir `Dockerfile.dockerignore`). */
const INTERDITS = ["studio-rendu", "scripts", "tests", "outils", "docs"];

/**
 * Cas DÉJÀ présents hors du tableau animé, tolérés en attendant leur correction (fichier → chemins importés).
 * Vide au 11/10 : aucun autre fichier de `src/` ne sort du dossier. N'y ajoutez rien sans le signaler.
 */
const EXCEPTIONS: Record<string, readonly string[]> = {};

function fichiersSrc(): string[] {
  return readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && /\.(tsx?|mts|cts|m?js|cjs)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name))
    .map((e) => relative(RACINE, join(e.parentPath, e.name)).split(sep).join("/"));
}

/** Tous les chemins importés par un texte source. */
function specificateurs(texte: string): string[] {
  const res: string[] = [];
  for (const m of texte.matchAll(/\b(?:import|export)\s+[^;"'`]*?\bfrom\s*["']([^"']+)["']/g)) res.push(m[1]);
  for (const m of texte.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)) res.push(m[1]);
  for (const m of texte.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g)) res.push(m[1]);
  for (const m of texte.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) res.push(m[1]);
  return res;
}

/** Chemin du dépôt visé par un import (null : paquet de node_modules ou module de Node). */
function cible(fichier: string, specif: string): string | null {
  let absolu: string;
  if (specif.startsWith("@/")) absolu = resolve(SRC, specif.slice(2));
  else if (specif.startsWith(".")) absolu = resolve(RACINE, dirname(fichier), specif);
  else return null;
  return relative(RACINE, absolu).split(sep).join("/");
}

/** Imports de `src/` qui sortent vers un dossier absent de l'image. */
function sorties(): { fichier: string; specif: string; vise: string }[] {
  const res: { fichier: string; specif: string; vise: string }[] = [];
  for (const fichier of fichiersSrc()) {
    for (const specif of specificateurs(readFileSync(join(RACINE, fichier), "utf8"))) {
      const vise = cible(fichier, specif);
      if (vise && INTERDITS.some((d) => vise === d || vise.startsWith(`${d}/`))) res.push({ fichier, specif, vise });
    }
  }
  return res;
}

describe("src/ autonome (image du studio)", () => {
  it("aucun fichier de src/ n'importe studio-rendu/, scripts/, tests/, outils/ ni docs/ (hors exceptions nommées)", () => {
    const fautes = sorties()
      .filter((s) => !EXCEPTIONS[s.fichier]?.includes(s.specif))
      .map((s) => `${s.fichier} importe « ${s.specif} » (${s.vise}), absent de l'image du studio`);
    expect(fautes).toEqual([]);
  });

  it("les exceptions nommées existent encore (sinon, les retirer)", () => {
    const presentes = new Set(sorties().map((s) => `${s.fichier} → ${s.specif}`));
    const perimees = Object.entries(EXCEPTIONS).flatMap(([f, specs]) => specs.map((s) => `${f} → ${s}`)).filter((x) => !presentes.has(x));
    expect(perimees).toEqual([]);
  });

  it("repère chaque forme d'import (statique, type, dynamique, require, effet seul)", () => {
    const texte = [
      'import { a } from "../../studio-rendu/x";',
      'import type { B } from "../../scripts/y";',
      'export { c } from "../../tests/z";',
      'const d = await import("../../outils/w");',
      'const e = require("../../docs/v");',
      'import "../../scripts/effet";',
    ].join("\n");
    expect(specificateurs(texte)).toEqual(["../../studio-rendu/x", "../../scripts/y", "../../tests/z", "../../outils/w", "../../docs/v", "../../scripts/effet"]);
  });
});
