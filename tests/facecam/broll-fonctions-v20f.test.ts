/**
 * T-BROLL-FACECAM-v20f · tests directs du choix des images d'illustration (b-roll) :
 * motifs de refus, ordre des candidats acceptés, bornes de durée. Entrées construites à la main.
 */
import { describe, expect, it } from "vitest";
import { brollAcceptes, dureeBroll, refusBroll, type CandidatBroll } from "@/briques/habillage-facecam/broll";

describe("refusBroll", () => {
  it("accepte une image sans signal d'analyse (null)", () => {
    expect(refusBroll({ id: "a" })).toBeNull();
  });
  it("accepte quand tous les signaux sont explicitement faux", () => {
    expect(refusBroll({ id: "a", filigrane: false, texteAnglais: false, regardCamera: false })).toBeNull();
  });
  it("refuse le filigrane", () => {
    expect(refusBroll({ id: "a", filigrane: true })).toBe("filigrane");
  });
  it("refuse le texte en anglais", () => {
    expect(refusBroll({ id: "a", texteAnglais: true })).toBe("texte en anglais");
  });
  it("refuse le regard caméra", () => {
    expect(refusBroll({ id: "a", regardCamera: true })).toBe("regard caméra");
  });
  it("garde la priorité filigrane > texte en anglais > regard caméra", () => {
    expect(refusBroll({ id: "a", filigrane: true, texteAnglais: true, regardCamera: true })).toBe("filigrane");
    expect(refusBroll({ id: "a", texteAnglais: true, regardCamera: true })).toBe("texte en anglais");
  });
});

describe("brollAcceptes", () => {
  it("retourne une liste vide pour une liste vide", () => {
    expect(brollAcceptes([])).toEqual([]);
  });
  it("écarte les refusés et ordonne : Mes images, Pexels, Pixabay, capture du site", () => {
    const entree: CandidatBroll[] = [
      { id: "cap", origine: "capture-site" },
      { id: "pix", origine: "pixabay" },
      { id: "filig", origine: "mes-images", filigrane: true },
      { id: "pex", origine: "pexels" },
      { id: "moi", origine: "mes-images" },
      { id: "cam", origine: "pexels", regardCamera: true },
    ];
    expect(brollAcceptes(entree).map((c) => c.id)).toEqual(["moi", "pex", "pix", "cap"]);
  });
  it("place les origines inconnues ou absentes après les quatre connues, en gardant l'ordre d'entrée", () => {
    const entree: CandidatBroll[] = [
      { id: "x1", origine: "autre" },
      { id: "x2" },
      { id: "cap", origine: "capture-site" },
      { id: "moi", origine: "mes-images" },
    ];
    expect(brollAcceptes(entree).map((c) => c.id)).toEqual(["moi", "cap", "x1", "x2"]);
  });
  it("garde l'ordre d'entrée à origine égale (tri stable)", () => {
    const entree: CandidatBroll[] = [
      { id: "p2", origine: "pexels" },
      { id: "p1", origine: "pexels" },
    ];
    expect(brollAcceptes(entree).map((c) => c.id)).toEqual(["p2", "p1"]);
  });
  it("garde le type des objets reçus (champs en plus conservés, mêmes références)", () => {
    const a = { id: "a", origine: "pexels", auteur: "Léa" };
    const res = brollAcceptes([a]);
    expect(res).toHaveLength(1);
    expect(res[0]).toBe(a);
    expect(res[0].auteur).toBe("Léa");
  });
  it("ne modifie pas le tableau d'entrée", () => {
    const entree: CandidatBroll[] = [
      { id: "cap", origine: "capture-site" },
      { id: "moi", origine: "mes-images" },
    ];
    brollAcceptes(entree);
    expect(entree.map((c) => c.id)).toEqual(["cap", "moi"]);
  });
});

describe("dureeBroll", () => {
  it("monte à 1,2 s pour 0, un espace négatif ou très court", () => {
    expect(dureeBroll(0)).toBe(1.2);
    expect(dureeBroll(-3)).toBe(1.2);
    expect(dureeBroll(0.5)).toBe(1.2);
  });
  it("garde les bornes exactes 1,2 et 2,5", () => {
    expect(dureeBroll(1.2)).toBe(1.2);
    expect(dureeBroll(2.5)).toBe(2.5);
  });
  it("plafonne à 2,5 s pour un espace long ou très long", () => {
    expect(dureeBroll(2.6)).toBe(2.5);
    expect(dureeBroll(600)).toBe(2.5);
    expect(dureeBroll(Number.POSITIVE_INFINITY)).toBe(2.5);
  });
  it("garde l'espace tel quel entre les bornes, arrondi à 3 décimales", () => {
    expect(dureeBroll(1.8)).toBe(1.8);
    expect(dureeBroll(1.23456)).toBe(1.235);
    expect(dureeBroll(2.4999)).toBe(2.5);
  });
});
