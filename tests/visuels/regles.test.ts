import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { chargerReglesCarrousel } from "@/briques/visuels/regles/charger-regles";

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return nom === "node_modules" ? [] : fichiers(chemin);
    return /\.(ts|tsx|mts|js|mjs)$/.test(nom) ? [chemin] : [];
  });
}

describe("règles de carrousel (mécanisme)", () => {
  it("charge des règles typées aux valeurs génériques", () => {
    const r = chargerReglesCarrousel();
    expect(r.version).toBe("carrousel-regles/1");
    expect(r.longueurs.titreMax).toBeGreaterThan(0);
    expect(r.longueurs.corpsMax).toBeGreaterThan(r.longueurs.titreMax);
    expect(r.longueurs.altMax).toBe(125);
    expect(r.cartes.min).toBeLessThanOrEqual(r.cartes.max);
    expect(r.structure.premiereCarte).toBe("couverture");
  });

  it("laisse les listes privées VIDES", () => {
    const r = chargerReglesCarrousel();
    expect(r.motsSignales).toEqual([]);
    expect(r.famillesAccroche).toEqual([]);
    expect(r.appels).toEqual([]);
  });

  it("rejette des règles incohérentes", () => {
    expect(() => chargerReglesCarrousel({ version: "x" })).toThrow();
  });

  it("le loader est l'unique point d'import du fichier JSON", () => {
    const importeurs = fichiers(join(process.cwd(), "src")).concat(fichiers(join(process.cwd(), "tests")))
      .filter((f) => readFileSync(f, "utf8").match(/from\s+["'][^"']*carrousel-regles\.json["']|import\(["'][^"']*carrousel-regles\.json/));
    expect(importeurs.map((f) => basename(f))).toEqual(["charger-regles.ts"]);
  });
});
