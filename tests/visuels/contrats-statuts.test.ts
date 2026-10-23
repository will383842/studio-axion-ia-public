import { describe, expect, it } from "vitest";
import { corbeillePermise, LIBELLES_STATUT, STATUTS_VISUEL, TRANSITIONS, transitionPermise } from "@/domaine/visuels/statuts";

describe("statuts d'un visuel", () => {
  it("chaque statut a une entrée dans TRANSITIONS et un libellé", () => {
    for (const s of STATUTS_VISUEL) {
      expect(TRANSITIONS[s]).toBeDefined();
      expect(LIBELLES_STATUT[s].length).toBeGreaterThan(0);
    }
  });

  it("refuse valide -> programme et accepte brouillon -> ecrit", () => {
    expect(transitionPermise("valide", "programme")).toBe(false);
    expect(transitionPermise("brouillon", "ecrit")).toBe(true);
    expect(transitionPermise("a_valider", "valide")).toBe(true);
  });

  it("la corbeille est interdite pour programme et publie, permise sinon", () => {
    expect(corbeillePermise("publie")).toBe(false);
    expect(corbeillePermise("programme")).toBe(false);
    for (const s of STATUTS_VISUEL.filter((x) => x !== "publie" && x !== "programme")) {
      expect(corbeillePermise(s)).toBe(true);
    }
  });
});
