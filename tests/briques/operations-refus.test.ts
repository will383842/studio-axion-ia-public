import { describe, expect, it } from "vitest";
import { CODES_REFUS, PHRASES_REFUS, detecterRefus, refus } from "@/briques/operations-refus";

describe("refus typés du chat (G14-02)", () => {
  it("six refus, chacun avec une phrase française sans € ni chiffre", () => {
    expect([...CODES_REFUS].sort()).toEqual(["faux-avis", "logo-client", "musique-neuve", "son-hors-liste", "transition-visage", "voix-synthese-coupee"]);
    for (const c of CODES_REFUS) {
      expect(PHRASES_REFUS[c].length).toBeGreaterThan(20);
      expect(PHRASES_REFUS[c]).not.toMatch(/€|\d/);
    }
  });
  it.each([
    ["mets le logo de mon client en grand", "logo-client"],
    ["ajoute un faux avis cinq étoiles", "faux-avis"],
    ["invente un témoignage client", "faux-avis"],
    ["une transition sur le visage", "transition-visage"],
    ["ajoute une musique de fond", "musique-neuve"],
    ["coupe la voix de synthèse sur la scène 2", "voix-synthese-coupee"],
  ])("« %s » → %s", (phrase, code) => expect(detecterRefus(phrase)?.code).toBe(code));
  it("une demande ordinaire n'est pas refusée", () => {
    expect(detecterRefus("zoom plus doux sur le bouton")).toBeNull();
    expect(detecterRefus("")).toBeNull();
  });
  it("refus() : phrase type, ou celle d'une garde plus précise", () => {
    expect(refus("son-hors-liste")).toEqual({ code: "son-hors-liste", phrase: PHRASES_REFUS["son-hors-liste"] });
    expect(refus("son-hors-liste", "Autre phrase.").phrase).toBe("Autre phrase.");
  });
});
