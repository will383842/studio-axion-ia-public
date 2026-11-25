// X2-10t · Garde « tout éteint » de la variété commune : qui a le droit d'importer ses services.
// Test seul, aucun code de production. Liste fermée tirée des fiches X2-11b à X2-14b-b : si un
// branchement prévu arrive, il tombe dans la liste ; tout autre importeur fait échouer ce test.
import { readdirSync, readFileSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = resolve(__dirname, "..", "..");
const SERVICES = "src/services/variete-commune";
const BRIQUES = "src/briques/variete-commune";

/** Importeurs permis de `src/services/variete-commune/**` hors du dossier lui-même (liste fermée). */
const PERMIS_SERVICES: readonly string[] = [
  "src/services/cas-concret-variete.ts", // X2-11b
  "src/services/tableau-branchements.ts", // X2-12b-b
  "src/services/facecam-branchements.ts", // X2-13b-b
  "src/services/avocat-branchements.ts", // X2-13b-b
  "src/services/tableau-creation.ts", // BR-TABLEAU-STYLE-b2
  "src/services/facecam-animee.ts", // X2-14b-b (chef)
  "scripts/variete-commune/", // préfixe : tout le dossier du rapport
];

/** Interdits d'importer les services OU les briques de la variété commune. */
const INTERDITS: readonly string[] = [
  "studio-rendu/",
  "src/services/publications.ts",
  "src/services/travaux.ts",
  "src/services/reglages.ts",
  "src/services/fabrication.ts",
];
const INTERDIT_IMAGE_VIDEO = /^src\/services\/image-video[^/]*\.ts$/;

const MESSAGE = "branchement hors des fiches X2 : demander au pilote";

// ─── Détecteur ─────────────────────────────────────────────────────────────────────────────────────────────

function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

/** Spécificateurs d'import d'un texte source : `from "…"`, `import "…"`, `import("…")`, `require("…")`. */
export function specificateurs(src: string): string[] {
  const t = sansCommentaires(src);
  const res: string[] = [];
  const motifs = [
    /\bfrom\s*["']([^"'\n]+)["']/g,
    /\bimport\s*["']([^"'\n]+)["']/g,
    /\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
  ];
  for (const m of motifs) for (const r of t.matchAll(m)) res.push(r[1]);
  return res;
}

/** Résout un spécificateur vers un chemin relatif à la racine (`@/x` → `src/x`), ou null si paquet externe. */
export function resoudre(spec: string, fichierRel: string): string | null {
  if (spec.startsWith("@/")) return posix.normalize("src/" + spec.slice(2));
  if (spec.startsWith(".")) return posix.normalize(posix.join(posix.dirname(fichierRel), spec));
  return null;
}

function dans(chemin: string, dossier: string): boolean {
  return chemin === dossier || chemin.startsWith(dossier + "/");
}

function estPermisServices(fichier: string, permis: readonly string[]): boolean {
  return permis.some((p) => (p.endsWith("/") ? fichier.startsWith(p) : fichier === p));
}

/** Violations d'un fichier : phrases prêtes à afficher (vide si tout va bien). */
export function violations(fichier: string, src: string, permis: readonly string[] = PERMIS_SERVICES): string[] {
  if (dans(fichier, SERVICES) || dans(fichier, BRIQUES)) return [];
  const res: string[] = [];
  for (const spec of specificateurs(src)) {
    const cible = resoudre(spec, fichier);
    if (!cible) continue;
    const versServices = dans(cible, SERVICES);
    const versBriques = dans(cible, BRIQUES);
    if (!versServices && !versBriques) continue;
    const interdit = INTERDITS.some((i) => (i.endsWith("/") ? fichier.startsWith(i) : fichier === i)) || INTERDIT_IMAGE_VIDEO.test(fichier);
    if (interdit) res.push(`${fichier} importe « ${spec} » : interdit (argent, rendu ou image→vidéo). ${MESSAGE}`);
    else if (versServices && !estPermisServices(fichier, permis)) res.push(`${fichier} importe « ${spec} » : ${MESSAGE}`);
  }
  return res;
}

// ─── Parcours ──────────────────────────────────────────────────────────────────────────────────────────────

function lister(dossier: string): string[] {
  const res: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (["node_modules", ".next", "dist"].includes(e.name)) continue;
    const p = join(dossier, e.name);
    if (e.isDirectory()) res.push(...lister(p));
    else if (/\.(ts|tsx|mts)$/.test(e.name) && !/\.(test|spec)\.(ts|tsx|mts)$/.test(e.name) && !e.name.endsWith(".d.ts")) res.push(p);
  }
  return res;
}

function tousLesFichiers(): string[] {
  return ["src", "scripts", "studio-rendu"].flatMap((d) => lister(join(RACINE, d))).map((p) => relative(RACINE, p).split(sep).join("/"));
}

function toutesViolations(permis: readonly string[]): string[] {
  return tousLesFichiers().flatMap((f) => violations(f, readFileSync(join(RACINE, f), "utf8"), permis));
}

// ─── Tests ─────────────────────────────────────────────────────────────────────────────────────────────────

describe("X2-10t · garde des importeurs de la variété commune", () => {
  it("le détecteur voit les trois formes d'import (pas vert à vide)", () => {
    expect(specificateurs(`import { a } from "@/services/variete-commune/refus";`)).toEqual(["@/services/variete-commune/refus"]);
    expect(specificateurs(`import { b } from './variete-commune/refus';`)).toEqual(["./variete-commune/refus"]);
    expect(specificateurs(`const m = await import("../../src/services/variete-commune/voisines");`)).toEqual(["../../src/services/variete-commune/voisines"]);
    expect(specificateurs(`// import x from "@/services/variete-commune/refus"`)).toEqual([]);
  });

  it("cas fictifs : image→vidéo refusé, branchement prévu permis", () => {
    expect(violations("src/services/image-video-x.ts", `import { t } from "@/briques/variete-commune/types";`)).toHaveLength(1);
    expect(violations("src/services/facecam-branchements.ts", `import { c } from "./variete-commune/cartes-voisines";`)).toEqual([]);
    expect(violations("studio-rendu/src/x.ts", `import { r } from "../../src/services/variete-commune/refus";`)).toHaveLength(1);
    expect(violations("src/services/fabrication.ts", `import("@/services/variete-commune/refus")`)).toHaveLength(1);
    expect(violations("src/services/inconnu.ts", `import { r } from "./variete-commune/refus";`)).toEqual([
      expect.stringContaining(MESSAGE),
    ]);
    expect(violations("src/services/variete-commune/refus.ts", `import { r } from "./voisines";`)).toEqual([]);
  });

  it("liste fermée vidée : le rapport est signalé (la garde mord)", () => {
    const sans = toutesViolations([]);
    expect(sans.some((v) => v.startsWith("scripts/variete-commune/rapport.ts"))).toBe(true);
  });

  it("aucun importeur hors liste fermée, aucun interdit", () => {
    expect(toutesViolations(PERMIS_SERVICES)).toEqual([]);
  });
});
