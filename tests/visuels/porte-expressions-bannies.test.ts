import { describe, expect, it } from "vitest";
import { controlerCarrousel } from "../../src/domaine/controles-visuel/porte.js";
import type { ContextePorte } from "../../src/domaine/visuels/contrats.js";

const ctx: ContextePorte = { interditsDans: () => [], faitsDisponibles: false };
const specAvec = (message: string) => ({
  version: "carrousel/1",
  alt: "Carrousel d’exemple sur l’organisation",
  pages: [
    { type: "T01", titre: "Mieux organiser sa semaine", sousTitre: "Des gestes simples pour souffler" },
    { type: "T10", message },
    { type: "T21" },
  ],
});
const codes = (message: string) => [...new Set(controlerCarrousel(specAvec(message), ctx).rapport.controles.map((x) => x.code))].filter((c) => c !== "PAGES" && c !== "VARIETE").sort();

describe("expressions bannies : « J'aide », « Grenoble », « Aucun gain garanti »", () => {
  it.each(["J'aide les équipes", "J’aide les équipes", "j’AIDE les équipes"])("« %s » est refusé", (t) => expect(codes(t)).toEqual(["J_AIDE"]));
  it.each(["Des équipes à Grenoble", "GRENOBLE et alentours", "Basé près de grenoble"])("« %s » est refusé", (t) => expect(codes(t)).toEqual(["EXPRESSION_BANNIE"]));
  it.each(["Aucun gain garanti", "aucun gain garanti ici", "AUCUN GAIN GARANTI", "Aucun  gain   garanti", "Aucun gaïn garantí"])("« %s » est refusé", (t) =>
    expect(codes(t)).toEqual(["EXPRESSION_BANNIE"]));
  it.each(["Grenoblois", "Une équipe grenobloise", "Les grenobloises", "Gre\u00ADnoble", "Grenoble-Alpes", "à\u00A0Grenoble", "GRENOBLE."])("« %s » est refusé (variante lieu)", (t) =>
    expect(codes(t)).toEqual(["EXPRESSION_BANNIE"]));
  it.each(["Aucun gain n'est garanti", "Aucun gain n’est garanti", "Aucuns gains garantis", "Aucun gain ne sont garantis"])("« %s » est refusé (variante gain)", (t) =>
    expect(codes(t)).toEqual(["EXPRESSION_BANNIE"]));
  it("un espace de largeur nulle est refusé aussi", () => expect(codes("Aucun gain\u200B garanti")).toContain("EXPRESSION_BANNIE"));
  it.each(["Une génération curieuse", "Le grenier est rangé", "Le grenadier fleurit", "Un gain garanti par contrat"])("« %s » reste accepté", (t) => expect(codes(t)).toEqual([]));
  it("un texte voisin reste accepté", () => expect(codes("Un gain peut venir avec le temps")).toEqual([]));
});
