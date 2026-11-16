import { describe, expect, it } from "vitest";
import {
  TAILLE_MAX_FICHE_CARACTERES,
  type FicheSourceExtraits,
  type PlageExtrait,
} from "@/domaine/archive-extraits";

const plageBase = {
  id: "p1",
  debutSec: 0,
  finSec: 5,
  texte: "texte",
  motsCles: ["a"],
  avecVisage: false,
  texteIncruste: false,
  etat: "utilisable",
} satisfies PlageExtrait;

const ficheBase = {
  videoId: "v1",
  versionId: "ver1",
  sortieId: "s1",
  ratio: "9:16",
  licence: { type: "propriete", usageCommercial: true, reseaux: [] },
  famille: [],
  plages: [plageBase],
  rangee: true,
  sourcePreferee: true,
} satisfies FicheSourceExtraits;

describe("fiche source-extraits : champs facultatifs de la note (X4-08)", () => {
  it("une fiche du chantier 3 sans les nouveaux champs reste valide", () => {
    const f: FicheSourceExtraits = { ...ficheBase } satisfies FicheSourceExtraits;
    expect(f.plages[0].note).toBeUndefined();
    expect(f.ignores).toBeUndefined();
    expect(f.noteVersion).toBeUndefined();
    expect(f.attentePublication).toBeUndefined();
  });

  it("une fiche pleine (8 gardés + 12 peut-être de 30 mots) reste sous la taille max", () => {
    const mots = Array.from({ length: 30 }, (_, i) => `mot${i}`).join(" ");
    const plagePleine = (i: number): PlageExtrait => ({
      ...plageBase,
      id: `p${i}`,
      texte: mots,
      origine: "parole",
      note: 72,
      raisonsNote: [
        { code: "ecran", points: 20 },
        { code: "duree", points: 10 },
      ],
      sujet: "appels-offres",
      sujetCorrigeLe: "2026-11-16",
      usages: ["telephone", "ecran"],
    });
    const fiche: FicheSourceExtraits = {
      ...ficheBase,
      plages: Array.from({ length: 20 }, (_, i) => plagePleine(i)),
      ignores: { nombre: 10, raisonPrincipale: "trop-court" },
      rienARetenir: false,
      chiffresReels: true,
      noteVersion: "note-extraits/1",
      attentePublication: false,
    };
    expect(JSON.stringify(fiche).length).toBeLessThan(TAILLE_MAX_FICHE_CARACTERES);
  });
});
