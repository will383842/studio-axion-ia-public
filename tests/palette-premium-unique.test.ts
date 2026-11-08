import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOSSIER = "studio-rendu/compositions/interface-claire/variantes";
const HEX = ["DECFB9", "DEC0A8", "D4C2AA", "CBBFAD", "BC6441", "94806A", "934122", "45392D"];

const lire = (n: number) => readFileSync(`${DOSSIER}/premium-${n}.tsx`, "utf8");
const compte = (src: string, hex: string) => (src.match(new RegExp(`#${hex}`, "gi")) ?? []).length;

describe("palette des variantes premium : une seule définition", () => {
  it("premium-1 définit chaque mélange une fois", () => {
    for (const h of HEX) expect(compte(lire(1), h), h).toBe(1);
  });
  for (const n of [2, 3, 4, 5]) {
    it(`premium-${n} ne répète aucun mélange et importe la constante`, () => {
      const src = lire(n);
      for (const h of HEX) expect(compte(src, h), h).toBe(0);
      expect(src).toMatch(/from "\.\/premium-1"/);
    });
  }
});
