import { describe, expect, it } from "vitest";
// @ts-expect-error module .mjs sans types
import { extraireEchecs, comparer, compterLances, rapport } from "../../scripts/comparer-echecs.mjs";

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
