import { describe, expect, it } from "vitest";
import { codesLeves, controlerVersion, GARDE_FOUS, LEVIERS, NIVEAUX, noterVersion, voyant, type EntreeControle } from "@/domaine/controles-script";
import type { Ciblage } from "@/domaine/ciblage/types";
import { seg } from "../helpers/g3";
import { versionV4 } from "../helpers/v4";

const avec = (ciblage: Ciblage | undefined, accroche: string) => (e: EntreeControle) => {
  e.ouverture[0].segments[0] = { ...e.ouverture[0].segments[0], texte: accroche };
  if (e.maitre) e.maitre = { ...e.maitre, brief: { ...e.maitre.brief, ciblage } };
};
const cible = (niveau: Ciblage["niveau"], libelle: string): Ciblage => ({ niveau, libelle, origine: "saisie" });
const leve = (c: Ciblage | undefined, accroche: string) => codesLeves(controlerVersion(versionV4("machine", avec(c, accroche))));

describe("notation : leviers", () => {
  it("la somme des leviers vaut 100", () => {
    expect(LEVIERS.reduce((s, l) => s + l.points, 0)).toBe(100);
  });
  it("levier Ciblage = 8 points avec C100, C101, C102 et RESSEMBLANCE", () => {
    const l = LEVIERS.find((x) => x.id === "ciblage");
    expect(l?.points).toBe(8);
    expect(l?.controles).toEqual(["C100", "C101", "C102", "RESSEMBLANCE"]);
  });
  it("poids rééquilibrés", () => {
    const p = (id: string) => LEVIERS.find((x) => x.id === id)?.points;
    expect([p("accroche"), p("mot-cle"), p("oralite"), p("ton")]).toEqual([17, 6, 7, 2]);
  });
  it("jamais bloquant, jamais garde-fou", () => {
    for (const c of ["C100", "C101", "C102"]) {
      expect(NIVEAUX[c].machine).not.toBe("bloquant");
      expect(NIVEAUX[c].will).not.toBe("bloquant");
      expect(GARDE_FOUS).not.toContain(c);
    }
    expect(NIVEAUX.C100).toEqual({ machine: "alerte", will: "info" });
    expect(NIVEAUX.C102).toEqual({ machine: "info", will: "info" });
  });
  it("C3 et C63 restent dans « Appel » sans doublon", () => {
    const appel = LEVIERS.find((x) => x.id === "appel")!.controles;
    expect(appel).toContain("C3");
    expect(appel).toContain("C63");
    expect(LEVIERS.find((x) => x.id === "ciblage")!.controles).not.toContain("C3");
  });
});

describe("C100 : la cible déclarée est nommée dans les 5 premières secondes", () => {
  it("accroche sans le métier déclaré : C100", () => {
    expect(leve(cible("metier", "plombier"), "On recrute nos collaborateurs en quinze minutes.")).toContain("C100");
  });
  it("accroche avec le métier : pas de C100", () => {
    expect(leve(cible("metier", "plombier"), "Plombier, vous perdez une heure par devis.")).not.toContain("C100");
  });
  it("pluriel, singulier, élision, synonymes de taille : aucune fausse alerte", () => {
    expect(leve(cible("metier", "plombier"), "Les plombiers perdent une heure par devis.")).not.toContain("C100");
    expect(leve(cible("metier", "agence immobilière"), "Dans votre agence immobilière, un devis dort.")).not.toContain("C100");
    expect(leve(cible("metier", "électricien"), "Chez l'électricien, un devis dort.")).not.toContain("C100");
    expect(leve(cible("taille", "TPE (moins de 10 salariés)"), "Dans une très petite entreprise, un devis dort.")).not.toContain("C100");
    expect(leve(cible("taille", "PME (10 à 249 salariés)"), "Dans une PME, un devis dort.")).not.toContain("C100");
  });
  it("le nom de la cible après les 5 premières secondes ne compte pas", () => {
    const long = "On recrute nos collaborateurs en quinze minutes, c'est un fait connu de tous les jours, plombier.";
    expect(leve(cible("metier", "plombier"), long)).toContain("C100");
  });
  it("sans cible déclarée : C102 (information), pas de C100", () => {
    const r = leve(undefined, "On recrute nos collaborateurs en quinze minutes.");
    expect(r).toContain("C102");
    expect(r).not.toContain("C100");
  });
  it("cible au libellé vide : C102 (information), pas de C100", () => {
    const r = leve(cible("metier", "   "), "On recrute nos collaborateurs en quinze minutes.");
    expect(r).toContain("C102");
    expect(r).not.toContain("C100");
  });
  it("cible déclarée : pas de C102", () => {
    expect(leve(cible("metier", "plombier"), "Plombier, un devis dort.")).not.toContain("C102");
  });
  it("C100 retire des points au levier Ciblage mais ne bloque pas", () => {
    const r = controlerVersion(versionV4("machine", avec(cible("metier", "plombier"), "On recrute nos collaborateurs en quinze minutes.")));
    const v = r.violations.find((x) => x.controle === "C100");
    expect(v?.bloquant).toBe(false);
    expect(noterVersion(r.violations).criteres.ciblage).toBeLessThan(8);
    expect(noterVersion(r.violations).gardeFous.echecs).not.toContain("C100");
  });
});

describe("C101 : bénéfice clair", () => {
  it("un texte sans gain concret lève C101 ; la v4 (heures gagnées) non", () => {
    expect(leve(undefined, "On recrute nos collaborateurs en quinze minutes.")).not.toContain("C101");
    const vide = versionV4("machine", (e) => {
      for (const b of [...e.ouverture, ...e.corps, ...e.fin]) b.segments = b.segments.map((s) => ({ ...s, texte: "Voici une chose." }));
    });
    expect(codesLeves(controlerVersion(vide))).toContain("C101");
  });
});

describe("voyant", () => {
  it("la v4 de Will reste verte", () => {
    const r = controlerVersion(versionV4("will"));
    expect(voyant(noterVersion(r.violations))).toBe("vert");
    expect(seg).toBeTypeOf("function");
  });
});
