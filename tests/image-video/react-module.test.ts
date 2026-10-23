/**
 * L7 · Aucun JSX évalué au niveau module sans `React` (le seul cas qui casse le rendu de prod, #201).
 *
 * La prod construit le paquet `studio-rendu` sans typescript (`npm ci --omit=dev`) : le JSX y est compilé en
 * `React.createElement` (JSX classique) et `React` n'est posé sur `globalThis` qu'APRÈS le chargement des
 * compositions. On reproduit ce cas : chaque `.tsx` du dossier est empaqueté par esbuild en `jsx: "transform"`, sans
 * lire de tsconfig, puis CHARGÉ avec `globalThis.React` absent. Un JSX de niveau module sans import React lève alors
 * « React is not defined » — comme en prod. Un fichier piège le prouve ; notre dossier doit passer.
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const RACINE = process.cwd();
const RENDU = join(RACINE, "studio-rendu");
const DOSSIER = join(RENDU, "compositions/image-video");
const exiger = createRequire(join(RENDU, "package.json"));
const TEMP = mkdtempSync(join(tmpdir(), "iv-react-"));
afterAll(() => rmSync(TEMP, { recursive: true, force: true }));

/** Ce qu'on utilise d'esbuild (installé dans studio-rendu par tsx, pas à la racine : type minimal, sans import). */
type Resolution = { path: string };
type Constructeur = { onResolve(o: { filter: RegExp }, f: (a: Resolution) => { path: string; external: boolean }): void };
type Esbuild = { build(o: Record<string, unknown> & { plugins: { name: string; setup(b: Constructeur): void }[] }): Promise<unknown> };
function esbuild(): Esbuild {
  try {
    return exiger("esbuild") as Esbuild;
  } catch {
    throw new Error("esbuild introuvable dans studio-rendu/node_modules : lancer « npm --prefix studio-rendu ci » d'abord.");
  }
}

/** Paquets laissés hors du paquet (chargés depuis studio-rendu/node_modules, comme en prod). */
const EXTERNES = /^(react|react-dom|remotion|@remotion\/[^/]+)(\/.*)?$/;

/** Empaquette un `.tsx` comme la prod (JSX classique, sans tsconfig) et le charge sans `globalThis.React`. */
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
        name: "externes-studio-rendu",
        setup(b) {
          b.onResolve({ filter: EXTERNES }, (a) => ({ path: exiger.resolve(a.path), external: true }));
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

// Sous-dossiers compris (`micro-objets/`, lot L9b).
const NOTRE_DOSSIER = readdirSync(DOSSIER, { recursive: true, encoding: "utf8" })
  .filter((f) => f.endsWith(".tsx"))
  .sort();

describe("le fichier piège prouve que le test voit ce que voit la prod", () => {
  it("JSX au niveau module SANS import React : le chargement casse (« React is not defined »)", async () => {
    const piege = join(TEMP, "piege.tsx");
    writeFileSync(piege, 'export const Carte = <div style={{ color: "red" }}>piège</div>;\n');
    await expect(chargerCommeLaProd(piege)).rejects.toThrow(/React is not defined/);
  });
  it("le même JSX AVEC import React : le chargement passe", async () => {
    const sain = join(TEMP, "sain.tsx");
    writeFileSync(sain, 'import React from "react";\nexport const Carte = <div style={{ color: "red" }}>sain</div>;\n');
    await expect(chargerCommeLaProd(sain)).resolves.toBeUndefined();
  });
  it("JSX seulement dans des fonctions, sans import React : le chargement passe (seul le niveau module casse)", async () => {
    const differe = join(TEMP, "differe.tsx");
    writeFileSync(differe, "export function Carte() {\n  return <div>différé</div>;\n}\n");
    await expect(chargerCommeLaProd(differe)).resolves.toBeUndefined();
  });
});

describe("studio-rendu/compositions/image-video", () => {
  it("contient les composants du lot L7", () => {
    for (const f of ["Toile.tsx", "Camera.tsx", "Noeud.tsx", "FlecheCourbe.tsx", "Embranchement.tsx", "Compositions.tsx"]) expect(NOTRE_DOSSIER).toContain(f);
  });
  for (const f of NOTRE_DOSSIER) {
    it(`${f} commence par « import React from "react"; »`, () => {
      expect(readFileSync(join(DOSSIER, f), "utf8").split("\n")[0]).toBe('import React from "react";');
    });
    it(`${f} se charge comme en prod, sans globalThis.React`, async () => {
      await chargerCommeLaProd(join(DOSSIER, f));
    }, 30_000);
  }
});
