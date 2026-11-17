import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { POINTS_PAR_MONTRE } from "@/briques/note-extraits/bareme";
import {
  PHRASE_RAISON_NOTE, raisonEnClair, raisonsEnClair, pourquoiIgnores,
} from "@/briques/archive-extraits/raisons-note";

function codesDeNoter(): string[] {
  const src = readFileSync("src/briques/note-extraits/noter.ts", "utf8");
  const codes = new Set<string>();
  for (const ligne of src.split("\n")) {
    if (ligne.includes("ajoute(")) for (const m of ligne.matchAll(/"([a-z]+(?:-[a-z]+)*)"/g)) codes.add(m[1]);
    for (const m of ligne.matchAll(/code:\s*"([^"]+)"/g)) codes.add(m[1]);
  }
  return [...codes];
}

const TRI = ["chevauchement", "plafond", "peu-d-interet"];
// Motifs recopiés de tests/garde-ecran.test.ts
const INTERDITS = [
  /\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b/,
  /\b[A-Z]{2,5}-\d{1,3}\b/,
  /\(\s*[1-5]\d\d\s*\)|\bHTTP\b|\b(?:code|erreur|réponse|statut)\s*:?\s*[1-5]\d\d\b/i,
  /\bsimulations?\b/i,
  /\b(error|errors|failed|timeout|token|api key|undefined|null)\b/i,
];

describe("raisons de la note en clair", () => {
  it("chaque code du barème, de noter et du tri a une phrase", () => {
    const codes = [...Object.keys(POINTS_PAR_MONTRE), ...codesDeNoter(), ...TRI];
    expect(codes.length).toBeGreaterThan(15);
    for (const c of codes) expect(PHRASE_RAISON_NOTE[c], c).toBeTruthy();
  });
  it("aucune phrase n'a la forme d'un code ni ne tombe sous les motifs de garde-écran", () => {
    for (const [code, phrase] of Object.entries(PHRASE_RAISON_NOTE)) {
      expect(phrase).not.toBe(code);
      expect(phrase).not.toMatch(/^[a-z]+(-[a-z]+)*$/);
      for (const m of INTERDITS) expect(phrase).not.toMatch(m);
    }
  });
  it("code inconnu : « autre raison »", () => {
    expect(raisonEnClair("zzz-inconnu")).toBe("autre raison");
    expect(raisonEnClair("constructor")).toBe("autre raison");
    expect(raisonEnClair("fait")).toBe("contient un fait précis");
  });
  it("raisonsEnClair : ordonné, déterministe, entrée non modifiée", () => {
    const entree = Object.freeze([
      Object.freeze({ code: "duree", points: 10 }),
      Object.freeze({ code: "phrase-creuse", points: -20 }),
      Object.freeze({ code: "fait", points: 10 }),
      Object.freeze({ code: "interface", points: 35 }),
    ]);
    const sortie = raisonsEnClair(entree);
    expect(sortie).toEqual([
      { phrase: "montre un écran d'outil", sens: "plus" },
      { phrase: "phrase d'ouverture ou de fin", sens: "moins" },
      { phrase: "bonne durée (3 à 6 s)", sens: "plus" },
      { phrase: "contient un fait précis", sens: "plus" },
    ]);
    expect(raisonsEnClair(entree)).toEqual(sortie);
    expect(entree.map((r) => r.code)).toEqual(["duree", "phrase-creuse", "fait", "interface"]);
  });
  it("pourquoiIgnores", () => {
    expect(pourquoiIgnores(undefined)).toBeNull();
    expect(pourquoiIgnores({ nombre: 0, raisonPrincipale: "fait" })).toBeNull();
    expect(pourquoiIgnores({ nombre: 1, raisonPrincipale: null })).toBe("1 passage ignoré");
    expect(pourquoiIgnores({ nombre: 3, raisonPrincipale: "phrase-creuse" })).toBe(
      "3 passages ignorés, surtout : phrase d'ouverture ou de fin",
    );
  });
});
