/** Ciblage, lot F : la cible entre dans la consigne d'écriture image → vidéo (facultative, anonymisée, bornée). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { complexiteDe } from "@/domaine/image-video/complexite";
import type { Ciblage } from "@/domaine/ciblage/types";
import { consigneCibleIV, variableEcritureIV } from "@/moteurs/montage-image-video/ecriture";

const carte = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/A.json"), "utf8")) as CarteImage;
const metier = (libelle: string): Ciblage => ({ niveau: "metier", libelle, origine: "saisie" });

describe("consigneCibleIV", () => {
  it("sans cible : rien", () => {
    expect(consigneCibleIV(undefined)).toBe("");
  });
  it("avec cible : libellé, niveau et règle des 5 premières secondes", () => {
    const t = consigneCibleIV(metier("plombier"));
    expect(t).toContain("Cible : plombier (métier), à nommer dans les 5 premières secondes");
  });
  it("libellé borné à 80 caractères et sur une seule ligne", () => {
    const t = consigneCibleIV(metier(`plombier\nchauffagiste ${"x".repeat(200)}`));
    expect(t).not.toMatch(/\n.*\n/);
    const libelle = /Cible : (.*) \(métier\)/.exec(t)![1]!;
    expect(libelle.length).toBeLessThanOrEqual(80);
    expect(libelle).not.toMatch(/[\r\n]/);
  });
});

describe("variableEcritureIV et ciblage", () => {
  it("sans cible : octet pour octet comme avant", () => {
    const c = complexiteDe(carte);
    expect(variableEcritureIV(carte, c, {}, undefined, undefined, undefined)).toBe(variableEcritureIV(carte, c));
    expect(variableEcritureIV(carte, c)).not.toContain("<cible>");
  });
  it("avec cible : une balise <cible> en donnée", () => {
    const v = variableEcritureIV(carte, complexiteDe(carte), {}, undefined, undefined, metier("plombier"));
    expect(v).toContain("<cible>");
    expect(v).toContain("plombier");
  });
});
