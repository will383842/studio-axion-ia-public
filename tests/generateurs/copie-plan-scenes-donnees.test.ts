import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const racine = join(__dirname, "..", "..");
const dockerfile = readFileSync(join(racine, "deploiement/studio-rendu/Dockerfile"), "utf8");
const lignes = dockerfile.split(/\r?\n/);

const PLAN_SCENES = "COPY --chown=rendu:rendu src/briques/plan-scenes /app/src/briques/plan-scenes";
const LIGNE = "COPY --chown=rendu:rendu src/briques/plan-scenes-donnees /app/src/briques/plan-scenes-donnees";

describe("G4-11b-1 · le serveur de rendu copie src/briques/plan-scenes-donnees", () => {
  it("la ligne COPY exacte existe, une seule fois", () => {
    expect(lignes.filter((l) => l === LIGNE)).toHaveLength(1);
  });

  it("sa place : juste après la ligne COPY de plan-scenes", () => {
    const i = lignes.indexOf(PLAN_SCENES);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(lignes[i + 1]).toBe(LIGNE);
  });

  it("aucun fichier du dossier copié n'utilise l'alias @/ (le rendu ne le résout pas)", () => {
    const fautifs: string[] = [];
    const parcourir = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) parcourir(p);
        else if (/\.(ts|tsx)$/.test(n) && /from\s+["']@\//.test(readFileSync(p, "utf8"))) fautifs.push(p);
      }
    };
    parcourir(join(racine, "src/briques/plan-scenes-donnees"));
    expect(fautifs).toEqual([]);
  });
});
