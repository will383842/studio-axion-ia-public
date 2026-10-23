/**
 * Lot L1 · maquettes de variété (`studio-rendu/compositions/cas-concret/variantes/`) : prototypes isolés.
 *
 * 1. Chaque `.tsx` commence par `import React from "react";` et se CHARGE comme en prod (JSX classique, sans
 *    `globalThis.React`) — même méthode que `tests/image-video/react-module.test.ts` (#201).
 * 2. Rien d'interdit n'est importé : ni le moteur (`src/moteurs`), ni les tests, ni la racine de production ; seulement
 *    react, remotion, la charte et les briques pures, et les pièces du format en lecture.
 * 3. La racine de production n'inscrit PAS les maquettes (aucun effet sur le studio en service).
 * 4. Barres proportionnelles : 1 → 200 avec un plancher visible de 3 %.
 */
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { barresProportionnelles, MAQUETTES, planVolet, planZoomLent } from "../../../studio-rendu/compositions/cas-concret/variantes/donnees";

const RACINE = process.cwd();
const RENDU = join(RACINE, "studio-rendu");
const DOSSIER = join(RENDU, "compositions/cas-concret/variantes");
const TEMP = mkdtempSync(join(tmpdir(), "maquettes-l1-"));
afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

type Constructeur = { onResolve(o: { filter: RegExp }, f: (a: { path: string }) => { path: string; external?: boolean }): void };
type Esbuild = { build(o: Record<string, unknown> & { plugins: { name: string; setup(b: Constructeur): void }[] }): Promise<unknown> };

/** esbuild : celui de studio-rendu (CI), sinon celui du magasin pnpm de la racine (poste sans studio-rendu installé). */
function esbuild(): Esbuild {
  try {
    return createRequire(join(RENDU, "package.json"))("esbuild") as Esbuild;
  } catch {
    const magasin = join(RACINE, "node_modules/.pnpm");
    const dossier = existsSync(magasin) ? readdirSync(magasin).find((d) => /^esbuild@\d/.test(d)) : undefined;
    if (!dossier) throw new Error("esbuild introuvable : lancer « npm --prefix studio-rendu ci » d'abord.");
    return createRequire(join(magasin, dossier, "node_modules/esbuild/package.json"))("esbuild") as Esbuild;
  }
}

/** Remotion est remplacé par un module neutre (seul compte ici le JSX de niveau module) ; React est le vrai. */
const NEUTRE = join(TEMP, "remotion-neutre.cjs");
writeFileSync(NEUTRE, "module.exports = new Proxy({}, { get: (_, k) => (k === '__esModule' ? false : () => null) });\n");
const exigerRacine = createRequire(join(RACINE, "package.json"));

async function chargerCommeLaProd(fichier: string): Promise<void> {
  const sortie = join(TEMP, `${readdirSync(TEMP).length}.cjs`);
  await esbuild().build({
    entryPoints: [fichier],
    bundle: true,
    outfile: sortie,
    format: "cjs",
    platform: "node",
    target: "node22",
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    tsconfigRaw: {},
    loader: { ".ttf": "empty", ".woff2": "empty", ".png": "empty", ".svg": "empty" },
    logLevel: "silent",
    plugins: [
      {
        name: "externes",
        setup(b) {
          b.onResolve({ filter: /^(remotion|@remotion\/[^/]+)(\/.*)?$/ }, () => ({ path: NEUTRE, external: true }));
          b.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (a) => ({ path: exigerRacine.resolve(a.path), external: true }));
        },
      },
    ],
  });
  const global = globalThis as { React?: unknown };
  const avant = global.React;
  delete global.React;
  try {
    expect(global.React).toBeUndefined();
    createRequire(sortie)(sortie);
  } finally {
    if (avant !== undefined) global.React = avant;
  }
}

const FICHIERS = readdirSync(DOSSIER).sort();
const TSX = FICHIERS.filter((f) => f.endsWith(".tsx"));
const sansCommentaires = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const importsDe = (t: string) => [...sansCommentaires(t).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]);

describe("variantes/ : prototypes chargés comme en prod", () => {
  it("contient l'entrée, la composition et les maquettes", () => {
    for (const f of ["entree.ts", "Maquettes.tsx", "ecrans.tsx", "pieces.tsx", "donnees.ts"]) expect(FICHIERS).toContain(f);
  });
  for (const f of TSX) {
    it(`${f} commence par « import React from "react"; »`, () => {
      expect(readFileSync(join(DOSSIER, f), "utf8").split(/\r?\n/)[0]).toBe('import React from "react";');
    });
    it(`${f} se charge sans globalThis.React`, async () => {
      await chargerCommeLaProd(join(DOSSIER, f));
    }, 60_000);
  }
});

describe("variantes/ : rien d'interdit", () => {
  const AUTORISES = /^(react|remotion|\.\/[\w-]+|\.\.\/(objets|plans|socle)\/[\w-]+|\.\.\/Ecran|\.\.\/\.\.\/(commune\/polices|sous-titres\/CalqueSousTitres)|\.\.\/\.\.\/\.\.\/\.\.\/src\/briques\/(ecrans-motion|habillage\/charte-duo|sous-titres\/scene))$/;
  for (const f of FICHIERS.filter((x) => /\.tsx?$/.test(x))) {
    it(`${f} n'importe que react, remotion, la charte, les briques pures et les pièces du format`, () => {
      const texte = readFileSync(join(DOSSIER, f), "utf8");
      for (const i of importsDe(texte)) expect(i, `${f} : ${i}`).toMatch(AUTORISES);
      expect(sansCommentaires(texte)).not.toMatch(/\bfetch\(|Math\.random|Date\.now|new Date\b|process\.env/);
    });
  }
  it("la racine de production n'inscrit pas les maquettes", () => {
    const racine = readFileSync(join(RENDU, "compositions/Racine.tsx"), "utf8") + readFileSync(join(RENDU, "compositions/index.ts"), "utf8");
    expect(racine).not.toMatch(/variantes|CasConcretMaquette/);
  });
});

describe("variantes/donnees.ts", () => {
  it("barres 1 → 200 : proportionnelles, la petite visible (plancher 3 %)", () => {
    expect(barresProportionnelles([1, 200])).toEqual([0.03, 1]);
    expect(barresProportionnelles([50, 200])).toEqual([0.25, 1]);
  });
  it("volet : couvre puis révèle ; zoom lent borné de 1 à 1,06", () => {
    expect(planVolet(0).droite).toBe(0);
    expect(planVolet(10)).toEqual({ gauche: 1, droite: 1, montreB: true });
    expect(planZoomLent(0, 4)).toBe(1);
    expect(planZoomLent(4, 4)).toBeCloseTo(1.06);
  });
  it("16 maquettes + 2 « aujourd'hui » + 1 autre vidéo + 4 images de transition", () => {
    expect(MAQUETTES.filter((n) => /^m(0[1-9]|1[0-6])-/.test(n))).toHaveLength(16);
    expect(MAQUETTES.filter((n) => n.startsWith("aujourdhui-"))).toHaveLength(2);
    expect(MAQUETTES.filter((n) => n.startsWith("t"))).toHaveLength(4);
  });
});
