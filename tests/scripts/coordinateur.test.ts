/** L0-18 · coordinateur de fusion sans IA : décisions pures + faux `gh`. Aucun appel réel. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PLAFOND_EXECUTIONS, decider, calculerPlafonds, coordonner } from "../../scripts/coordinateur.mjs";

const RACINE = join(__dirname, "../..");
const verte = [{ name: "verifier", status: "COMPLETED", conclusion: "SUCCESS" }];
const pr = (o: Record<string, unknown> = {}) => ({
  number: 7, isDraft: false, headRefName: "usine/XX-01", headRefOid: "abc123", baseRefName: "master", isCrossRepository: false,
  labels: [{ name: "relu" }], statusCheckRollup: verte, files: [{ path: "src/a.ts" }], ...o,
});
const noms = (...l: string[]) => l.map((name) => ({ name }));

describe("decider", () => {
  it("fusionne : CI verte + relu, sans label sensible", () => expect(decider(pr()).action).toBe("fusionner"));
  it("attend sans le label relu", () => expect(decider(pr({ labels: [] })).action).toBe("attendre"));
  it.each(["sensible-a-fusionner", "attend-fondateur", "attend-zone", "manuel", "bloque", "a-corriger"])("n'y touche pas avec %s", (l) => {
    expect(decider(pr({ labels: noms("relu", l) })).action).toBe("attendre");
  });
  it("attend si la CI est rouge, en cours ou absente", () => {
    expect(decider(pr({ statusCheckRollup: [{ name: "verifier", status: "COMPLETED", conclusion: "FAILURE" }] })).action).toBe("attendre");
    expect(decider(pr({ statusCheckRollup: [{ name: "verifier", status: "IN_PROGRESS", conclusion: "" }] })).action).toBe("attendre");
    expect(decider(pr({ statusCheckRollup: [] })).action).toBe("attendre");
  });
  it("une autre vérification rouge empêche aussi", () => {
    expect(decider(pr({ statusCheckRollup: [...verte, { name: "x", status: "COMPLETED", conclusion: "FAILURE" }] })).action).toBe("attendre");
  });
  it("une PR qui touche .github reste au fondateur même sans label", () => {
    expect(decider(pr({ files: [{ path: ".github/workflows/x.yml" }] })).action).toBe("attendre");
  });
  it("brouillon, venue d'un fork, hors branche usine/*, autre base : jamais", () => {
    for (const o of [{ isDraft: true }, { isCrossRepository: true }, { headRefName: "feature/x" }, { baseRefName: "autre" }]) expect(decider(pr(o)).action).toBe("attendre");
  });
});

describe("plafonds", () => {
  it("80 % du plafond d'exécutions, mesurable", () => {
    expect(PLAFOND_EXECUTIONS).toBe(320);
    expect(calculerPlafonds({ branches: 0, executions: 255 }).arret).toBe(false);
    expect(calculerPlafonds({ branches: 0, executions: 256 }).arret).toBe(true);
  });
  it("80 % du plafond de branches", () => {
    expect(calculerPlafonds({ branches: 80, executions: 0 }, { branches: 100 }).arret).toBe(true);
    expect(calculerPlafonds({ branches: 79, executions: 0 }, { branches: 100 }).arret).toBe(false);
  });
  it("les jetons ne sont dits qu'en estimation", () => expect(calculerPlafonds({ branches: 1, executions: 1 }).jetons).toMatch(/estimation/));
});

/** Faux `gh` : répond depuis une table, note chaque appel. */
function fauxGh(prs: unknown[], opts: { arret?: boolean; executions?: number; branches?: number } = {}) {
  const appels: string[][] = [];
  const gh = (args: string[]) => {
    appels.push(args);
    const t = args.join(" ");
    if (t.startsWith("pr list")) return JSON.stringify(prs.map((p) => ({ number: (p as { number: number }).number })));
    if (t.startsWith("pr view")) return JSON.stringify(prs.find((p) => String((p as { number: number }).number) === args[2]));
    if (t.includes("git/matching-refs")) return JSON.stringify(Array.from({ length: opts.branches ?? 3 }, (_, i) => ({ ref: `refs/heads/usine/B${i}` })));
    if (t.includes("actions/runs")) return JSON.stringify({ total_count: opts.executions ?? 10 });
    if (t.includes("contents/pilotage/ARRET") && !t.includes("PUT")) {
      if (opts.arret) return JSON.stringify({ sha: "s" });
      throw new Error("404");
    }
    return "";
  };
  return { gh, appels };
}
const lanceMerge = (appels: string[][]) => appels.filter((a) => a[0] === "pr" && a[1] === "merge");

describe("coordonner", () => {
  it("mode à blanc par défaut : liste, ne fusionne pas", () => {
    const { gh, appels } = fauxGh([pr()]);
    const r = coordonner({ gh, env: {}, depot: "o/d" });
    expect(lanceMerge(appels)).toHaveLength(0);
    expect(r.aBlanc).toBe(true);
    expect(r.fusionnables).toEqual([7]);
  });
  it("mode allumé explicitement : gh pr merge --squash sur la tête relue", () => {
    const { gh, appels } = fauxGh([pr()]);
    coordonner({ gh, env: { COORDINATEUR_FUSION: "oui" }, depot: "o/d" });
    expect(lanceMerge(appels)).toEqual([["pr", "merge", "7", "--squash", "--match-head-commit", "abc123", "--repo", "o/d"]]);
  });
  it("une valeur autre que « oui » reste à blanc", () => {
    const { gh, appels } = fauxGh([pr()]);
    coordonner({ gh, env: { COORDINATEUR_FUSION: "true" }, depot: "o/d" });
    expect(lanceMerge(appels)).toHaveLength(0);
  });
  it("PR sensible ou non relue : aucune fusion même allumé", () => {
    const { gh, appels } = fauxGh([pr({ number: 1, labels: noms("relu", "sensible-a-fusionner") }), pr({ number: 2, labels: [] }), pr({ number: 3, labels: noms("relu", "attend-fondateur") })]);
    coordonner({ gh, env: { COORDINATEUR_FUSION: "oui" }, depot: "o/d" });
    expect(lanceMerge(appels)).toHaveLength(0);
  });
  it("ARRET présent : aucune fusion, et ARRET n'est jamais retiré", () => {
    const { gh, appels } = fauxGh([pr()], { arret: true });
    coordonner({ gh, env: { COORDINATEUR_FUSION: "oui" }, depot: "o/d" });
    expect(lanceMerge(appels)).toHaveLength(0);
    expect(appels.some((a) => a.join(" ").includes("DELETE"))).toBe(false);
  });
  it("à 80 % des plafonds, pose ARRET (allumé) et ne fusionne plus", () => {
    const { gh, appels } = fauxGh([pr()], { executions: 300 });
    const r = coordonner({ gh, env: { COORDINATEUR_FUSION: "oui" }, depot: "o/d" });
    expect(r.arretPose).toBe(true);
    expect(appels.some((a) => a.join(" ").includes("PUT") && a.join(" ").includes("pilotage/ARRET"))).toBe(true);
    expect(lanceMerge(appels)).toHaveLength(0);
  });
  it("à blanc, ne pose pas ARRET mais le dit", () => {
    const { gh, appels } = fauxGh([pr()], { executions: 300 });
    const r = coordonner({ gh, env: {}, depot: "o/d" });
    expect(r.arretPose).toBe(false);
    expect(r.arretNecessaire).toBe(true);
    expect(appels.some((a) => a.join(" ").includes("PUT"))).toBe(false);
  });
});

describe("garde-fous (lecture du code source)", () => {
  const script = readFileSync(join(RACINE, "scripts/coordinateur.mjs"), "utf-8");
  const flux = readFileSync(join(RACINE, ".github/workflows/coordinateur.yml"), "utf-8");
  it("aucun appel à une IA", () => {
    expect(script + flux).not.toMatch(/anthropic|openai|claude|gemini|mistral|llm|api\.anthropic|ANTHROPIC_API_KEY/i);
  });
  it("workflow : cron d'au plus 30 minutes, pas de pull_request, aucun secret, permissions minimales", () => {
    expect(flux).toMatch(/cron:\s*"\*\/30 \* \* \* \*"|cron:\s*"\*\/(?:[1-9]|[12]\d|30) \* \* \* \*"/);
    expect(flux).not.toMatch(/pull_request/);
    expect(flux).not.toMatch(/secrets\.(?!GITHUB_TOKEN)/);
    expect(flux).toMatch(/permissions:\s*\n\s+contents: write\s*\n\s+pull-requests: write\s*\n\s+actions: read/);
    expect(flux).not.toMatch(/permissions:\s*write-all/);
    expect(flux).not.toMatch(/head\.sha|head\.ref|github\.head_ref/);
  });
  it("le mode par défaut est à blanc", () => expect(flux).toMatch(/COORDINATEUR_FUSION:\s*\$\{\{\s*vars\.COORDINATEUR_FUSION\s*\|\|\s*'non'\s*\}\}/));
  it("la fusion est un squash sur la tête relue", () => expect(script).toMatch(/"--squash"/));
});
