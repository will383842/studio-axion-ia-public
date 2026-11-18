import { describe, expect, it } from "vitest";
import { CONSIGNE_REGARD, coutPireRegardUsd, imagesPourClaude, roleRegard, schemaLectureRegard, variableRegard } from "../../../src/briques/regardeur";

describe("rôle du regardeur", () => {
  it("h) la partie variable et la consigne ne portent aucun texte attendu", () => {
    const permis = "Gagnez trois heures par semaine avec vos devis";
    const v = variableRegard([{ nom: "i01", instantSec: 0.5 }, { nom: "i02", instantSec: 65 }]);
    for (const m of permis.split(" ")) expect(v).not.toContain(m);
    expect(v).toContain("i02");
    expect(v).toContain("1:05");
    expect(CONSIGNE_REGARD).toContain("RECOPIES");
    expect(CONSIGNE_REGARD).not.toContain("script");
  });

  it("h) la simulation ne réussit jamais un regard", () => {
    const r = roleRegard.simuler({ contexte: {}, variable: variableRegard([{ nom: "i01", instantSec: 1 }, { nom: "i02", instantSec: 2 }]) });
    expect(r.images.map((i) => i.illisible)).toEqual([true, true]);
    expect(schemaLectureRegard.safeParse(r).success).toBe(true);
  });

  it("h) schéma strict", () => {
    expect(schemaLectureRegard.safeParse({ images: [], extra: 1 }).success).toBe(false);
    expect(schemaLectureRegard.safeParse({ images: [{ nom: "i01", textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false, avis: "ok" }] }).success).toBe(false);
  });

  it("légende = nom seul", () => {
    expect(imagesPourClaude([{ nom: "i01", type: "image/jpeg", base64: "AA" }])).toEqual([{ type: "image/jpeg", base64: "AA", legende: "i01" }]);
  });

  it("i) coût au pire, par le calcul commun", () => {
    const c24 = coutPireRegardUsd(24);
    const c6 = coutPireRegardUsd(6);
    expect(c24).toBeGreaterThanOrEqual(0.25);
    expect(c24).toBeLessThanOrEqual(0.32);
    expect(c6).toBeGreaterThanOrEqual(0.1);
    expect(c6).toBeLessThanOrEqual(0.18);
  });
});
