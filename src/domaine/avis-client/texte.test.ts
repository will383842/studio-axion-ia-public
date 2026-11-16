import { describe, it, expect } from "vitest";
import { couperAvis, empreinteAvis, texteFidele } from "./texte";
import type { AvisClient } from "./types";

const avis: AvisClient = {
  id: "a1", auteur: "Marie", date: "2026-05-01", source: "direct", note: 4,
  texte: "Équipe à l'écoute, vidéo livrée en temps et en heure.", statut: "published",
  accordAuteur: { ecrit: true, date: "2026-05-02", forme: "courriel" }, valideLe: "2026-05-03",
};

describe("couperAvis", () => {
  it("texte court inchangé", () => {
    expect(couperAvis("Bien", 20)).toBe("Bien");
  });
  it("coupe = morceau contigu avec …", () => {
    const c = couperAvis(avis.texte, 20);
    expect(c.length).toBeLessThanOrEqual(21);
    expect(c.endsWith("…")).toBe(true);
    expect(avis.texte.includes(c.replace(/…/g, "").trim())).toBe(true);
    expect(texteFidele(avis.texte, c)).toBe(true);
  });
});
describe("texteFidele", () => {
  it("égal", () => expect(texteFidele("abc", "abc")).toBe(true));
  it("une lettre changée refusée", () => {
    expect(texteFidele(avis.texte, avis.texte.replace("écoute", "ecoute"))).toBe(false);
    expect(texteFidele(avis.texte, "Équipe à l'écoute, vidéo livrée en temps et en heurs.")).toBe(false);
  });
  it("coupe non contiguë refusée", () => {
    expect(texteFidele("un deux trois", "un … trois")).toBe(false);
  });
  it("coupe en début et fin acceptée", () => {
    expect(texteFidele("un deux trois", "… deux …")).toBe(true);
  });
});
describe("empreinteAvis", () => {
  it("stable, hex 64", () => {
    expect(empreinteAvis(avis)).toBe(empreinteAvis({ ...avis }));
    expect(empreinteAvis(avis)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("sensible à une lettre, à la note, à la date", () => {
    const e = empreinteAvis(avis);
    expect(empreinteAvis({ ...avis, texte: avis.texte.replace("é", "e") })).not.toBe(e);
    expect(empreinteAvis({ ...avis, note: 5 })).not.toBe(e);
    expect(empreinteAvis({ ...avis, date: "2026-05-02" })).not.toBe(e);
  });
});
