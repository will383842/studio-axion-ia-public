import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (chemin: string) => readFileSync(chemin, "utf8");
const PERIL = /pas (encore )?branch[ée]/i;

describe("G1-07 · guide « Ajouter un format » et commentaires à jour", () => {
  it("les trois commentaires ne disent plus « pas branché » pour la démo et le tutoriel", () => {
    for (const f of ["src/formats/demo-facecam/index.ts", "src/moteurs/index.ts", "src/formats/registre-codes.ts"]) {
      expect(PERIL.test(lire(f)), f).toBe(false);
    }
  });

  it("le guide ne dit plus « pas branché » et cite CalquesCommuns et video.entrees", () => {
    const guide = lire("docs/formats/AJOUTER-UN-FORMAT.md");
    expect(PERIL.test(guide)).toBe(false);
    expect(guide).toContain("CalquesCommuns");
    expect(guide).toContain("video.entrees");
    expect(guide).toContain("lireParametre");
  });

  it("sous src/, seules des lignes de commentaire changent", () => {
    let base = "";
    try {
      base = execFileSync("git", ["merge-base", "HEAD", "origin/master"], { encoding: "utf8" }).trim();
    } catch {
      return; // pas de référence git (copie sans historique) : rien à comparer
    }
    const diff = execFileSync("git", ["diff", "-U0", base, "--", "src/"], { encoding: "utf8" });
    const lignes = diff.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
    for (const l of lignes) expect(/^[+-]\s*(\/\/|\*|\/\*)/.test(l), l).toBe(true);
  });
});
