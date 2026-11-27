import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESEAUX_VISUEL_ENVOI, estReseauVisuelEnvoi } from "@/domaine/reseaux-visuel-envoi";

/** PR 2 (refactor sans effet) : une seule liste des réseaux qui reçoivent un visuel. */
describe("liste unique des réseaux qui reçoivent un visuel", () => {
  it("vaut exactement l'union des anciennes listes remplacées (LinkedIn, Instagram, Facebook)", () => {
    expect([...RESEAUX_VISUEL_ENVOI]).toEqual(["linkedin", "instagram", "facebook"]);
  });

  it("ne contient ni TikTok ni Pinterest (Pinterest ne part toujours pas)", () => {
    expect(estReseauVisuelEnvoi("pinterest")).toBe(false);
    expect(estReseauVisuelEnvoi("tiktok")).toBe(false);
    expect(estReseauVisuelEnvoi("youtube")).toBe(false);
    for (const r of ["linkedin", "instagram", "facebook"]) expect(estReseauVisuelEnvoi(r)).toBe(true);
  });

  it("n'est plus recopiée en dur dans src/services ni src/app", () => {
    const fautifs: string[] = [];
    const parcourir = (dossier: string) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) parcourir(chemin);
        else if (/\.tsx?$/.test(nom) && (/"linkedin",\s*"instagram",\s*"facebook"\s*[\]\)]/.test(readFileSync(chemin, "utf8")) || /===\s*"linkedin"\s*\|\|\s*\w+\s*===\s*"instagram"\s*\|\|\s*\w+\s*===\s*"facebook"/.test(readFileSync(chemin, "utf8")))) fautifs.push(chemin);
      }
    };
    parcourir("src/services");
    parcourir("src/app");
    expect(fautifs).toEqual([]);
  });
});
