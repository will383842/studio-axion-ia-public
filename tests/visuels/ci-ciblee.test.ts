/** M1-07 : la CI ciblée des visuels est limitée, annulable, bornée dans le temps, épinglée par SHA, sans secret. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const YAML = readFileSync(".github/workflows/tests-visuels.yml", "utf8");
const SANS_COMMENTAIRES = YAML.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");

const CHEMINS = [
  "src/visuels/**",
  "src/briques/visuels/**",
  "src/domaine/visuels/**",
  "src/domaine/controles-visuel/**",
  "src/components/visuels/**",
  "src/app/(studio)/carrousels/**",
  "src/app/api/carrousels-continus/**",
  "tests/visuels/**",
  // Des tests de tests/visuels importent cette composition : une modification doit relancer la CI ciblée.
  "studio-rendu/compositions/visuels/**",
  // Opération de la toile continue : ses fonctions pures sont testées dans tests/visuels.
  "studio-rendu/src/operations/toile-*.ts",
  "tsconfig.visuels.json",
  ".github/workflows/tests-visuels.yml",
];

describe("CI ciblée des visuels", () => {
  it("déclenchée sur pull_request et push master", () => {
    expect(SANS_COMMENTAIRES).toMatch(/^on:/m);
    expect(SANS_COMMENTAIRES).toMatch(/pull_request:/);
    expect(SANS_COMMENTAIRES).toMatch(/push:\s*\n\s+branches:\s*\[?\s*master\s*\]?/);
  });
  it.each(CHEMINS)("filtre paths : %s", (chemin) => {
    expect(SANS_COMMENTAIRES).toContain(`"${chemin}"`);
  });
  it("le filtre paths est exactement la liste attendue (au moins pour pull_request)", () => {
    const trouves = [...SANS_COMMENTAIRES.matchAll(/^\s+- "([^"]+)"\s*$/gm)].map((m) => m[1]);
    expect(new Set(trouves)).toEqual(new Set(CHEMINS));
  });
  it("annule les exécutions précédentes", () => {
    expect(SANS_COMMENTAIRES).toMatch(/concurrency:[\s\S]*cancel-in-progress:\s*true/);
  });
  it("timeout ≤ 15 minutes", () => {
    const m = [...SANS_COMMENTAIRES.matchAll(/timeout-minutes:\s*(\d+)/g)].map((x) => Number(x[1]));
    expect(m.length).toBeGreaterThan(0);
    for (const v of m) expect(v).toBeLessThanOrEqual(15);
  });
  it("toutes les actions sont épinglées par SHA complet", () => {
    const usages = [...SANS_COMMENTAIRES.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]);
    expect(usages.length).toBeGreaterThanOrEqual(3);
    for (const u of usages) expect(u).toMatch(/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/);
  });
  it("checkout sans persistance des identifiants", () => {
    expect(SANS_COMMENTAIRES).toMatch(/actions\/checkout@[0-9a-f]{40}[^\n]*\n\s+with:\s*\n\s+persist-credentials:\s*false/);
  });
  it("commentaires de version exacts (pas de « # v4 » seul)", () => {
    const versions = [...YAML.matchAll(/uses:\s*\S+@[0-9a-f]{40}\s+# (\S+)/g)].map((m) => m[1]);
    expect(versions.length).toBeGreaterThanOrEqual(3);
    for (const v of versions) expect(v).toMatch(/^v\d+\.\d+\.\d+$/);
  });
  it("aucun secret, aucun Docker", () => {
    expect(SANS_COMMENTAIRES).not.toMatch(/secrets\./);
    expect(SANS_COMMENTAIRES.toLowerCase()).not.toMatch(/docker/);
  });
  it("lance les tests visuels puis tsc ciblé", () => {
    const iTests = SANS_COMMENTAIRES.indexOf("pnpm vitest run tests/visuels");
    const iTsc = SANS_COMMENTAIRES.indexOf("pnpm tsc --noEmit -p tsconfig.visuels.json");
    expect(iTests).toBeGreaterThan(-1);
    expect(iTsc).toBeGreaterThan(iTests);
    expect(SANS_COMMENTAIRES).toContain("pnpm install --frozen-lockfile --ignore-scripts");
  });
  it("note que tsc ne couvre pas la composition Remotion (les tests, eux, l'importent)", () => {
    const t = JSON.parse(readFileSync("tsconfig.visuels.json", "utf8"));
    expect((t.include as string[]).some((i) => i.startsWith("studio-rendu"))).toBe(false);
    expect(YAML).toMatch(/#[^\n]*tsc[^\n]*ne couvre pas[^\n]*studio-rendu/);
  });
  it("tsconfig.visuels.json étend le tsconfig existant", () => {
    const t = JSON.parse(readFileSync("tsconfig.visuels.json", "utf8"));
    expect(t.extends).toBe("./tsconfig.json");
    expect(t.include.length).toBeGreaterThan(0);
  });
});
