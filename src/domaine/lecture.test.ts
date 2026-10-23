import { describe, expect, it } from "vitest";
import { dureeParleeEstimee, phrasesTropDenses, SEUIL_MOTS_PAR_SECONDE, syllabes } from "./lecture";

describe("vitesse de lecture des sous-titres (B.5, lot M2)", () => {
  it("syllabes d'un mot français, nombres lus compris", () => {
    expect(syllabes("patron")).toBe(2);
    expect(syllabes("important")).toBe(3);
    expect(syllabes("salarié.")).toBe(3);
    expect(syllabes("personne")).toBe(2);
    expect(syllabes("35")).toBe(2);
    expect(syllabes("000")).toBe(1);
    expect(syllabes("€")).toBe(2);
  });

  it("une phrase de mots courts est trop dense (> 5,5 mots/s) ; une phrase ordinaire ne l'est pas", () => {
    expect(SEUIL_MOTS_PAR_SECONDE).toBe(5.5);
    const dense = "Je ne le lui ai pas dit, mais il le sait et il le dit à tout le monde.";
    const normale = "Votre employeur doit vous informer avant toute modification importante du contrat.";
    expect(phrasesTropDenses(dense, 4.4)).toHaveLength(1);
    expect(phrasesTropDenses(normale, 4.4)).toHaveLength(0);
    expect(dureeParleeEstimee(normale, 4.4)).toBeGreaterThan(2);
  });

  it("l'horodatage réel prime sur l'estimation", () => {
    const normale = "Votre employeur doit vous informer avant toute modification importante du contrat.";
    expect(phrasesTropDenses(normale, 4.4, [1.5])).toHaveLength(1);
    expect(phrasesTropDenses(normale, 4.4, [3])).toHaveLength(0);
  });
});
