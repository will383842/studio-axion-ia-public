import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RUBRIQUES, rubriqueAffichee } from "@/briques/visuels/textes-fixes";

describe("rubrique : jamais répétée par le titre", () => {
  it("T22 « Idée reçue, réalité » : la rubrique « IDÉE REÇUE » n'est pas affichée (le titre la dit déjà)", () => {
    expect(rubriqueAffichee("T22", "Idée reçue, réalité")).toBeUndefined();
    expect(rubriqueAffichee("T22", "IDEE RECUE : la vérité")).toBeUndefined();
  });
  it("T08 dont le titre reprend la rubrique (article compris ou non) : pas de rubrique", () => {
    expect(rubriqueAffichee("T08", "Le constat, puis la suite")).toBeUndefined();
    expect(rubriqueAffichee("T08", "Un constat simple")).toBeUndefined();
    expect(rubriqueAffichee("T23", "Bonnes questions avant de lancer")).toBeUndefined();
  });
  it("titre sans la rubrique : la rubrique reste", () => {
    expect(rubriqueAffichee("T08", "Idée reçue, réalité")).toBe(RUBRIQUES.T08);
    expect(rubriqueAffichee("T22", "Ce que l'on croit")).toBe(RUBRIQUES.T22);
    expect(rubriqueAffichee("T26", undefined)).toBe(RUBRIQUES.T26);
    // Un mot de la rubrique pris dans un autre mot ne compte pas.
    expect(rubriqueAffichee("T08", "Les constatations")).toBe(RUBRIQUES.T08);
  });
  it("le cadre commun des pages passe par `rubriqueAffichee`", () => {
    expect(readFileSync("studio-rendu/compositions/visuels/commun/PageBase.tsx", "utf8")).toContain("rubriqueAffichee(");
  });
});
