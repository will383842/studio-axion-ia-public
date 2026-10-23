/** Le document d'un coaching ne parle pas d'automatisation : ses besoins sont ceux de l'accompagnement. */
import { describe, expect, it } from "vitest";
import { documentDuCas, texteSource } from "../../../src/formats/cas-concret/document";
import { casCoaching } from "../x5/cas-coaching";
import stock from "../../../src/formats/cas-concret/stock-metiers/stock.json";
import type { CasConcret } from "../../../src/formats/cas-concret/cas";

const coachings: CasConcret[] = [casCoaching, ...(stock.cas as unknown as { cas: CasConcret }[]).map((l) => l.cas).filter((c) => c.offre === "coaching")];

describe("document d'un coaching", () => {
  it("couvre le cas d'essai et les 8 fiches du stock", () => {
    expect(coachings.length).toBe(9);
  });
  for (const cas of coachings) {
    it(`${cas.id} : aucun besoin d'automatisation, aucun mot interdit`, () => {
      const d = documentDuCas(cas);
      for (const b of d.miseEnPlace) expect(b).toBe("À définir ensemble");
      expect(texteSource(d)).not.toMatch(/automati|villeexemple|gain garanti/i);
    });
  }
});
