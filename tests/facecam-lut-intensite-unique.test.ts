/**
 * GV-LU-02 : la LUT du Look a la MÊME intensité sur la prise et sur les plans d'illustration (lookBroll).
 * Valeur unique : celle de la commande (70 % par défaut à la fabrication).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { habillageFacecam, intensiteLutCommande } from "@/moteurs/montage-facecam/habillage";

const base = { pisteMonteeCle: "p.mov", dureeSec: 10, mots: [], prefixeCartes: "c", lookLutCle: "luts/axion.cube" };

describe("GV-LU-02 · intensité unique de la LUT", () => {
  it.each([[70, 0.7], [40, 0.4]])("commande à %i → lookBroll.intensite %f", (pct, attendu) => {
    const h = habillageFacecam({ ...base, lookLutIntensite: intensiteLutCommande({ intensite: pct }) / 100 });
    expect(h.entree.lookBroll).toEqual({ lutCle: "luts/axion.cube", intensite: attendu });
  });

  it("la valeur 70 % de la prise passe telle quelle (aucun repli 60)", () => {
    expect(intensiteLutCommande({ intensite: 70 })).toBe(70);
  });

  it("intensité absente : erreur lisible", () => {
    expect(() => intensiteLutCommande(null)).toThrow(/Intensité de la LUT/);
    expect(() => intensiteLutCommande({})).toThrow(/Intensité de la LUT/);
  });

  it("chaîne 9:16 et déclinaisons 4:5 / 1:1 lisent la même intensité de la commande", () => {
    const dossier = join(__dirname, "../src/moteurs/montage-facecam");
    const chaine = readFileSync(join(dossier, "chaine.ts"), "utf8");
    const decl = readFileSync(join(dossier, "declinaisons.ts"), "utf8");
    expect(chaine.match(/lookLutIntensite: intensiteLutCommande\(c\.styles\.lut\) \/ 100/g)).toHaveLength(2);
    expect(decl.match(/lookLutIntensite: intensiteLutCommande\(commande\.styles\.lut\) \/ 100/g)).toHaveLength(1);
  });

  it("plus aucun « ?? 60 » dans montage-facecam", () => {
    const dossier = join(__dirname, "../src/moteurs/montage-facecam");
    for (const f of readdirSync(dossier).filter((n) => n.endsWith(".ts"))) {
      expect(readFileSync(join(dossier, f), "utf8"), f).not.toMatch(/\?\?\s*60\b/);
    }
  });
});
