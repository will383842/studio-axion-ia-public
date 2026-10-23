/** Lot D · étape 2 : UN réglage, coupé par défaut ; coupé, chaque adaptation est l'identité. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLE_ADAPTATIONS_RESEAUX, ADAPTATIONS_RESEAUX_PAR_DEFAUT, adaptationsActives } from "@/reseaux/adaptations";

describe("réglage adaptations_reseaux.actif", () => {
  it("nom clair et coupé par défaut", () => {
    expect(CLE_ADAPTATIONS_RESEAUX).toBe("adaptations_reseaux.actif");
    expect(ADAPTATIONS_RESEAUX_PAR_DEFAUT).toBe(false);
  });
  it("seul `true` strict l'allume (absent, null, chaîne : coupé)", () => {
    expect(adaptationsActives(undefined)).toBe(false);
    expect(adaptationsActives(null)).toBe(false);
    expect(adaptationsActives("true")).toBe(false);
    expect(adaptationsActives(1)).toBe(false);
    expect(adaptationsActives(true)).toBe(true);
  });
});

describe("coût du module", () => {
  it("aucun coût : rien n'est importé de payant par le module (ne dépend pas de ffmpeg)", () => {
    const src = readFileSync(join(__dirname, "../../src/reseaux/adaptations.ts"), "utf8");
    expect(src).not.toMatch(/fournisseurs|services\/|claude|heygen|fetch\(/i);
  });
});
