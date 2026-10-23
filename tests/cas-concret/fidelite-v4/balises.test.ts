/**
 * V4-1, mission B : la règle d'accent de la v4 (`v4.html`, « *mot* = mot en orange ») colore TOUT mot qui porte une
 * balise, même au milieu (« L'*annonce* », « L'*inscription* ») : la v4 écrit ces titres entièrement en orange.
 * Rouge avant la correction de `motsBalises`. Les formes déjà permises gardent leur lecture.
 */
import { describe, expect, it } from "vitest";
import { motsBalises } from "@/briques/ecrans-motion";

describe("balises d'accent (règle de la v4)", () => {
  it("un mot balisé au milieu prend l'accent en entier", () => {
    expect(motsBalises("L'*annonce*")).toEqual([{ mot: "L'annonce", accent: true }]);
    expect(motsBalises("Étape L'*inscription* ici")).toEqual([
      { mot: "Étape", accent: false },
      { mot: "L'inscription", accent: true },
      { mot: "ici", accent: false },
    ]);
  });

  it("les formes d'avant ne changent pas", () => {
    expect(motsBalises("Le *rendez-vous*")).toEqual([{ mot: "Le", accent: false }, { mot: "rendez-vous", accent: true }]);
    expect(motsBalises("Réservez votre *diagnostic gratuit* vite")).toEqual([
      { mot: "Réservez", accent: false },
      { mot: "votre", accent: false },
      { mot: "diagnostic", accent: true },
      { mot: "gratuit", accent: true },
      { mot: "vite", accent: false },
    ]);
    expect(motsBalises("Elle *oublie ?*")).toEqual([{ mot: "Elle", accent: false }, { mot: "oublie", accent: true }, { mot: "?", accent: true }]);
    expect(motsBalises("sans balise")).toEqual([{ mot: "sans", accent: false }, { mot: "balise", accent: false }]);
    // Une fermeture égarée n'ouvre pas d'accent.
    expect(motsBalises("fin* suite")).toEqual([{ mot: "fin", accent: false }, { mot: "suite", accent: false }]);
  });
});
