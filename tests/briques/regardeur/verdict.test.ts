import { describe, expect, it } from "vitest";
import { jugerRegard } from "../../../src/briques/regardeur";
import type { ImageLue, InstantRegard } from "../../../src/briques/regardeur";

const inst = (nom: string, sorte: InstantRegard["sorte"], over: Partial<InstantRegard> = {}): InstantRegard => ({
  nom, instantSec: Number(nom.slice(1)), partieId: sorte === "partie" ? `p${nom.slice(1)}` : null, sorte, legende: "", texteAttendu: false, motsDits: [], ...over,
});
const img = (nom: string, over: Partial<ImageLue> = {}): ImageLue => ({ nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false, ...over });
const t = (texte: string, over = {}) => ({ texte, coupe: false, horsCadre: false, ...over });
const PERMIS = ["Un outil pour les devis. Un autre pour les e-mails."];

describe("jugerRegard", () => {
  it("a) phrase non choisie décidée par le code", () => {
    const i = [inst("i01", "partie")];
    expect(jugerRegard({ instants: i, lecture: { images: [img("i01", { textes: [t("Un autre pour les e-mails")] })] }, textesPermis: PERMIS }).defauts).toEqual([]);
    const v = jugerRegard({ instants: i, lecture: { images: [img("i01", { textes: [t("Gagnez 3 heures par semaine")] })] }, textesPermis: PERMIS });
    expect(v.defauts.map((d) => d.code)).toEqual(["phrase-non-choisie"]);
    expect(v.defauts[0]!.detail).toContain("Gagnez 3 heures par semaine");
    // mélange de deux phrases permises : faux à l'écran
    for (const texte of ["Un outil pour les e-mails"]) {
      const m = jugerRegard({ instants: i, lecture: { images: [img("i01", { textes: [t(texte)] })] }, textesPermis: PERMIS });
      expect(m.defauts.map((d) => d.code)).toEqual(["phrase-non-choisie"]);
    }
    // aucun mot de 4 lettres et plus : seule la sous-chaîne permise compte
    for (const texte of ["on a dit non", "il y a un an"]) {
      const c = jugerRegard({ instants: i, lecture: { images: [img("i01", { textes: [t(texte)] })] }, textesPermis: PERMIS });
      expect(c.defauts.map((d) => d.code)).toEqual(["phrase-non-choisie"]);
    }
  });

  it("b) fin choisie", () => {
    const instants = [inst("i01", "partie"), inst("i02", "fin")];
    const fin = { texte: "Écrivez PLAN en commentaire", motCle: "PLAN" };
    const l = (s: string) => ({ images: [img("i01"), img("i02", { textes: [t(s)] })] });
    const permis = [...PERMIS, "À retenir"];
    expect(jugerRegard({ instants, lecture: l("Écrivez plan en commentaire"), textesPermis: permis, fin }).defauts.map((d) => d.code)).not.toContain("fin-absente");
    const v = jugerRegard({ instants, lecture: l("À retenir"), textesPermis: permis, fin });
    expect(v.defauts.filter((d) => d.code === "fin-absente")).toHaveLength(1);
    expect(jugerRegard({ instants, lecture: l("À retenir"), textesPermis: permis }).defauts.map((d) => d.code)).not.toContain("fin-absente");
  });

  it("c) page vide seulement si du texte est attendu", () => {
    const lecture = { images: [img("i01")] };
    expect(jugerRegard({ instants: [inst("i01", "partie", { texteAttendu: true })], lecture, textesPermis: [] }).defauts.map((d) => d.code)).toEqual(["page-vide"]);
    expect(jugerRegard({ instants: [inst("i01", "partie")], lecture, textesPermis: [] }).defauts).toEqual([]);
  });

  it("d) texte coupé : un défaut, pas de phrase non choisie, partie fautive", () => {
    const v = jugerRegard({ instants: [inst("i01", "partie")], lecture: { images: [img("i01", { textes: [t("Un outil pour les dev", { coupe: true })] })] }, textesPermis: PERMIS });
    expect(v.defauts.map((d) => d.code)).toEqual(["texte-coupe"]);
    expect(v.defauts[0]!.bloquantSiSur).toBe(true);
    expect(v.partiesFautives).toEqual(["p01"]);
  });

  it("e) désynchro sous-titre / voix", () => {
    const lecture = { images: [img("i01", { sousTitre: "pour les relances" })] };
    const go = (motsDits: string[]) => jugerRegard({ instants: [inst("i01", "partie", { motsDits })], lecture, textesPermis: [] }).defauts.map((d) => d.code);
    expect(go(["un", "troisieme", "pour", "les", "relances"])).toEqual([]);
    expect(go(["bonjour", "a", "tous"])).toEqual(["desynchro"]);
  });

  it("f) lecture nulle ou malformée : jamais d'exception", () => {
    const instants = [inst("i01", "debut"), inst("i02", "partie")];
    const v = jugerRegard({ instants, lecture: null, textesPermis: [] });
    expect(v.defauts.map((d) => d.code)).toEqual(["non-relue", "non-relue"]);
    expect(v.partiesFautives).toEqual([]);
    expect(v.nonRelues).toBe(2);
    expect(() => jugerRegard({ instants, lecture: { images: 5 } as never, textesPermis: [] })).not.toThrow();
  });

  it("noire et illisible : rien d'autre n'est jugé", () => {
    const v = jugerRegard({ instants: [inst("i01", "partie", { texteAttendu: true }), inst("i02", "partie", { texteAttendu: true })], lecture: { images: [img("i01", { noire: true }), img("i02", { illisible: true })] }, textesPermis: [] });
    expect(v.defauts.map((d) => d.code)).toEqual(["noire", "illisible"]);
  });
});
