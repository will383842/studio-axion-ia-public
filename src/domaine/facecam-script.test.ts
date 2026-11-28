import { describe, expect, it } from "vitest";
import { scriptFacultatif, titreDejaFilme } from "./facecam-script";

describe("scriptFacultatif", () => {
  it("vaut true pour facecam et facecam-animee", () => {
    expect(scriptFacultatif("facecam")).toBe(true);
    expect(scriptFacultatif("facecam-animee")).toBe(true);
  });

  it("vaut false pour tout autre format", () => {
    expect(scriptFacultatif("avocat")).toBe(false);
    expect(scriptFacultatif("tableau")).toBe(false);
    expect(scriptFacultatif("")).toBe(false);
    expect(scriptFacultatif("Facecam")).toBe(false);
  });
});

describe("titreDejaFilme", () => {
  it("renvoie le titre rogné quand il existe", () => {
    expect(titreDejaFilme({ titre: "  Mon titre  ", sujet: "Mon sujet" })).toBe("Mon titre");
  });

  it("se replie sur le sujet rogné quand le titre est vide ou d'espaces", () => {
    expect(titreDejaFilme({ titre: "", sujet: "  Mon sujet " })).toBe("Mon sujet");
    expect(titreDejaFilme({ titre: "   ", sujet: "Mon sujet" })).toBe("Mon sujet");
  });

  it("renvoie undefined quand le titre et le sujet sont vides", () => {
    expect(titreDejaFilme({ titre: "", sujet: "" })).toBeUndefined();
    expect(titreDejaFilme({ titre: "  ", sujet: "  " })).toBeUndefined();
  });
});
