/**
 * SYNCHRONISATION DES BASES DE L'USINE → STUDIO. La copie qui fait foi est `le dépôt privé des bases/usine/bases/pour-la-machine/`
 * (une seule source) ; le studio n'en garde que la lecture en JSON, jamais une version corrigée à la main.
 *
 *   npx tsx scripts/bases/synchroniser-bases.mts <dossier pour-la-machine> [--sortie <dossier>]
 *
 * Écrit `src/donnees/bases-usine/donnees/<n>-<nom>.json` (une par base : { base, fichier, tables }) et `source.json`
 * au format de l'ADR 0001 (commit source, sha256 de chaque Markdown, empreinte unique, sha256 de chaque JSON écrit,
 * `synchronise_le`). Même source = mêmes JSON (ordre fixe) ; seul `synchronise_le` change d'une synchro à l'autre.
 * Si `MANIFESTE-BASES.json` est à côté des bases, il est contrôlé (écart = arrêt, rien n'écrit). Un fichier refusé (colonnes, codes en double) arrête tout et n'écrit rien. Aucun réseau.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { empreinteDe, sha256, type ManifesteBases, type SourceBases } from "../../src/donnees/bases-usine/empreintes";
import { parserTables, type TablesBrutes } from "../../src/donnees/bases-usine/parseur";

const ici = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const iSortie = args.indexOf("--sortie");
const sortie = resolve(iSortie >= 0 ? (args[iSortie + 1] ?? "") : join(ici, "../../src/donnees/bases-usine/donnees"));
const source = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--sortie");
if (!source) {
  console.error("Usage : npx tsx scripts/bases/synchroniser-bases.mts <dossier pour-la-machine> [--sortie <dossier>]");
  process.exit(1);
}
const dossier = resolve(source);

function git(...a: string[]): string | null {
  try {
    return execFileSync("git", ["-C", dossier, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

const fichiers = readdirSync(dossier)
  .filter((f) => /^\d+-.+\.md$/.test(f))
  .sort();
if (fichiers.length === 0) {
  console.error(`Aucun fichier « n-nom.md » dans ${dossier}.`);
  process.exit(1);
}

/** JSON stable, une ligne de table par ligne de fichier (diffs lisibles). */
function enJson(base: number, fichier: string, tables: TablesBrutes): string {
  const blocs = Object.entries(tables).map(
    ([nom, t]) => `    ${JSON.stringify(nom)}: {\n      "colonnes": ${JSON.stringify(t.colonnes)},\n      "lignes": [${t.lignes.map((l) => `\n        ${JSON.stringify(l)}`).join(",")}${t.lignes.length ? "\n      " : ""}]\n    }`,
  );
  return `{\n  "base": ${base},\n  "fichier": ${JSON.stringify(fichier)},\n  "tables": {\n${blocs.join(",\n")}\n  }\n}\n`;
}

const resultats = fichiers.map((f) => {
  const texte = readFileSync(join(dossier, f), "utf8");
  return { f, tables: parserTables(texte, f), empreinte: sha256(texte) };
});

const fichiersMd = Object.fromEntries(resultats.map((r) => [r.f, r.empreinte]));
const empreinte = empreinteDe(fichiersMd);
const fichierManifeste = join(dossier, "MANIFESTE-BASES.json");
if (existsSync(fichierManifeste)) {
  const m = JSON.parse(readFileSync(fichierManifeste, "utf8")) as ManifesteBases;
  const ecart = m.empreinte !== empreinte || JSON.stringify(m.fichiers) !== JSON.stringify(fichiersMd);
  if (ecart) {
    console.error("MANIFESTE-BASES.json ne correspond pas aux bases lues : le régénérer dans depot-prive, ne rien corriger ici.");
    process.exit(1);
  }
}

const jsons = resultats.map((r) => {
  const base = r.f.replace(/\.md$/, "");
  return { nom: `${base}.json`, texte: enJson(Number(base.split("-")[0]), r.f, r.tables) };
});

mkdirSync(sortie, { recursive: true });
for (const ancien of readdirSync(sortie)) if (ancien.endsWith(".json")) rmSync(join(sortie, ancien));
for (const j of jsons) writeFileSync(join(sortie, j.nom), j.texte);
const contenuSource: SourceBases = {
  version: 1,
  source: "le dépôt privé des bases/usine/bases/pour-la-machine",
  commit: git("rev-parse", "HEAD"),
  date: git("log", "-1", "--format=%cI"),
  synchronise_le: new Date().toISOString(),
  fichiers: fichiersMd,
  empreinte,
  json: Object.fromEntries(jsons.map((j) => [j.nom, sha256(j.texte)])),
};
writeFileSync(join(sortie, "source.json"), JSON.stringify(contenuSource, null, 2) + "\n");
for (const r of resultats) console.log(`${r.f} : ${Object.entries(r.tables).map(([n, t]) => `${n} ${t.lignes.length}`).join(", ")}`);
