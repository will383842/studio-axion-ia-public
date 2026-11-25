/**
 * POLICES-P6-e1-v20l : les nombres dessinés (gros chiffre, briques du plan de scènes) groupent les milliers avec
 * l'espace insécable U+00A0 (présente dans Manrope) et non l'espace fine insécable U+202F (absente : police de secours).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ecrireNombreFr } from "@/briques/motion/petits-objets/gros-chiffre";
import { nombreFr } from "@/briques/plan-scenes/briques/communs";

const FINE = "\u202f";
const INSECABLE = "\u00a0";
const FICHIERS = ["src/briques/motion/petits-objets/gros-chiffre.tsx", "src/briques/plan-scenes/briques/communs.ts"];

describe("POLICES-P6-e1-v20l · espace des milliers dessinée", () => {
  it("(a) ecrireNombreFr : « 1250 » → « 1 250 » avec U+00A0, jamais U+202F", () => {
    expect(ecrireNombreFr(1250)).toBe(`1${INSECABLE}250`);
    expect(ecrireNombreFr(1234567)).toBe(`1${INSECABLE}234${INSECABLE}567`);
    expect(ecrireNombreFr(999)).toBe("999");
    expect(ecrireNombreFr(12.5)).toBe("12,5");
    expect(ecrireNombreFr(49505)).not.toContain(FINE);
  });

  it("(b) nombreFr : « 1250 » → « 1 250 » avec U+00A0, négatif et décimales conservés, jamais U+202F", () => {
    expect(nombreFr(1250, 0)).toBe(`1${INSECABLE}250`);
    expect(nombreFr(-1234567.5, 1)).toBe(`−1${INSECABLE}234${INSECABLE}567,5`);
    expect(nombreFr(999, 0)).toBe("999");
    expect(nombreFr(1000000, 0)).not.toContain(FINE);
  });

  it("(c) garde de texte : aucun U+202F littéral dans les deux fichiers", () => {
    for (const f of FICHIERS) expect(readFileSync(f, "utf8").includes(FINE), f).toBe(false);
  });
});
