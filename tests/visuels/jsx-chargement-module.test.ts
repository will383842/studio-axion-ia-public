/**
 * Garde contre la panne « React is not defined » (24/10, après visuel-page/10) : dans l'image de prod (`npm ci --omit=dev`, sans TypeScript),
 * le chargeur esbuild de Remotion ne lit pas `studio-rendu/tsconfig.json` et compile le JSX en transformation CLASSIQUE (`React.createElement`,
 * `React.Fragment`). Le JSX évalué au CHARGEMENT d'un module (constante de module, objet de JSX…) lève alors ReferenceError, et comme VisuelPage
 * importe toutes les pages, aucune page ne se rend plus. Le JSX ne doit vivre que dans des fonctions appelées au rendu.
 * 1. Contrôle STATIQUE (toujours actif) : aucun JSX hors d'une fonction dans studio-rendu/compositions/visuels.
 * 2. Contrôle DYNAMIQUE (avec les dépendances de studio-rendu, `npm ci` dans ce dossier ; IGNORÉ sinon, la CI ciblée ne les installe pas) :
 *    chaque module de studio-rendu/compositions/visuels, empaqueté par esbuild en JSX classique, se charge sans React global.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../..");
const DOSSIER = join(RACINE, "studio-rendu/compositions/visuels");
const ESBUILD = join(RACINE, "studio-rendu/node_modules/esbuild");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) && !/\.d\.ts$/.test(nom) ? [chemin] : [];
  });
}

/** Lignes (1…) des JSX évalués au chargement du module : hors de toute fonction, méthode ou propriété d'instance. PUR. */
export function jsxAuChargement(source: string, nom = "x.tsx"): number[] {
  const fichier = ts.createSourceFile(nom, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lignes: number[] = [];
  const visiter = (noeud: ts.Node, differe: boolean) => {
    if (!differe && (ts.isJsxElement(noeud) || ts.isJsxSelfClosingElement(noeud) || ts.isJsxFragment(noeud))) {
      lignes.push(fichier.getLineAndCharacterOfPosition(noeud.getStart()).line + 1);
      return;
    }
    const instance = ts.isPropertyDeclaration(noeud) && !noeud.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword);
    const fonction = ts.isFunctionLike(noeud) && !ts.isClassStaticBlockDeclaration(noeud);
    ts.forEachChild(noeud, (enfant) => visiter(enfant, differe || fonction || instance));
  };
  visiter(fichier, false);
  return lignes;
}

describe("JSX au chargement des modules de compositions/visuels", () => {
  it("le contrôle repère le JSX de module et laisse celui des fonctions", () => {
    expect(jsxAuChargement("const A = <b />;\nconst B = { x: (<>\n<i /></>) };")).toEqual([1, 2]);
    expect(jsxAuChargement("const A = () => <b />;\nfunction F() { return <i />; }\nconst B = { x: () => <>a</> };\nclass C { r() { return <p />; } }")).toEqual([]);
  });

  it("aucun JSX hors d'une fonction (statique)", () => {
    const fautifs = fichiers(DOSSIER).flatMap((f) => jsxAuChargement(readFileSync(f, "utf8"), f).map((l) => `${relative(RACINE, f)}:${l}`));
    expect(fautifs).toEqual([]);
  });

  it.skipIf(!existsSync(ESBUILD))("chaque module se charge en JSX classique sans React global (esbuild, comme l'image de prod)", async () => {
    const esbuild = createRequire(import.meta.url)(ESBUILD) as typeof import("esbuild");
    expect((globalThis as { React?: unknown }).React).toBeUndefined();
    const modules = fichiers(DOSSIER);
    const travail = mkdtempSync(join(tmpdir(), "jsx-classique-"));
    try {
      const sortie = join(travail, "paquet.mjs");
      await esbuild.build({
        stdin: { contents: modules.map((m, i) => `import * as m${i} from ${JSON.stringify(m)};\nexport { m${i} };`).join("\n"), resolveDir: DOSSIER, loader: "ts" },
        bundle: true,
        format: "esm",
        platform: "node",
        jsx: "transform",
        loader: { ".ttf": "file" },
        tsconfigRaw: {},
        outfile: sortie,
        logLevel: "silent",
      });
      writeFileSync(join(travail, "package.json"), '{"type":"module"}');
      const charge = (await import(/* @vite-ignore */ pathToFileURL(sortie).href)) as Record<string, object>;
      expect(Object.keys(charge)).toHaveLength(modules.length);
    } finally {
      rmSync(travail, { recursive: true, force: true });
    }
  }, 60_000);
});
