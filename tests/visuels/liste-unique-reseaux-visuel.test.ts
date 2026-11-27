import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RESEAUX_VISUEL_ENVOI, RESEAUX_VISUEL_CLASSIQUES, estReseauVisuelEnvoi, reseauxEnvoiDeLaFamille } from "@/domaine/reseaux-visuel-envoi";

/** PR 2 (refactor sans effet) : une seule liste des réseaux qui reçoivent un visuel. */
describe("liste unique des réseaux qui reçoivent un visuel", () => {
  it("vaut les trois réseaux historiques, plus Pinterest (PR 5 : une épingle seulement)", () => {
    expect([...RESEAUX_VISUEL_ENVOI]).toEqual(["linkedin", "instagram", "facebook", "pinterest"]);
    expect([...RESEAUX_VISUEL_CLASSIQUES]).toEqual(["linkedin", "instagram", "facebook"]);
  });

  it("reseauxEnvoiDeLaFamille : épingle → Pinterest seul ; carrousel et infographie → jamais Pinterest", () => {
    expect([...reseauxEnvoiDeLaFamille("epingle")]).toEqual(["pinterest"]);
    for (const f of ["carrousel", "carrousel-continu", "infographie"]) expect([...reseauxEnvoiDeLaFamille(f)]).toEqual(["linkedin", "instagram", "facebook"]);
  });

  it("ne contient ni TikTok ni YouTube", () => {
    expect(estReseauVisuelEnvoi("pinterest")).toBe(true);
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
        else if (/\.tsx?$/.test(nom) && /"linkedin",\s*"instagram",\s*"facebook"\s*[\]\)]/.test(readFileSync(chemin, "utf8"))) fautifs.push(chemin);
      }
    };
    parcourir("src/services");
    parcourir("src/app");
    expect(fautifs).toEqual([]);
  });
});
