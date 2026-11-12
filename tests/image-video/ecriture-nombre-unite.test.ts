/** Nombre seul sur l'image : corrigé à la source (consigne + relance) ; la validation des chiffres reste stricte. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import { CONSIGNE_ECRITURE_IV, variableRelanceIV } from "@/moteurs/montage-image-video/ecriture";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import { verifierScript } from "@/moteurs/montage-image-video/regles";

const carteD = JSON.parse(readFileSync(join(process.cwd(), "tests/image-video/fixtures/cartes/D.json"), "utf8")) as CarteImage;
const carte: CarteImage = {
  ...carteD,
  titre: "Facturer en 12 jours au lieu de 45",
  sousTitre: "Une PME de 25 personnes automatise ses relances.",
  chiffres: [...carteD.chiffres, { id: "c99", brut: "45", valeur: 45, unite: "nombre", aDire: false, lu: "les-deux" } as CarteImage["chiffres"][number]],
};

const base = structuredClone(FICHES_SIMULEES["essai-d"]!) as FicheImage;
const refusE01 = (dit: string) => {
  const f = structuredClone(base);
  f.ecrans[0]!.texteDit = dit;
  f.ecrans[0]!.surMot = [{ mot: 0, action: "apparait" }];
  return verifierScript(f, { carte }).manquements.filter((m) => m.regle === "Q05" && m.message.startsWith("Écran e01"));
};

describe("nombre seul sur l'image", () => {
  it("(a) la consigne porte la règle : nombre seul écrit comme sur l'image, sans unité ajoutée", () => {
    expect(CONSIGNE_ECRITURE_IV).toContain("Un nombre SEUL sur l'image");
    expect(CONSIGNE_ECRITURE_IV).toContain("SANS unité que l'image ne lui donne pas");
    expect(CONSIGNE_ECRITURE_IV).toContain("« au lieu de 45 », jamais « 45 jours »");
    expect(CONSIGNE_ECRITURE_IV).toContain("n'inverse jamais deux nombres");
  });

  it("(b) la relance dit d'écrire 45 tel quel quand 45 est seul dans la carte", () => {
    const variable = `<carte>${JSON.stringify(carte)}</carte>`;
    const r = variableRelanceIV(variable, "{}", ["Écran e01 : « 45 jour » n'est pas sur l'image."]);
    expect(r).toContain("Écris 45 tel quel, sans unité");
    // 46 n'est pas dans la carte, ou 45 n'y est pas seul : aucune phrase ajoutée
    expect(variableRelanceIV(variable, "{}", ["Écran e01 : « 46 jour » n'est pas sur l'image."])).not.toContain("tel quel");
    expect(variableRelanceIV(`<carte>${JSON.stringify(carteD)}</carte>`, "{}", ["Écran e01 : « 45 jour » n'est pas sur l'image."])).not.toContain("tel quel");
  });

  it("(c) la validation reste stricte", () => {
    expect(refusE01("Facturer en douze jours, au lieu de 45 jours.")).toHaveLength(1);
    expect(refusE01("Facturer en douze jours, au lieu de 46 jours.")).toHaveLength(1);
    expect(refusE01("Facturer en douze jours, au lieu de 45.")).toEqual([]);
    expect(refusE01("Facturer en 45 jours, au lieu de douze.").length).toBeGreaterThan(0);
  });
});
