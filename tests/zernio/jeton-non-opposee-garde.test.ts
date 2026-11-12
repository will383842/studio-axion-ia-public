/** Garde statique : seul `oppositions-mots.ts` (et le module jeton) peut émettre un jeton « non opposée ». Les tests restent libres. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const RACINE = join(process.cwd(), "src");
const PERMIS = new Set([
  "services/oppositions-mots.ts",
  "domaine/guide-reseau/jeton-non-opposee.ts",
]);
const fichiers = (d: string): string[] =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? fichiers(p) : [p];
  });

describe("émission du jeton « non opposée »", () => {
  it("n'est référencée nulle part ailleurs dans src/", () => {
    const fautifs = fichiers(RACINE)
      .map((p) => relative(RACINE, p).split(sep).join("/"))
      .filter((r) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(r) && !PERMIS.has(r))
      .filter((r) =>
        readFileSync(join(RACINE, r), "utf8").includes(
          "emettreJetonNonOpposee",
        ),
      );
    expect(fautifs).toEqual([]);
  });
  it("le fichier autorisé l'utilise bien (la garde ne regarde pas dans le vide)", () => {
    expect(
      readFileSync(join(RACINE, "services/oppositions-mots.ts"), "utf8"),
    ).toContain("emettreJetonNonOpposee");
  });
});
