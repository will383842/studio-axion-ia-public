import { describe, expect, it } from "vitest";
import {
  estFormatSortie,
  estSortie,
  IDS_SORTIES,
  reseauxServis,
  verticauxSepares,
  type IdSortie,
} from "../../src/moteurs/montage-tableau/formats-sortie";

describe("estFormatSortie", () => {
  it("accepte exactement les 4 formats d'image", () => {
    for (const id of ["vertical", "portrait", "carre", "horizontal"]) expect(estFormatSortie(id)).toBe(true);
  });
  it("refuse les sorties qui ne sont pas des formats, la casse, les espaces et le vide", () => {
    expect(estFormatSortie("vertical-liens")).toBe(false);
    expect(estFormatSortie("portrait-linkedin")).toBe(false);
    expect(estFormatSortie("Vertical")).toBe(false);
    expect(estFormatSortie(" vertical")).toBe(false);
    expect(estFormatSortie("")).toBe(false);
  });
});

describe("reseauxServis", () => {
  it("donne les libellés des réseaux du format, dans l'ordre de la table, séparés par « , »", () => {
    expect(reseauxServis("vertical")).toBe("TikTok, Reels Instagram, Reels Facebook, YouTube Shorts, Stories Instagram et Facebook");
    expect(reseauxServis("portrait")).toBe("Fil Instagram, Fil Facebook");
    expect(reseauxServis("carre")).toBe("LinkedIn, Fil Facebook");
  });
  it("un seul réseau : pas de séparateur", () => {
    expect(reseauxServis("horizontal")).toBe("YouTube");
  });
  it("un identifiant inconnu lève une erreur claire", () => {
    expect(() => reseauxServis("inconnu" as never)).toThrow(/Format de sortie inconnu/);
  });
});

describe("estSortie", () => {
  it("accepte les 6 sorties connues, dont le vertical « liens » et le portrait de LinkedIn", () => {
    for (const id of ["vertical", "vertical-liens", "portrait", "portrait-linkedin", "carre", "horizontal"]) {
      expect(estSortie(id)).toBe(true);
    }
    expect(IDS_SORTIES).toHaveLength(6);
  });
  it("refuse l'inconnu, la casse et le vide", () => {
    expect(estSortie("story")).toBe(false);
    expect(estSortie("Carre")).toBe(false);
    expect(estSortie("")).toBe(false);
  });
});

describe("verticauxSepares", () => {
  it("vrai seulement si le vertical ET le vertical « liens » sont tous deux présents, quel que soit l'ordre", () => {
    expect(verticauxSepares(["vertical", "vertical-liens"])).toBe(true);
    expect(verticauxSepares(["portrait", "vertical-liens", "horizontal", "vertical"])).toBe(true);
  });
  it("faux pour l'un sans l'autre, pour d'autres sorties et pour la liste vide", () => {
    expect(verticauxSepares(["vertical"])).toBe(false);
    expect(verticauxSepares(["vertical-liens"])).toBe(false);
    expect(verticauxSepares(["portrait", "carre"])).toBe(false);
    expect(verticauxSepares([])).toBe(false);
  });
  it("ne modifie pas la liste reçue", () => {
    const entree: IdSortie[] = ["vertical-liens", "vertical", "carre"];
    const copie = [...entree];
    verticauxSepares(entree);
    expect(entree).toEqual(copie);
  });
});
