// ST-02 : tests-cibles.yml lance aussi les tests de la porte, du budget et de la corbeille. Lecture de fichier seule, aucun réseau.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const racine = path.resolve(__dirname, "../..");
const texte = fs.readFileSync(path.join(racine, ".github/workflows/tests-cibles.yml"), "utf8");
const AJOUTES = ["tests/l1-09-budget-mensuel.test.ts", "tests/corbeille.test.ts", "tests/corbeille-ui.test.ts"];
const PORTE = "tests/porte-usine-garde-budget.test.ts";

const paths = texte
  .split("\n")
  .map((l) => /^\s+- "(.+)"\s*$/.exec(l)?.[1])
  .filter((x): x is string => !!x);
const lancees = texte.split("\n").filter((l) => /^\s+tests\/\S+\s*\\?$/.test(l)).map((l) => l.trim().replace(/\s*\\$/, ""));

describe("ST-02 · tests-cibles.yml : porte, budget, corbeille", () => {
  it.each([PORTE, ...AJOUTES])("%s est lancé par le workflow", (f) => {
    expect(lancees).toContain(f);
  });
  it.each([PORTE, ...AJOUTES])("%s figure aussi dans « paths »", (f) => {
    expect(paths).toContain(f);
  });
  it("chaque test cité en clair (lancé ou dans paths) existe dans le dépôt", () => {
    for (const f of [...lancees, ...paths].filter((x) => /^tests\/[^*?]+\.test\.tsx?$/.test(x))) {
      expect(fs.existsSync(path.join(racine, f)), `absent : ${f}`).toBe(true);
    }
  });
  it("les motifs tests/zernio/** et docs/zernio/** restent en place", () => {
    expect(paths).toContain("tests/zernio/**");
    expect(paths).toContain("docs/zernio/**");
  });
  it("aucun doublon dans la liste lancée par l'étape principale", () => {
    expect(new Set(lancees).size).toBe(lancees.length);
  });
});
