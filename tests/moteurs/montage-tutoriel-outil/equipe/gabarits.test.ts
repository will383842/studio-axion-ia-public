import { describe, expect, it } from "vitest";
import { GABARITS, gabaritParId } from "@/moteurs/montage-tutoriel-outil/equipe/gabarits";

describe("gabarits de parcours (T-EXT-22)", () => {
  const tous = Object.values(GABARITS);

  it("les quatre gabarits existent, G-Flux compris (cas 3 et 5, gelé)", () => {
    expect(Object.keys(GABARITS).sort()).toEqual(["G-Decision", "G-Flux", "G-Journee", "G-Reponse"]);
    expect(gabaritParId("G-Journee")?.id).toBe("G-Journee");
    expect(gabaritParId("G-Flux")?.id).toBe("G-Flux");
    expect(gabaritParId("G-Flux")?.cas).toEqual([3, 5]);
    expect(Object.isFrozen(gabaritParId("G-Flux"))).toBe(true);
  });

  it("règles fermées : 3 moments, 1,5 s d'image fixe au plus, zone zoomée d'au moins 25 %", () => {
    for (const g of tous) {
      expect(g!.momentsMax).toBe(3);
      expect(g!.rythme.fixeMaxMs).toBe(1500);
      expect(g!.rythme.phraseMinMs).toBe(1200);
      expect(g!.lisibilite.largeurZoomeeMinPct).toBe(25);
    }
  });

  it("chaque gabarit commence par la situation et finit par le gain, sans segment sans geste", () => {
    for (const g of tous) {
      expect(g!.sequence[0]!.temps).toBe("situation");
      expect(g!.sequence[g!.sequence.length - 1]!.temps).toBe("gain");
      for (const s of g!.sequence) {
        expect(s.gestes.length).toBeGreaterThan(0);
        expect(s.montre.length).toBeGreaterThan(0);
      }
    }
  });

  it("les gabarits sont gelés en profondeur", () => {
    expect(Object.isFrozen(GABARITS)).toBe(true);
    for (const g of tous) {
      expect(Object.isFrozen(g)).toBe(true);
      expect(Object.isFrozen(g!.sequence)).toBe(true);
      expect(Object.isFrozen(g!.sequence[0])).toBe(true);
      expect(Object.isFrozen(g!.sequence[0]!.gestes)).toBe(true);
    }
  });

  it("cas servis : G-Journée 1 et 4, G-Décision 1 et 5, G-Réponse 4", () => {
    expect(GABARITS["G-Journee"]!.cas).toEqual([1, 4]);
    expect(GABARITS["G-Decision"]!.cas).toEqual([1, 5]);
    expect(GABARITS["G-Reponse"]!.cas).toEqual([4]);
  });
});
