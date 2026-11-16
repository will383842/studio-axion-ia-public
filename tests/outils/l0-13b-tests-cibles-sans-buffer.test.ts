// [L0-13b] Le workflow tests-cibles ne cite plus aucun motif Buffer, garde Zernio et couverture inchangées.
// Lecture de fichiers seulement ; aucun réseau, aucun service.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RACINE = path.resolve(__dirname, "../..");
const WORKFLOW = fs.readFileSync(path.join(RACINE, ".github/workflows/tests-cibles.yml"), "utf8");
const MOTIF_BUFFER = ["buf", "fer"].join("");

function listerTests(dossier: string): string[] {
  const sortie: string[] = [];
  const parcourir = (d: string) => {
    for (const e of fs.readdirSync(path.join(RACINE, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(rel);
      else if (/\.test\.tsx?$/.test(e.name)) sortie.push(rel);
    }
  };
  parcourir(dossier);
  return sortie;
}
const TOUS_LES_TESTS = [...listerTests("tests"), ...listerTests("src")];

function motifsPaths(): string[] {
  const bloc = WORKFLOW.split("\npaths:")[0] === WORKFLOW ? WORKFLOW.split(/\n\s+paths:\n/)[1].split(/\npermissions:/)[0] : "";
  return [...bloc.matchAll(/^\s+- "([^"]+)"/gm)].map((m) => m[1]);
}

function argumentsVitest(): string[] {
  const jetons: string[] = [];
  const re = /pnpm exec vitest run \\\n((?:\s+[^\n]*\\\n)*\s+[^\n]*)/g;
  for (const m of WORKFLOW.matchAll(re)) {
    for (const j of m[1].replace(/\\\n/g, " ").split(/\s+/)) if (j) jetons.push(j);
  }
  return jetons;
}

const echappe = (g: string) =>
  new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*") + "$");

// Même logique que vitest : un argument filtre par sous-chaîne du chemin ; le shell développe d'abord les jokers.
const fichiersVises = (jeton: string): string[] =>
  jeton.includes("*")
    ? TOUS_LES_TESTS.filter((f) => echappe(jeton).test(f))
    : TOUS_LES_TESTS.filter((f) => f === jeton || f.startsWith(jeton + "/") || f.includes(jeton));

describe("L0-13b : workflow tests-cibles sans motif Buffer", () => {
  it("ne cite aucun motif Buffer (paths, listes de tests, commentaires, noms d'étapes)", () => {
    const lignes = WORKFLOW.split("\n").filter((l) => l.toLowerCase().includes(MOTIF_BUFFER));
    expect(lignes).toEqual([]);
  });
  it("garde tests/zernio/** et docs/zernio/** dans paths, et lance tests/zernio en entier", () => {
    const paths = motifsPaths();
    expect(paths).toContain("tests/zernio/**");
    expect(paths).toContain("docs/zernio/**");
    expect(argumentsVitest()).toContain("tests/zernio");
  });
  it("garde r1-envoi-reel dans la liste lancée", () => {
    expect(argumentsVitest()).toContain("r1-envoi-reel");
  });
  it("chaque chemin de test cité existe dans le dépôt", () => {
    const manquants = argumentsVitest().filter((j) => fichiersVises(j).length === 0);
    expect(manquants).toEqual([]);
  });
  it("chaque motif de paths cité vise au moins un fichier du dépôt", () => {
    const tousFichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const e of fs.readdirSync(path.join(RACINE, d), { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === ".git" || e.name === ".next") continue;
        const rel = d ? `${d}/${e.name}` : e.name;
        if (e.isDirectory()) parcourir(rel);
        else tousFichiers.push(rel);
      }
    };
    parcourir("");
    const sansCible = motifsPaths().filter((p) => !tousFichiers.some((f) => echappe(p).test(f)));
    expect(sansCible).toEqual([]);
  });
  it("la couverture ne baisse pas : les tests du relais de médias restent lancés et déclencheurs", () => {
    const vises = new Set(argumentsVitest().flatMap(fichiersVises));
    for (const f of [
      "tests/relais-" + MOTIF_BUFFER + ".test.ts",
      "tests/relais-" + MOTIF_BUFFER + "-proxy.test.ts",
      "tests/" + MOTIF_BUFFER + "-mots-interdits-envoi.test.ts",
      "tests/l1-10-" + MOTIF_BUFFER + "-premier-commentaire.test.ts",
      "tests/r1-ecrans-" + MOTIF_BUFFER + ".test.ts",
      "tests/r1-" + MOTIF_BUFFER + "-client.test.ts",
    ]) expect(vises.has(f), f).toBe(true);
    const paths = motifsPaths();
    for (const f of [
      "src/services/relais-" + MOTIF_BUFFER + ".ts",
      "src/lib/jeton-media-" + MOTIF_BUFFER + ".ts",
      "src/app/api/media-" + MOTIF_BUFFER + "/[jeton]/[nom]/route.ts",
      "tests/relais-" + MOTIF_BUFFER + ".test.ts",
      "tests/relais-" + MOTIF_BUFFER + "-proxy.test.ts",
      "tests/l1-10-" + MOTIF_BUFFER + "-premier-commentaire.test.ts",
    ]) expect(paths.some((p) => echappe(p).test(f)), f).toBe(true);
  });
  it("gèle l'ensemble exact des fichiers lancés par chaque joker (un ajout futur doit échouer ici)", () => {
    const B = MOTIF_BUFFER;
    const gel: Record<string, string[]> = {
      "tests/l1-10-*.test.ts": [`tests/l1-10-${B}-premier-commentaire.test.ts`],
      "tests/relais-*.test.ts": [`tests/relais-${B}-proxy.test.ts`, `tests/relais-${B}.test.ts`],
      "tests/r1-ecrans-*.test.ts": [`tests/r1-ecrans-${B}.test.ts`],
      "tests/r1-*-client.test.ts": [`tests/r1-${B}-client.test.ts`],
      "tests/*-mots-interdits-envoi.test.ts": ["tests/a-publier-mots-interdits-envoi.test.ts", `tests/${B}-mots-interdits-envoi.test.ts`],
    };
    const lances = argumentsVitest();
    for (const [joker, attendus] of Object.entries(gel)) {
      expect(lances, joker).toContain(joker);
      expect(fichiersVises(joker).sort(), joker).toEqual([...attendus].sort());
    }
    const jokersLances = lances.filter((j) => j.includes("*") && !j.startsWith("tests/zernio"));
    expect(jokersLances.sort()).toEqual(Object.keys(gel).sort());
  });
});
