import { describe, expect, it } from "vitest";
import { lireReglagesYoutube, PROPOSITION_YOUTUBE, titreYoutubeDepuisStudio, youtubeActifBrut } from "@/fournisseurs/publication/zernio-youtube";

describe("b2 · lecture des réglages YouTube", () => {
  it("la proposition lue est rendue égale", () => {
    expect(lireReglagesYoutube({ ...PROPOSITION_YOUTUBE })).toEqual(PROPOSITION_YOUTUBE);
    expect(PROPOSITION_YOUTUBE).toEqual({ visibilite: "public", categorieId: "27", synthetique: "oui", pourEnfants: false, titre: "studio" });
  });
  it("absent, null, chaîne, tableau, nombre : null", () => {
    for (const v of [undefined, null, "x", [], [PROPOSITION_YOUTUBE], 3, true]) expect(lireReglagesYoutube(v)).toBeNull();
    expect(lireReglagesYoutube({})).toBeNull();
  });
  it("chaque champ manquant : null (jamais complété par la proposition)", () => {
    for (const cle of Object.keys(PROPOSITION_YOUTUBE)) {
      const o: Record<string, unknown> = { ...PROPOSITION_YOUTUBE };
      delete o[cle];
      expect(lireReglagesYoutube(o), cle).toBeNull();
    }
  });
  it("chaque champ faux : null", () => {
    const faux: Record<string, unknown>[] = [
      { visibilite: "PUBLIC" }, { visibilite: "prive" }, { categorieId: 27 }, { categorieId: "abc" }, { categorieId: "1234" }, { categorieId: "" },
      { pourEnfants: "false" }, { pourEnfants: 0 }, { synthetique: true }, { synthetique: "peut-etre" }, { titre: "kit" },
    ];
    for (const f of faux) expect(lireReglagesYoutube({ ...PROPOSITION_YOUTUBE, ...f }), JSON.stringify(f)).toBeNull();
  });
  it("valeurs permises : toutes les énumérations", () => {
    for (const visibilite of ["public", "unlisted", "private"]) for (const synthetique of ["oui", "non", "selon-la-video"]) for (const titre of ["studio", "premiere-ligne"]) {
      expect(lireReglagesYoutube({ ...PROPOSITION_YOUTUBE, visibilite, synthetique, titre, categorieId: "1", pourEnfants: true })).toEqual({ visibilite, synthetique, titre, categorieId: "1", pourEnfants: true });
    }
  });
  it("clé en trop ignorée", () => {
    const r = lireReglagesYoutube({ ...PROPOSITION_YOUTUBE, extra: 1 });
    expect(r).toEqual(PROPOSITION_YOUTUBE);
    expect(r).not.toHaveProperty("extra");
  });
  it("titreYoutubeDepuisStudio : espaces, lignes vides en tête, plafond, rien", () => {
    expect(titreYoutubeDepuisStudio("  Un   titre \n deux ", "x")).toBe("Un titre deux");
    expect(titreYoutubeDepuisStudio(undefined, "\n\n   \n Première   ligne \nDeuxième")).toBe("Première ligne");
    expect(titreYoutubeDepuisStudio("   ", "Texte")).toBe("Texte");
    expect(titreYoutubeDepuisStudio(undefined, "b".repeat(100))).toBe("b".repeat(100));
    expect(titreYoutubeDepuisStudio(undefined, "b".repeat(101))).toBe(`${"b".repeat(99)}…`);
    expect(titreYoutubeDepuisStudio(undefined, " \n ")).toBe("");
  });
  it("youtubeActifBrut : seul le booléen true", () => {
    expect(youtubeActifBrut(true)).toBe(true);
    for (const v of [false, "true", 1, null, undefined, {}, [], "oui"]) expect(youtubeActifBrut(v)).toBe(false);
  });
});
