import { describe, expect, it } from "vitest";
import { scriptFacultatif, titreDejaFilme } from "./facecam-script";

describe("scriptFacultatif", () => {
  it("vaut true pour facecam", () => {
    expect(scriptFacultatif("facecam")).toBe(true);
  });

  it("vaut true pour facecam-animee", () => {
    expect(scriptFacultatif("facecam-animee")).toBe(true);
  });

  it("vaut false pour un autre format", () => {
    expect(scriptFacultatif("avocat")).toBe(false);
  });
});

describe("titreDejaFilme", () => {
  it("renvoie le titre rogné quand le titre est renseigné", () => {
    expect(titreDejaFilme({ titre: "  Mon titre  ", sujet: "Sujet" })).toBe("Mon titre");
  });

  it("renvoie le sujet rogné quand le titre est vide", () => {
    expect(titreDejaFilme({ titre: "   ", sujet: "  Mon sujet  " })).toBe("Mon sujet");
  });

  it("renvoie undefined quand titre et sujet sont vides", () => {
    expect(titreDejaFilme({ titre: " ", sujet: "" })).toBeUndefined();
  });
});
