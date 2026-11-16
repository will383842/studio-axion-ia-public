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

  // Règle déterministe (G1-07b) : on compare le commit G1-07 figé à son parent, pas la branche courante à master.
  const G1_07 = "7e6348227170b7b7d6a0547f49692a4b2b2fb980";
  it("sous src/, le commit G1-07 n'a changé que des lignes de commentaire (exactement 6)", () => {
    try {
      execFileSync("git", ["cat-file", "-e", `${G1_07}^{commit}`], { stdio: "ignore" });
    } catch {
      return; // pas d'historique git (copie sans historique) : rien à comparer
    }
    const diff = execFileSync("git", ["diff", "-U0", `${G1_07}^`, G1_07, "--", "src/"], { encoding: "utf8" });
    const lignes = diff.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
    for (const l of lignes) expect(/^[+-]\s*(\/\/|\*|\/\*)/.test(l), l).toBe(true);
    expect(lignes.length).toBe(6); // 3 fichiers × 1 ligne retirée + 1 ajoutée
  });
});
