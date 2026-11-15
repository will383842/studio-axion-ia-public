import { describe, it, expect } from "vitest";
import { avisAffichables } from "./garde";
import type { AvisClient } from "./types";

function avis(o: Partial<AvisClient> = {}): AvisClient {
  return {
    id: "a1", auteur: "Marie", date: "2026-05-01", source: "google", note: 5,
    texte: "Très bien.", statut: "published",
    accordAuteur: { ecrit: true, date: "2026-05-02", forme: "courriel" },
    valideLe: "2026-05-03", ...o,
  };
}

describe("avisAffichables", () => {
  it("liste vide → rien", () => {
    expect(avisAffichables([])).toEqual({ gardes: [], refus: [] });
  });
  it("garde un avis valide", () => {
    expect(avisAffichables([avis()]).gardes).toHaveLength(1);
  });
  it.each([
    ["hidden", { statut: "hidden" }],
    ["draft", { statut: "draft" }],
    ["sans accord", { accordAuteur: { ecrit: false, date: "2026-05-02", forme: "oral" } }],
    ["texte vide", { texte: "" }],
    ["texte espaces", { texte: "   \n " }],
    ["note 0", { note: 0 }],
    ["note 6", { note: 6 }],
    ["note 4,5", { note: 4.5 }],
    ["date invalide", { date: "pas-une-date" }],
    ["exemple", { exemple: true as const }],
  ])("refuse : %s", (_n, o) => {
    const r = avisAffichables([avis(o as Partial<AvisClient>)]);
    expect(r.gardes).toEqual([]);
    expect(r.refus).toHaveLength(1);
    expect(r.refus[0].id).toBe("a1");
    expect(r.refus[0].motif.length).toBeGreaterThan(3);
  });
  it("garde un avis à 2 étoiles (pas de tri par note)", () => {
    expect(avisAffichables([avis({ note: 2 })]).gardes).toHaveLength(1);
  });
  it("conserve l'ordre d'entrée", () => {
    const l = [avis({ id: "c", note: 5 }), avis({ id: "a", note: 1 }), avis({ id: "b", note: 3 })];
    expect(avisAffichables(l).gardes.map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
});
