import { describe, expect, it } from "vitest";
import { DECLARATIONS, declarationDuFormat } from "../../src/generateurs/declaration";
import { CIBLES_DEMO_FACECAM, CIBLES_TUTORIEL, ciblesDuFormat } from "../../src/services/retouche-chat/rendu-generateurs";

// Sorties d'AVANT (G1-05c), copiées en dur.
const AVANT_TUTORIEL = [
  { id: "4:5", format: "4:5" },
  { id: "9:16", format: "9:16" },
  { id: "1:1", format: "1:1" },
];
const AVANT_DEMO = [{ id: "9:16", format: "9:16" }];

describe("G1-05c : cibles d'export lues dans la déclaration", () => {
  it("ciblesDuFormat est identique à l'avant pour tout format du registre", () => {
    for (const id of Object.keys(DECLARATIONS)) {
      const attendu = id === "tutoriel-outil" ? AVANT_TUTORIEL : id === "demo-facecam" ? AVANT_DEMO : null;
      expect(ciblesDuFormat(id), id).toEqual(attendu);
    }
    expect(ciblesDuFormat("format-inconnu")).toBeNull();
  });

  it("CIBLES_* suivent les ratios de la déclaration, dans l'ordre", () => {
    expect(CIBLES_TUTORIEL.map((c) => c.format)).toEqual([...declarationDuFormat("tutoriel-outil")!.ratios]);
    expect(CIBLES_DEMO_FACECAM.map((c) => c.format)).toEqual([...declarationDuFormat("demo-facecam")!.ratios]);
    expect(CIBLES_TUTORIEL).toEqual(AVANT_TUTORIEL);
    expect(CIBLES_DEMO_FACECAM).toEqual(AVANT_DEMO);
  });

  it("identité conservée et listes figées", () => {
    expect(ciblesDuFormat("tutoriel-outil")).toBe(CIBLES_TUTORIEL);
    expect(ciblesDuFormat("demo-facecam")).toBe(CIBLES_DEMO_FACECAM);
    expect(Object.isFrozen(CIBLES_TUTORIEL)).toBe(true);
  });

  it("le repli n'est jamais pris : les deux déclarations existent avec des ratios", () => {
    for (const id of ["tutoriel-outil", "demo-facecam"]) expect(declarationDuFormat(id)?.ratios.length, id).toBeGreaterThan(0);
  });
});
