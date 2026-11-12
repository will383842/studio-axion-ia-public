/**
 * Cohérence du déploiement pour le parcours « lien guide » : le compose ne transmet au conteneur que les variables
 * listées (pas d'env_file). Chaque variable que le code du parcours lit pour le lien doit donc figurer dans le service
 * du Studio du compose ET, vide, dans env.exemple. Test de fichiers, sans réseau.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(__dirname, "..", "..");
const lire = (c: string) => readFileSync(join(RACINE, c), "utf8");
const compose = lire("deploiement/docker-compose.yml");
const exemple = lire("deploiement/env.exemple");

const FICHIERS_PARCOURS = [
  "src/services/parcours-conversation.ts",
  "src/domaine/guide-reseau/lien-guide.ts",
  "src/services/branchements-zernio.ts",
];

/** Variables lues par le code du parcours (forme `env.X`, `process.env.X` ou `VARIABLE_… = "X"`), limitées à celles du lien et du merci. */
function variablesDuLien(): string[] {
  const motifs = [
    /\benv\.([A-Z][A-Z0-9_]+)/g,
    /VARIABLE_[A-Z_]+\s*=\s*"([A-Z][A-Z0-9_]+)"/g,
  ];
  const vues = new Set<string>();
  for (const f of FICHIERS_PARCOURS)
    for (const m of motifs) for (const r of lire(f).matchAll(m)) vues.add(r[1]);
  return [...vues].filter((v) => /LIEN|MERCI|REDUCTION/.test(v)).sort();
}

const blocStudio = compose.slice(
  compose.indexOf("\n  studio:"),
  compose.indexOf("\n  studio-rendu:"),
);
const ATTENDUES = [
  "PARCOURS_LIEN_GUIDE",
  "GUIDES_RESEAU_LIEN_SECRET",
  "LIEN_GUIDE_COMPTES",
  "PARCOURS_MERCI_ENABLED",
  "PARCOURS_REDUCTION_IDS",
];

describe("compose et env.exemple : variables du lien guide", () => {
  const lues = variablesDuLien();

  it("le relevé trouve bien les variables attendues (le test n'est pas aveugle)", () => {
    for (const v of ATTENDUES) expect(lues, v).toContain(v);
  });

  it("chaque variable lue pour le lien est transmise au Studio sous la forme NOM: ${NOM:-}", () => {
    for (const v of lues)
      expect(blocStudio, v).toContain(`      ${v}: \${${v}:-}`);
  });

  it("chaque variable lue pour le lien figure vide (NOM=) dans env.exemple", () => {
    const lignes = exemple.split(/\r?\n/);
    for (const v of lues) expect(lignes, v).toContain(`${v}=`);
  });
});
