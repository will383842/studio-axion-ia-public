import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DOSSIER = "studio-rendu/compositions/interface-claire/variantes";
/** Mélanges de l'ancienne palette, recalculés sur la palette 2026 : ils ne doivent plus apparaître nulle part. */
const MELANGES_ANCIENS = ["DECFB9", "DEC0A8", "D4C2AA", "CBBFAD", "BC6441", "94806A", "934122", "45392D"];
/** Couleurs de l'ancienne charte (ivoire, orange, encre, sable) : elles viennent maintenant de COULEURS. */
const COULEURS_ANCIENNES = ["E9DCC8", "B44F29", "110A05", "BFA88B"];

const lire = (n: number) => readFileSync(`${DOSSIER}/premium-${n}.tsx`, "utf8");
const compte = (src: string, hex: string) => (src.match(new RegExp(`#${hex}`, "gi")) ?? []).length;

describe("palette des variantes premium : une seule définition, palette 2026", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    it(`premium-${n} ne contient aucun ancien hex ni ancien rgba`, () => {
      const src = lire(n);
      for (const h of [...MELANGES_ANCIENS, ...COULEURS_ANCIENNES]) expect(compte(src, h), h).toBe(0);
      expect(src).not.toMatch(/rgba\(\s*(17,\s*10,\s*5|233,\s*220,\s*200)\s*,/);
      expect(src).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    });
  }
  for (const n of [2, 3, 4, 5]) {
    it(`premium-${n} importe MELANGES de premium-1 et ne le redéfinit pas`, () => {
      expect(lire(n)).toMatch(/from "\.\/premium-1"/);
      expect(lire(n)).not.toMatch(/melange\(/);
    });
  }
  it("premium-1 calcule les 8 mélanges sur PALETTE (encreDouce = noir) sans orange #D97757 ni #8F3412", () => {
    const src = lire(1);
    expect(src).toMatch(/encreDouce: PALETTE\.noir,/);
    expect(src).toMatch(/ivoireCreux: melange\(PALETTE\.ivoire, PALETTE\.gris, /);
    expect(src).not.toMatch(/PALETTE\.(orange|survol)\b/);
  });
});
