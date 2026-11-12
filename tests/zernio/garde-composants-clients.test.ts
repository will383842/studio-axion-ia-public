/**
 * Garde « build navigateur » : aucun fichier « use client » (ni ce qu'il importe, de proche en proche) ne doit tirer
 * la base ou un module serveur (pg, prisma, db, server-only, fs). Constat : `pnpm build` échouait car un composant client
 * importait src/services/a-traiter.ts (-> pg -> dns/fs/net/tls introuvables côté navigateur).
 * Les `import type` / `export type` sont effacés à la compilation : ils sont permis. Analyse statique, sans réseau.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "../..");
const SRC = join(RACINE, "src");
const EXTS = [".ts", ".tsx", ".mts"];

/** Modules extérieurs interdits côté navigateur. */
const MODULES_SERVEUR = /^(?:pg(?:-[\w-]+)?|@prisma\/client|prisma|server-only|(?:node:)?fs(?:\/promises)?|(?:node:)?(?:child_process|net|tls|dns))$/;
/** Chemins internes qui donnent accès à la base. */
const CHEMIN_BASE = /(?:^|\/)(?:db|pg|prisma|donnees\/(?:pg|postgres|base|db)[\w-]*)(?:\.[a-z]+)?$/;

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((n) => {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) return fichiers(p);
    return /\.(?:ts|tsx|mts)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

/** Première instruction du fichier (commentaires de tête ignorés), pour repérer « use client » / « use server ». */
function directive(src: string): string | null {
  let t = src.replace(/^\uFEFF/, "");
  for (;;) {
    t = t.trimStart();
    if (t.startsWith("//")) t = t.slice(t.indexOf("\n") < 0 ? t.length : t.indexOf("\n") + 1);
    else if (t.startsWith("/*")) t = t.slice(t.indexOf("*/") < 0 ? t.length : t.indexOf("*/") + 2);
    else break;
  }
  const m = /^(["'])(use (?:client|server))\1/.exec(t);
  return m ? m[2] : null;
}
/** Fichier « use server » : Next le remplace côté navigateur par de simples appels à distance, on ne le suit pas. */
const estActionServeur = (src: string) => directive(src) === "use server";
const estClient = (src: string) => directive(src) === "use client";

/** Imports d'exécution (hors `import type`, hors `export type`, hors imports dont tous les noms sont des types). */
export function importsRuntime(src: string): string[] {
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const sortie: string[] = [];
  const re = /\b(import|export)\s+(type\s+)?([^"'`;]*?)\s*from\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;
  for (const m of sansCommentaires.matchAll(re)) {
    if (m[5] || m[6]) {
      sortie.push((m[5] ?? m[6])!);
      continue;
    }
    if (m[2]) continue; // import type / export type
    const noms = m[3];
    const accolades = noms.match(/\{([\s\S]*)\}/);
    if (accolades && !noms.replace(/\{[\s\S]*\}/, "").replace(/[,\s]/g, "")) {
      const liste = accolades[1].split(",").map((x) => x.trim()).filter(Boolean);
      if (liste.length && liste.every((x) => /^type\s/.test(x))) continue; // { type A, type B }
    }
    sortie.push(m[4]);
  }
  return sortie;
}

function resoudre(depuis: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(depuis), spec);
  else return null;
  for (const c of [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => join(base, "index" + e))]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const lectures = new Map<string, { action: boolean; imports: string[] }>();
function lire(f: string) {
  let r = lectures.get(f);
  if (!r) {
    const code = readFileSync(f, "utf8");
    r = { action: estActionServeur(code), imports: importsRuntime(code) };
    lectures.set(f, r);
  }
  return r;
}

export function violations(entree: string): string[] {
  const trouvees: string[] = [];
  const vus = new Set<string>();
  const visiter = (f: string, chaine: string[]) => {
    if (vus.has(f)) return;
    vus.add(f);
    const { action, imports } = lire(f);
    if (chaine.length > 0 && action) return;
    for (const spec of imports) {
      const nom = (x: string) => relative(RACINE, x);
      if (MODULES_SERVEUR.test(spec) || CHEMIN_BASE.test(spec)) {
        trouvees.push(`${[...chaine, nom(f)].join(" -> ")} -> « ${spec} »`);
        continue;
      }
      const cible = resoudre(f, spec);
      if (cible) visiter(cible, [...chaine, nom(f)]);
    }
  };
  visiter(entree, []);
  return trouvees;
}

describe("garde : composants clients sans module serveur", () => {
  const clients = fichiers(join(SRC, "components")).filter((f) => estClient(readFileSync(f, "utf8")));

  it("trouve bien des composants « use client » (le garde ne regarde pas dans le vide)", () => {
    expect(clients.length).toBeGreaterThan(20);
    for (const dossier of ["a-traiter", "mots"]) expect(clients.some((f) => f.includes(`/components/${dossier}/`))).toBe(true);
  });

  it("aucun composant client n'importe (à l'exécution, de proche en proche) la base ou un module serveur", () => {
    const tout = clients.flatMap((f) => violations(f));
    expect(tout).toEqual([]);
  });

  it("l'analyse reconnaît les imports de types (permis) et d'exécution (interdits)", () => {
    expect(importsRuntime(`import type { A } from "@/services/a-traiter";`)).toEqual([]);
    expect(importsRuntime(`import { type A, type B } from "@/services/x";`)).toEqual([]);
    expect(importsRuntime(`import { type A, f } from "@/services/x";`)).toEqual(["@/services/x"]);
    expect(importsRuntime(`import "server-only";`)).toEqual(["server-only"]);
  });
});
