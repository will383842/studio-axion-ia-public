import { describe, expect, it } from "vitest";
import { GABARITS } from "../../src/briques/sous-titres/style";

/** POLICES-P6-IMPACT-v21m : Manrope s'arrête à la graisse 800 ; aucun gabarit de sous-titres ne demande plus. */
const GRAISSE_MAX_MANROPE = 800;

describe("graisses des gabarits de sous-titres (Manrope s'arrête à 800)", () => {
  it("aucun gabarit ne demande une graisse au-dessus de 800", () => {
    const trop = Object.values(GABARITS).filter((g) => g.poids > GRAISSE_MAX_MANROPE).map((g) => `${g.id} : ${g.poids}`);
    expect(trop).toEqual([]);
  });

  it("le gabarit « Impact » demande 800 (il demandait 900, graisse que Manrope n'a pas)", () => {
    expect(GABARITS.impact.poids).toBe(800);
  });
});
