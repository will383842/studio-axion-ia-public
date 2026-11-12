import { describe, expect, it } from "vitest";
// @ts-expect-error module .mjs sans types
import { extraireEchecs, comparer, compterLances, rapport, selectionnerTests } from "../../scripts/comparer-echecs.mjs";

const rapportVitest = (fichiers: Record<string, [string, "passed" | "failed"][]>) => ({
  testResults: Object.entries(fichiers).map(([name, cas]) => ({
    name: `/depot/${name}`,
    status: cas.some(([, s]) => s === "failed") ? "failed" : "passed",
    assertionResults: cas.map(([fullName, status]) => ({ fullName, status })),
  })),
});

describe("comparer-echecs", () => {
  it("compte les tests lancés", () => {
    const r = rapportVitest({ "tests/a.test.ts": [["un", "passed"], ["deux", "failed"]] });
    expect(compterLances(r)).toBe(2);
    expect(rapport(comparer(r, { echecs: [] }))).toContain("2 tests lancés");
  });

  it("une PR conforme (aucun échec) est verte", () => {
    const r = rapportVitest({ "tests/a.test.ts": [["un", "passed"]] });
    const res = comparer(r, { echecs: [] });
    expect(res.ok).toBe(true);
    expect(res.nouveaux).toEqual([]);
  });

  it("un échec absent de la liste est rouge", () => {
    const r = rapportVitest({ "tests/a.test.ts": [["casse", "failed"]] });
    const res = comparer(r, { echecs: [] });
    expect(res.ok).toBe(false);
    expect(res.nouveaux).toEqual([{ fichier: "tests/a.test.ts", nom: "casse" }]);
  });

  it("un échec connu reste vert", () => {
    const r = rapportVitest({ "tests/a.test.ts": [["casse", "failed"]] });
    const res = comparer(r, { echecs: [{ fichier: "tests/a.test.ts", nom: "casse" }] });
    expect(res.ok).toBe(true);
    expect(res.connus).toHaveLength(1);
  });

  it("un échec connu corrigé est signalé sans être rouge", () => {
    const r = rapportVitest({ "tests/a.test.ts": [["casse", "passed"]] });
    const res = comparer(r, { echecs: [{ fichier: "tests/a.test.ts", nom: "casse" }] });
    expect(res.ok).toBe(true);
    expect(res.corriges).toHaveLength(1);
  });

  it("un fichier qui plante sans test est un échec de fichier", () => {
    const r = { testResults: [{ name: "/depot/tests/b.test.ts", status: "failed", assertionResults: [] }] };
    expect(extraireEchecs(r)).toEqual([{ fichier: "tests/b.test.ts", nom: "(fichier)" }]);
    expect(comparer(r, { echecs: [] }).ok).toBe(false);
  });

  it("refuse un rapport ou une liste illisible", () => {
    expect(() => comparer({}, { echecs: [] })).toThrow();
    expect(() => comparer({ testResults: [] }, {})).toThrow();
  });

  it("zéro test lancé est refusé", () => {
    expect(comparer({ testResults: [] }, { echecs: [] }).ok).toBe(false);
  });
});

describe("selectionnerTests (sélection du workflow)", () => {
  const noms = [
    "tests/socle-aucun-appel-reel.test.ts",
    "tests/scripts/comparer-echecs.test.ts",
    "tests/composants/a.test.tsx",
    "src/lib/x.test.ts",
    "src/lib/x.ts",
    "tests/aide.ts",
    "docs/a.test.ts.md",
    "scripts/comparer-echecs.mjs",
  ];
  it("garde les tests de la racine de tests/, des sous-dossiers et de src/", () => {
    expect(selectionnerTests(noms)).toEqual([
      "tests/socle-aucun-appel-reel.test.ts",
      "tests/scripts/comparer-echecs.test.ts",
      "tests/composants/a.test.tsx",
      "src/lib/x.test.ts",
    ]);
  });
  it("ignore lignes vides et espaces", () => {
    expect(selectionnerTests(["", "  tests/a.test.ts  "])).toEqual(["tests/a.test.ts"]);
  });
});

describe("workflow tests-nouveau", () => {
  it("utilise le script testé pour la sélection, pas un pathspec fragile", async () => {
    const { readFileSync } = await import("node:fs");
    const y = readFileSync(".github/workflows/tests-nouveau.yml", "utf8");
    expect(y).toContain("comparer-echecs.mjs --selection");
    expect(y).not.toContain("'tests/**/*.test.ts'");
  });
  it("la sélection en ligne de commande liste un test posé à la racine de tests/", async () => {
    const { execFileSync } = await import("node:child_process");
    const sortie = execFileSync("node", ["scripts/comparer-echecs.mjs", "--selection"], {
      input: "tests/socle.test.ts\nREADME.md\n",
      encoding: "utf8",
    });
    expect(sortie.trim()).toBe("tests/socle.test.ts");
  });
  it("importer le module avec --selection en argv ne lit pas l'entrée standard", async () => {
    const { execFileSync } = await import("node:child_process");
    const code = 'process.argv[2]="--selection"; await import("./scripts/comparer-echecs.mjs");';
    const sortie = execFileSync("node", ["--input-type=module", "-e", code], {
      input: "tests/socle.test.ts\n",
      encoding: "utf8",
    });
    expect(sortie.trim()).toBe("");
  });
});
