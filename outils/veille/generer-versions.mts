/**
 * Génère `src/veille/versions-utilisees.ts` depuis `studio-rendu/package.json` (l'image du studio n'embarque pas
 * `studio-rendu/` : la version utilisée doit donc être recopiée dans le code du studio).
 * Usage : npx tsx outils/veille/generer-versions.mts
 * Le test `tests/b2-versions-utilisees.test.ts` échoue si le fichier généré et le package.json divergent.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PAQUETS_SUIVIS = ["remotion", "@remotion/bundler", "@remotion/renderer"] as const;

export function contenuVersions(pkg: { dependencies?: Record<string, string> }): string {
  const lignes = PAQUETS_SUIVIS.map((p) => `  ${JSON.stringify(p)}: ${JSON.stringify(pkg.dependencies?.[p] ?? "")},`);
  return [
    "/**",
    " * GÉNÉRÉ par `outils/veille/generer-versions.mts` depuis `studio-rendu/package.json` — ne pas modifier à la main.",
    " * Après une mise à jour de Remotion dans `studio-rendu`, relancer : npx tsx outils/veille/generer-versions.mts",
    " */",
    "export const VERSIONS_STUDIO_RENDU = {",
    ...lignes,
    "} as const;",
    "",
  ].join("\n");
}

const racine = process.cwd();
const pkg = JSON.parse(readFileSync(join(racine, "studio-rendu", "package.json"), "utf8"));
const cible = join(racine, "src", "veille", "versions-utilisees.ts");
writeFileSync(cible, contenuVersions(pkg));
console.log(`Écrit : ${cible}`);
