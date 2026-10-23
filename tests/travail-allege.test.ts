import { describe, expect, it } from "vitest";
import { allegerTravail } from "@/services/travaux";
import type { Travail } from "@/domaine/types";

describe("allegerTravail", () => {
  it("retire parametres.tableau de la copie, garde le reste, ne touche pas l'original", () => {
    const t = { id: "t", parametres: { tableau: { gros: "x".repeat(1000) }, ratio: "9:16" } } as unknown as Travail;
    const a = allegerTravail(t);
    expect(a.parametres).toEqual({ ratio: "9:16" });
    expect((t.parametres as Record<string, unknown>).tableau).toBeDefined();
  });
  it("sans tableau : même objet", () => {
    const t = { id: "t", parametres: { ratio: "1:1" } } as unknown as Travail;
    expect(allegerTravail(t)).toBe(t);
  });
});
