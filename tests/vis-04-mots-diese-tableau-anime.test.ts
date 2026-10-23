import { describe, expect, it } from "vitest";
import { motsDiesePour } from "@/domaine/textes-publication";

describe("VIS-04 : mots-dièse du format tableau-anime", () => {
  it("a sa propre entrée, différente de celle par défaut", () => {
    const tableau = motsDiesePour("tableau-anime", "linkedin", 10);
    expect(tableau).toEqual(["#IA", "#PME", "#Automatisation", "#Entreprise", "#AxionIA"]);
    expect(tableau).not.toEqual(motsDiesePour(undefined, "linkedin", 10));
  });

  it("reste sobre : en français, sans lieu ni promesse de gain", () => {
    const tags = motsDiesePour("tableau-anime", "tiktok", 10).join(" ").toLowerCase();
    expect(tags).not.toMatch(/villeexemple|gagn|viral|vues|argent|roi|garanti/);
  });

  it("respecte le nombre demandé et l'ajout #Shorts", () => {
    expect(motsDiesePour("tableau-anime", "linkedin", 2)).toHaveLength(2);
    expect(motsDiesePour("tableau-anime", "youtube-shorts", 10)[0]).toBe("#Shorts");
  });

  it("ne change pas avocat ni le défaut", () => {
    expect(motsDiesePour("avocat", "linkedin", 10)).toEqual(["#PME", "#IA", "#Automatisation", "#Dirigeant", "#AxionIA"]);
    expect(motsDiesePour("inconnu", "linkedin", 10)).toEqual(["#IA", "#PME", "#Entreprise", "#Productivité", "#AxionIA"]);
  });
});
